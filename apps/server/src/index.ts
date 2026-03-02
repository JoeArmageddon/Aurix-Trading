import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config, validateConfig } from './config.js';

// Services
import { redisService } from './services/redisService.js';
import { firebaseService } from './services/firebaseService.js';
import { marketStreamService } from './services/marketStreamService.js';
import { stockPollingService } from './services/stockPollingService.js';
import { sentimentEngine } from './services/sentimentEngine.js';
import { onchainEngine } from './services/onchainEngine.js';
import { alertEngine } from './services/alertEngine.js';
import { reportScheduler } from './services/reportScheduler.js';
import { websocketService } from './services/websocketService.js';

// Routes
import { authRoutes } from './routes/auth.js';
import { marketRoutes } from './routes/market.js';
import { alertRoutes } from './routes/alerts.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { aiRoutes } from './routes/ai.js';
import { watchlistRoutes } from './routes/watchlist.js';

async function startServer() {
  // Validate configuration
  validateConfig();

  // Initialize Fastify
  const fastify = Fastify({
    logger: true,
  });

  // Register plugins
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://aurix.trading', 'https://www.aurix.trading']
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  await fastify.register(websocket);

  // Initialize services
  console.log('Initializing services...');
  
  await redisService.connect();
  await firebaseService.initialize();

  // Start data services
  await marketStreamService.start();
  await stockPollingService.start();
  await sentimentEngine.start();
  await onchainEngine.start();
  await alertEngine.start();
  await reportScheduler.start();
  websocketService.start();

  // Register WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const clientId = `${req.ip}-${Date.now()}`;
    websocketService.addClient(clientId, connection.socket);
  });

  // Register API routes
  fastify.register(authRoutes, { prefix: '/auth' });
  fastify.register(marketRoutes, { prefix: '/market' });
  fastify.register(alertRoutes, { prefix: '/alerts' });
  fastify.register(portfolioRoutes, { prefix: '/portfolio' });
  fastify.register(aiRoutes, { prefix: '/ai' });
  fastify.register(watchlistRoutes, { prefix: '/watchlists' });

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        redis: 'connected',
        firebase: 'connected',
        marketStream: 'running',
      },
    };
  });

  // Root endpoint
  fastify.get('/', async () => {
    return {
      name: 'Aurix API',
      version: '1.0.0',
      status: 'running',
    };
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    
    marketStreamService.stop();
    stockPollingService.stop();
    sentimentEngine.stop();
    onchainEngine.stop();
    alertEngine.stop();
    reportScheduler.stop();
    websocketService.stop();
    await redisService.disconnect();
    
    await fastify.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`🚀 Server listening on port ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

startServer();
