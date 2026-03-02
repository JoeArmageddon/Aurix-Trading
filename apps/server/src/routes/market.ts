import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { redisService } from '../services/redisService.js';
import { metricsEngine } from '../services/metricsEngine.js';
import { marketStreamService } from '../services/marketStreamService.js';
import { stockPollingService } from '../services/stockPollingService.js';
import { sentimentEngine } from '../services/sentimentEngine.js';
import { onchainEngine } from '../services/onchainEngine.js';
import { CRYPTO_SYMBOLS, NIFTY_50_SYMBOLS } from '@aurix/types';
import { formatSymbolForDisplay } from '@aurix/utils';

const symbolSchema = z.object({
  symbol: z.string().min(1),
});

export async function marketRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /market/crypto - Get all crypto prices
  fastify.get('/crypto', async (request, reply) => {
    try {
      const prices = await redisService.getAllPrices();
      const metrics = await redisService.getAllMetrics();
      
      const result = CRYPTO_SYMBOLS.map(symbol => {
        const price = prices[symbol];
        const metric = metrics[symbol];
        
        return {
          symbol,
          price: price || 0,
          metrics: metric || null,
        };
      });

      return reply.send({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      return reply.status(500).send({ error: 'Failed to fetch crypto data' });
    }
  });

  // GET /market/crypto/:symbol - Get specific crypto
  fastify.get('/crypto/:symbol', async (request, reply) => {
    try {
      const { symbol } = symbolSchema.parse(request.params);
      
      const price = await redisService.getPrice(symbol);
      const marketData = await redisService.getMarketData(symbol);
      const metrics = await redisService.getMetrics(symbol);
      const sentiment = sentimentEngine.getSentiment(symbol);
      const onchain = await onchainEngine.getOnChainMetrics(symbol);
      
      return reply.send({
        success: true,
        data: {
          symbol,
          price,
          marketData,
          metrics,
          sentiment,
          onchain,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Error fetching crypto:', error);
      return reply.status(500).send({ error: 'Failed to fetch crypto data' });
    }
  });

  // GET /market/stocks - Get all NIFTY 50 stocks
  fastify.get('/stocks', async (request, reply) => {
    try {
      const prices = await redisService.getAllPrices();
      const metrics = await redisService.getAllMetrics();
      
      const niftySymbols = NIFTY_50_SYMBOLS.map(s => formatSymbolForDisplay(s));
      
      const result = niftySymbols.map(symbol => {
        const price = prices[symbol];
        const metric = metrics[symbol];
        
        return {
          symbol,
          price: price || 0,
          metrics: metric || null,
        };
      }).filter(item => item.price > 0);

      return reply.send({ success: true, data: result });
    } catch (error) {
      console.error('Error fetching stocks:', error);
      return reply.status(500).send({ error: 'Failed to fetch stock data' });
    }
  });

  // GET /market/stocks/:symbol - Get specific stock
  fastify.get('/stocks/:symbol', async (request, reply) => {
    try {
      const { symbol } = symbolSchema.parse(request.params);
      
      const price = await redisService.getPrice(symbol);
      const marketData = await redisService.getMarketData(symbol);
      const metrics = await redisService.getMetrics(symbol);
      const sentiment = sentimentEngine.getSentiment(symbol);
      
      return reply.send({
        success: true,
        data: {
          symbol,
          price,
          marketData,
          metrics,
          sentiment,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Error fetching stock:', error);
      return reply.status(500).send({ error: 'Failed to fetch stock data' });
    }
  });

  // GET /market/pulse - Get market pulse metrics
  fastify.get('/pulse', async (request, reply) => {
    try {
      const pulse = await metricsEngine.getMarketPulse();
      
      return reply.send({
        success: true,
        data: pulse,
      });
    } catch (error) {
      console.error('Error fetching market pulse:', error);
      return reply.status(500).send({ error: 'Failed to fetch market pulse' });
    }
  });

  // GET /market/movers - Get top movers
  fastify.get('/movers', async (request, reply) => {
    try {
      const metrics = await redisService.getAllMetrics();
      const allData = Object.values(metrics);
      
      // Sort by absolute change
      const movers = allData
        .map(m => ({
          symbol: m.symbol,
          changePercent: m.trendScore - 50, // Proxy for change
          metrics: m,
        }))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        .slice(0, 10);

      return reply.send({
        success: true,
        data: movers,
      });
    } catch (error) {
      console.error('Error fetching movers:', error);
      return reply.status(500).send({ error: 'Failed to fetch movers' });
    }
  });

  // GET /market/search?q=query - Search assets
  fastify.get('/search', async (request, reply) => {
    try {
      const { q } = request.query as { q: string };
      
      if (!q || q.length < 2) {
        return reply.status(400).send({ error: 'Query must be at least 2 characters' });
      }

      const query = q.toUpperCase();
      
      // Search in our supported symbols
      const cryptoMatches = CRYPTO_SYMBOLS.filter(s => 
        s.includes(query)
      ).map(s => ({ symbol: s, type: 'crypto' as const }));
      
      const stockMatches = NIFTY_50_SYMBOLS
        .map(s => formatSymbolForDisplay(s))
        .filter(s => s.includes(query))
        .map(s => ({ symbol: s, type: 'stock' as const }));

      return reply.send({
        success: true,
        data: [...cryptoMatches, ...stockMatches].slice(0, 10),
      });
    } catch (error) {
      console.error('Error searching:', error);
      return reply.status(500).send({ error: 'Search failed' });
    }
  });

  // GET /market/whales - Get recent whale alerts
  fastify.get('/whales', async (request, reply) => {
    try {
      const { symbol, limit } = request.query as { symbol?: string; limit?: string };
      const alerts = onchainEngine.getRecentAlerts(
        symbol,
        limit ? parseInt(limit, 10) : 20
      );
      
      return reply.send({
        success: true,
        data: alerts,
      });
    } catch (error) {
      console.error('Error fetching whale alerts:', error);
      return reply.status(500).send({ error: 'Failed to fetch whale alerts' });
    }
  });
}
