import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { firebaseService } from '../services/firebaseService.js';
import { redisService } from '../services/redisService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { hasReachedLimit } from '@aurix/utils';

const createWatchlistSchema = z.object({
  name: z.string().min(1).max(50),
  symbols: z.array(z.string().min(1).max(20)).max(50),
});

const updateWatchlistSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  symbols: z.array(z.string().min(1).max(20)).max(50).optional(),
});

export async function watchlistRoutes(fastify: FastifyInstance): Promise<void> {
  // All watchlist routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // GET /watchlists - Get user's watchlists
  fastify.get('/', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const watchlists = await firebaseService.getWatchlists(user.userId);
      
      return reply.send({ success: true, data: watchlists });
    } catch (error) {
      console.error('Error fetching watchlists:', error);
      return reply.status(500).send({ error: 'Failed to fetch watchlists' });
    }
  });

  // POST /watchlists - Create watchlist
  fastify.post('/', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const body = createWatchlistSchema.parse(request.body);

      // Check limits for free users
      if (user.plan === 'free') {
        const currentWatchlists = await firebaseService.getWatchlists(user.userId);
        if (currentWatchlists.length >= 1) {
          return reply.status(403).send({
            error: 'Free plan limited to 1 watchlist. Upgrade to Pro.',
          });
        }
        if (body.symbols.length > 3) {
          return reply.status(403).send({
            error: 'Free plan limited to 3 assets per watchlist. Upgrade to Pro.',
          });
        }
      }

      const watchlist = await firebaseService.createWatchlist({
        userId: user.userId,
        name: body.name,
        symbols: body.symbols.map(s => s.toUpperCase()),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return reply.status(201).send({ success: true, data: watchlist });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Error creating watchlist:', error);
      return reply.status(500).send({ error: 'Failed to create watchlist' });
    }
  });

  // GET /watchlists/:id - Get specific watchlist with live data
  fastify.get('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      // Get all watchlists and find the one we want
      const watchlists = await firebaseService.getWatchlists(user.userId);
      const watchlist = watchlists.find(w => w.id === id);
      
      if (!watchlist) {
        return reply.status(404).send({ error: 'Watchlist not found' });
      }

      // Get live data for symbols
      const symbolsData = await Promise.all(
        watchlist.symbols.map(async (symbol) => {
          const [price, metrics, marketData] = await Promise.all([
            redisService.getPrice(symbol),
            redisService.getMetrics(symbol),
            redisService.getMarketData(symbol),
          ]);

          return {
            symbol,
            price,
            metrics,
            marketData,
          };
        })
      );

      return reply.send({
        success: true,
        data: {
          ...watchlist,
          assets: symbolsData,
        },
      });
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      return reply.status(500).send({ error: 'Failed to fetch watchlist' });
    }
  });

  // PUT /watchlists/:id - Update watchlist
  fastify.put('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const body = updateWatchlistSchema.parse(request.body);

      // Verify ownership
      const watchlists = await firebaseService.getWatchlists(user.userId);
      const watchlist = watchlists.find(w => w.id === id);
      
      if (!watchlist) {
        return reply.status(404).send({ error: 'Watchlist not found' });
      }

      // Check symbol limit for free users
      if (user.plan === 'free' && body.symbols && body.symbols.length > 3) {
        return reply.status(403).send({
          error: 'Free plan limited to 3 assets per watchlist. Upgrade to Pro.',
        });
      }

      await firebaseService.updateWatchlist(id, {
        ...body,
        symbols: body.symbols?.map(s => s.toUpperCase()),
      });

      return reply.send({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Error updating watchlist:', error);
      return reply.status(500).send({ error: 'Failed to update watchlist' });
    }
  });

  // DELETE /watchlists/:id - Delete watchlist
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      // Verify ownership
      const watchlists = await firebaseService.getWatchlists(user.userId);
      const watchlist = watchlists.find(w => w.id === id);
      
      if (!watchlist) {
        return reply.status(404).send({ error: 'Watchlist not found' });
      }

      await firebaseService.deleteWatchlist(id);

      return reply.send({ success: true });
    } catch (error) {
      console.error('Error deleting watchlist:', error);
      return reply.status(500).send({ error: 'Failed to delete watchlist' });
    }
  });
}
