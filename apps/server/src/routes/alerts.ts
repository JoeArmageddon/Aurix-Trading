import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { alertEngine } from '../services/alertEngine.js';
import { firebaseService } from '../services/firebaseService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { AlertConditionTree } from '@aurix/types';
import { hasReachedLimit } from '@aurix/utils';

const createAlertSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  conditions: z.custom<AlertConditionTree>(),
  cooldownMinutes: z.number().min(1).max(1440).default(60),
});

const updateAlertSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  conditions: z.custom<AlertConditionTree>().optional(),
  isActive: z.boolean().optional(),
  cooldownMinutes: z.number().min(1).max(1440).optional(),
});

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  // All alert routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // GET /alerts - Get user's alerts
  fastify.get('/', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const alerts = await alertEngine.getUserAlerts(user.userId);
      
      return reply.send({ success: true, data: alerts });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      return reply.status(500).send({ error: 'Failed to fetch alerts' });
    }
  });

  // POST /alerts - Create new alert
  fastify.post('/', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const body = createAlertSchema.parse(request.body);

      // Check alert limits for free users
      if (user.plan === 'free') {
        const currentAlerts = await firebaseService.countActiveAlerts(user.userId);
        if (hasReachedLimit(user.plan, 'maxAlerts', currentAlerts)) {
          return reply.status(403).send({
            error: 'Free plan limited to 2 active alerts. Upgrade to Pro for unlimited alerts.',
          });
        }
      }

      const alert = await alertEngine.createAlert({
        userId: user.userId,
        name: body.name,
        symbol: body.symbol.toUpperCase(),
        conditions: body.conditions,
        isActive: true,
        cooldownMinutes: body.cooldownMinutes,
        triggerCount: 0,
        createdAt: new Date(),
      });

      return reply.status(201).send({ success: true, data: alert });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      if (error instanceof Error && error.message.includes('limited to')) {
        return reply.status(403).send({ error: error.message });
      }
      console.error('Error creating alert:', error);
      return reply.status(500).send({ error: 'Failed to create alert' });
    }
  });

  // GET /alerts/:id - Get specific alert
  fastify.get('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      
      const alert = await firebaseService.getAlert(id);
      
      if (!alert) {
        return reply.status(404).send({ error: 'Alert not found' });
      }
      
      if (alert.userId !== user.userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      return reply.send({ success: true, data: alert });
    } catch (error) {
      console.error('Error fetching alert:', error);
      return reply.status(500).send({ error: 'Failed to fetch alert' });
    }
  });

  // PUT /alerts/:id - Update alert
  fastify.put('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const body = updateAlertSchema.parse(request.body);
      
      const alert = await firebaseService.getAlert(id);
      
      if (!alert) {
        return reply.status(404).send({ error: 'Alert not found' });
      }
      
      if (alert.userId !== user.userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      await alertEngine.updateAlert(id, body);

      return reply.send({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Error updating alert:', error);
      return reply.status(500).send({ error: 'Failed to update alert' });
    }
  });

  // DELETE /alerts/:id - Delete alert
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      
      const alert = await firebaseService.getAlert(id);
      
      if (!alert) {
        return reply.status(404).send({ error: 'Alert not found' });
      }
      
      if (alert.userId !== user.userId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      await alertEngine.deleteAlert(id);

      return reply.send({ success: true });
    } catch (error) {
      console.error('Error deleting alert:', error);
      return reply.status(500).send({ error: 'Failed to delete alert' });
    }
  });

  // GET /alerts/logs - Get alert logs
  fastify.get('/logs', async (request, reply) => {
    try {
      const { user } = request as AuthenticatedRequest;
      const { limit } = request.query as { limit?: string };
      
      const logs = await alertEngine.getAlertLogs(
        user.userId,
        limit ? parseInt(limit, 10) : 50
      );

      return reply.send({ success: true, data: logs });
    } catch (error) {
      console.error('Error fetching alert logs:', error);
      return reply.status(500).send({ error: 'Failed to fetch alert logs' });
    }
  });
}
