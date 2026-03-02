import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { aiRateLimit } from '../middleware/rateLimit.js';
import { aiEngine } from '../services/aiEngine.js';
import { firebaseService } from '../services/firebaseService.js';
import { redisService } from '../services/redisService.js';
import type { AuthenticatedRequest } from '../types/index.js';

const analyzeSchema = z.object({
  symbol: z.string().min(1).max(20),
});

export async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // All AI routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // POST /ai/analyze - Analyze an asset
  fastify.post('/analyze', { preHandler: [aiRateLimit] }, async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const body = analyzeSchema.parse(request.body);

      // Check AI usage for free users
      if (user.plan === 'free') {
        const dbUser = await firebaseService.getUser(user.userId);
        if (dbUser && dbUser.aiUsageToday >= 5) {
          return reply.status(429).send({
            error: 'Daily AI analysis limit reached (5/day). Upgrade to Pro for unlimited access.',
          });
        }
      }

      // Get current metrics
      const metrics = await redisService.getMetrics(body.symbol.toUpperCase());
      
      if (!metrics) {
        return reply.status(404).send({ error: 'Asset metrics not found' });
      }

      // Perform AI analysis
      const analysis = await aiEngine.analyzeAsset({
        symbol: body.symbol.toUpperCase(),
        metrics,
        userPlan: user.plan,
        userId: user.userId,
      });

      // Increment AI usage for free users
      if (user.plan === 'free') {
        await firebaseService.updateUser(user.userId, {
          aiUsageToday: (await firebaseService.getUser(user.userId))!.aiUsageToday + 1,
        });
      }

      return reply.send({ success: true, data: analysis });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      if (error instanceof Error && error.message.includes('limit reached')) {
        return reply.status(429).send({ error: error.message });
      }
      console.error('Error analyzing asset:', error);
      return reply.status(500).send({ error: 'Failed to analyze asset' });
    }
  });

  // GET /ai/reports - Get AI reports
  fastify.get('/reports', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { limit } = request.query as { limit?: string };

      // Check plan for report access
      if (user.plan === 'free') {
        return reply.status(403).send({
          error: 'Daily reports are a Pro feature. Upgrade to access.',
        });
      }

      const reports = await firebaseService.getAIReports(
        limit ? parseInt(limit, 10) : 10
      );

      return reply.send({ success: true, data: reports });
    } catch (error) {
      console.error('Error fetching reports:', error);
      return reply.status(500).send({ error: 'Failed to fetch reports' });
    }
  });

  // GET /ai/reports/latest - Get latest AI report
  fastify.get('/reports/latest', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { period } = request.query as { period?: '4h' | 'daily' };

      // Check plan for report access
      if (user.plan === 'free') {
        return reply.status(403).send({
          error: 'Daily reports are a Pro feature. Upgrade to access.',
        });
      }

      const report = await firebaseService.getLatestAIReport(period || 'daily');

      if (!report) {
        return reply.status(404).send({ error: 'No reports available' });
      }

      return reply.send({ success: true, data: report });
    } catch (error) {
      console.error('Error fetching latest report:', error);
      return reply.status(500).send({ error: 'Failed to fetch report' });
    }
  });
}
