import { redisService } from '../services/redisService.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export function createRateLimit(config: RateLimitConfig) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    // Get identifier (user ID or IP)
    const identifier = 
      (request as { user?: { userId: string } }).user?.userId || 
      request.ip;
    
    const key = `${config.keyPrefix || 'ratelimit'}:${identifier}`;
    
    const current = await redisService.getCounter(key);
    
    if (current > config.maxRequests) {
      reply.status(429).send({
        error: 'Too many requests',
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
      return;
    }
    
    await redisService.incrementCounter(key, Math.floor(config.windowMs / 1000));
  };
}

// AI endpoint rate limit: 10 requests per minute
export const aiRateLimit = createRateLimit({
  windowMs: 60000,
  maxRequests: 10,
  keyPrefix: 'ai',
});

// General API rate limit: 100 requests per minute
export const generalRateLimit = createRateLimit({
  windowMs: 60000,
  maxRequests: 100,
  keyPrefix: 'api',
});
