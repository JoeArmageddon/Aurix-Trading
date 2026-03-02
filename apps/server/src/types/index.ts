import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User, UserPlan } from '@aurix/types';
import type WebSocket from 'ws';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    email: string;
    plan: UserPlan;
  };
}

export type RouteHandler = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void> | void;

export type AuthRouteHandler = (
  request: AuthenticatedRequest,
  reply: FastifyReply
) => Promise<void> | void;

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
  isAuthenticated: boolean;
}

export interface AlertEvaluationResult {
  triggered: boolean;
  message?: string;
}

export interface MarketDataCache {
  symbol: string;
  data: {
    price: number;
    change24h: number;
    changePercent24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
    lastUpdated: string;
  };
  ttl: number;
}
