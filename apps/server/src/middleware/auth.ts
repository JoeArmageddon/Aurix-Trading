import type { FastifyRequest, FastifyReply } from 'fastify';
import { firebaseService } from '../services/firebaseService.js';
import { config } from '../config.js';
import type { AuthenticatedRequest } from '../types/index.js';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Unauthorized - No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    
    // Verify Firebase token
    const decoded = await firebaseService.verifyIdToken(token);
    
    if (!decoded) {
      reply.status(401).send({ error: 'Unauthorized - Invalid token' });
      return;
    }

    // Get user from Firestore
    const user = await firebaseService.getUser(decoded.uid);
    
    if (!user) {
      reply.status(401).send({ error: 'Unauthorized - User not found' });
      return;
    }

    // Attach user to request
    (request as AuthenticatedRequest).user = {
      userId: user.id,
      email: user.email,
      plan: user.plan,
    };
  } catch (error) {
    console.error('Auth error:', error);
    reply.status(401).send({ error: 'Unauthorized' });
  }
}

export function requirePlan(plans: string[]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const authReq = request as AuthenticatedRequest;
    
    if (!authReq.user) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    if (!plans.includes(authReq.user.plan)) {
      reply.status(403).send({ 
        error: 'Forbidden - This feature requires a Pro plan',
        requiredPlan: 'pro',
      });
    }
  };
}
