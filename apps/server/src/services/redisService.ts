import { Redis } from 'ioredis';
import { config } from '../config.js';
import type { AssetMetrics, MarketDataCache } from '../types/index.js';

class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (!config.upstashRedisUrl) {
      console.warn('Redis URL not configured, using in-memory fallback');
      return;
    }

    try {
      this.client = new Redis(config.upstashRedisUrl, {
        tls: { rejectUnauthorized: false },
        retryStrategy: (times) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        console.log('Redis connected');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        console.error('Redis error:', err);
        this.isConnected = false;
      });

      await this.client.ping();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  private getKey(type: string, symbol: string): string {
    return `asset:${symbol}:${type}`;
  }

  async setMarketData(symbol: string, data: MarketDataCache['data']): Promise<void> {
    if (!this.client || !this.isConnected) return;
    const key = this.getKey('market', symbol);
    await this.client.setex(key, 300, JSON.stringify(data));
  }

  async getMarketData(symbol: string): Promise<MarketDataCache['data'] | null> {
    if (!this.client || !this.isConnected) return null;
    const key = this.getKey('market', symbol);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setMetrics(symbol: string, metrics: AssetMetrics): Promise<void> {
    if (!this.client || !this.isConnected) return;
    const key = this.getKey('metrics', symbol);
    await this.client.setex(key, 60, JSON.stringify(metrics));
  }

  async getMetrics(symbol: string): Promise<AssetMetrics | null> {
    if (!this.client || !this.isConnected) return null;
    const key = this.getKey('metrics', symbol);
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async getAllMetrics(): Promise<Record<string, AssetMetrics>> {
    if (!this.client || !this.isConnected) return {};
    
    const keys = await this.client.keys('asset:*:metrics');
    const result: Record<string, AssetMetrics> = {};
    
    for (const key of keys) {
      const symbol = key.split(':')[1];
      const metrics = await this.getMetrics(symbol);
      if (metrics) {
        result[symbol] = metrics;
      }
    }
    
    return result;
  }

  async setPrice(symbol: string, price: number): Promise<void> {
    if (!this.client || !this.isConnected) return;
    const key = this.getKey('price', symbol);
    await this.client.setex(key, 60, price.toString());
  }

  async getPrice(symbol: string): Promise<number | null> {
    if (!this.client || !this.isConnected) return null;
    const key = this.getKey('price', symbol);
    const data = await this.client.get(key);
    return data ? parseFloat(data) : null;
  }

  async getAllPrices(): Promise<Record<string, number>> {
    if (!this.client || !this.isConnected) return {};
    
    const keys = await this.client.keys('asset:*:price');
    const result: Record<string, number> = {};
    
    for (const key of keys) {
      const symbol = key.split(':')[1];
      const price = await this.getPrice(symbol);
      if (price !== null) {
        result[symbol] = price;
      }
    }
    
    return result;
  }

  async publish(channel: string, message: unknown): Promise<void> {
    if (!this.client || !this.isConnected) return;
    await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.client || !this.isConnected) return;
    const subscriber = this.client.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (_, message) => callback(message));
  }

  async incrementCounter(key: string, ttl: number): Promise<number> {
    if (!this.client || !this.isConnected) return 0;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttl);
    }
    return count;
  }

  async getCounter(key: string): Promise<number> {
    if (!this.client || !this.isConnected) return 0;
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.client || !this.isConnected) return;
    if (ttl) {
      await this.client.setex(key, ttl, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !this.isConnected) return null;
    return this.client.get(key);
  }

  async delete(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    await this.client.del(key);
  }
}

export const redisService = new RedisService();
