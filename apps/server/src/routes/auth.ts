import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { firebaseService } from '../services/firebaseService.js';
import type { User } from '@aurix/types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  idToken: z.string(), // Firebase ID token from client
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /auth/register
  fastify.post('/register', async (request, reply) => {
    try {
      const body = registerSchema.parse(request.body);
      
      // Check if user already exists
      const existingUser = await firebaseService.getUserByEmail(body.email);
      if (existingUser) {
        return reply.status(409).send({ error: 'User already exists' });
      }

      // Note: In production, you'd create the Firebase Auth user here
      // For now, we assume the client creates the user and sends us the details
      
      const newUser: Omit<User, 'id'> = {
        email: body.email,
        plan: 'free',
        aiUsageToday: 0,
        aiUsageResetAt: new Date(),
        createdAt: new Date(),
        lastLoginAt: new Date(),
        emailVerified: false,
      };

      const user = await firebaseService.createUser(newUser);
      
      // Log successful registration (in-app only)
      console.log(`✅ New user registered: ${user.email}`);

      return reply.send({
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          plan: user.plan,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Registration error:', error);
      return reply.status(500).send({ error: 'Registration failed' });
    }
  });

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      // Verify Firebase token
      const decoded = await firebaseService.verifyIdToken(body.idToken);
      
      if (!decoded) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      // Get or create user
      let user = await firebaseService.getUser(decoded.uid);
      
      if (!user) {
        // Create new user record
        const newUser: Omit<User, 'id'> = {
          email: decoded.email || body.email,
          plan: 'free',
          aiUsageToday: 0,
          aiUsageResetAt: new Date(),
          createdAt: new Date(),
          lastLoginAt: new Date(),
          emailVerified: decoded.email_verified || false,
        };
        user = await firebaseService.createUser(newUser);
      } else {
        // Update last login
        await firebaseService.updateUser(user.id, {
          lastLoginAt: new Date(),
        });
      }

      // Reset AI usage if it's a new day
      const today = new Date();
      if (today.getDate() !== user.aiUsageResetAt.getDate()) {
        await firebaseService.updateUser(user.id, {
          aiUsageToday: 0,
          aiUsageResetAt: today,
        });
        user.aiUsageToday = 0;
      }

      return reply.send({
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          plan: user.plan,
          aiUsageToday: user.aiUsageToday,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.errors });
      }
      console.error('Login error:', error);
      return reply.status(500).send({ error: 'Login failed' });
    }
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    // Token refresh is handled client-side with Firebase
    return reply.send({ success: true });
  });
}
