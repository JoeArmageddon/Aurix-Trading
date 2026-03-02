import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { portfolioEngine } from '../services/portfolioEngine.js';
import { firebaseService } from '../services/firebaseService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { hasReachedLimit } from '@aurix/utils';
import type { AssetType } from '@aurix/types';

const addPositionSchema = z.object({
  asset: z.string().min(1).max(20),
  entryPrice: z.number().positive(),
  quantity: z.number().positive(),
  assetType: z.enum(['crypto', 'stock']),
});

const updatePositionSchema = z.object({
  entryPrice: z.number().positive().optional(),
  quantity: z.number().positive().optional(),
});

export async function portfolioRoutes(fastify: FastifyInstance): Promise<void> {
  // All portfolio routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // GET /portfolio - Get user's portfolio
  fastify.get('/', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      
      const [positions, metrics] = await Promise.all([
        portfolioEngine.getUserPortfolio(user.userId),
        portfolioEngine.calculatePortfolioMetrics(user.userId),
      ]);

      // Get PnL for each position
      const positionsWithPnL = await Promise.all(
        positions.map(async (pos) => {
          const pnl = await portfolioEngine.getPositionPnL(pos);
          return { ...pos, ...pnl };
        })
      );

      return reply.send({
        success: true,
        data: {
          positions: positionsWithPnL,
          metrics,
        },
      });
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      return reply.status(500).send({ error: 'Failed to fetch portfolio' });
    }
  });

  // POST /portfolio - Add position
  fastify.post('/', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const body = addPositionSchema.parse(request.body);

      const position = await portfolioEngine.addPosition(
        user.userId,
        body.asset.toUpperCase(),
        body.entryPrice,
        body.quantity,
        body.assetType as AssetType,
        user.plan
      );

      return reply.status(201).send({ success: true, data: position });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      if (error instanceof Error && error.message.includes('limited to')) {
        return reply.status(403).send({ error: error.message });
      }
      console.error('Error adding position:', error);
      return reply.status(500).send({ error: 'Failed to add position' });
    }
  });

  // PUT /portfolio/:id - Update position
  fastify.put('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const body = updatePositionSchema.parse(request.body);

      // Verify ownership
      const positions = await portfolioEngine.getUserPortfolio(user.userId);
      const position = positions.find(p => p.id === id);
      
      if (!position) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      await portfolioEngine.updatePosition(id, body);

      return reply.send({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Error updating position:', error);
      return reply.status(500).send({ error: 'Failed to update position' });
    }
  });

  // DELETE /portfolio/:id - Remove position
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      // Verify ownership
      const positions = await portfolioEngine.getUserPortfolio(user.userId);
      const position = positions.find(p => p.id === id);
      
      if (!position) {
        return reply.status(404).send({ error: 'Position not found' });
      }

      await portfolioEngine.removePosition(id);

      return reply.send({ success: true });
    } catch (error) {
      console.error('Error removing position:', error);
      return reply.status(500).send({ error: 'Failed to remove position' });
    }
  });

  // GET /portfolio/metrics - Get detailed portfolio metrics
  fastify.get('/metrics', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      
      const metrics = await portfolioEngine.calculatePortfolioMetrics(user.userId);

      return reply.send({ success: true, data: metrics });
    } catch (error) {
      console.error('Error fetching portfolio metrics:', error);
      return reply.status(500).send({ error: 'Failed to fetch metrics' });
    }
  });
}
