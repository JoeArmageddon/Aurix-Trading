import type { WebSocket } from 'ws';
import { redisService } from './redisService.js';
import type { WSMessage } from '@aurix/types';
import type { WebSocketClient } from '../types/index.js';

class WebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();
  private isRunning = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Subscribe to Redis channels
    this.subscribeToChannels();

    console.log('WebSocket service started');
  }

  stop(): void {
    this.isRunning = false;
    for (const client of this.clients.values()) {
      client.socket.close();
    }
    this.clients.clear();
    console.log('WebSocket service stopped');
  }

  addClient(id: string, socket: WebSocket): WebSocketClient {
    const client: WebSocketClient = {
      id,
      socket,
      subscriptions: new Set(),
      isAuthenticated: false,
    };

    this.clients.set(id, client);

    // Send connection confirmation
    this.sendToClient(client, {
      type: 'connected',
      timestamp: Date.now(),
    });

    // Handle messages
    socket.on('message', (data) => {
      this.handleMessage(client, data.toString());
    });

    // Handle close
    socket.on('close', () => {
      this.removeClient(id);
    });

    return client;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  private handleMessage(client: WebSocketClient, message: string): void {
    try {
      const data = JSON.parse(message) as WSMessage;

      switch (data.type) {
        case 'subscribed':
          if (data.channel) {
            client.subscriptions.add(data.channel);
            this.sendToClient(client, {
              type: 'subscribed',
              channel: data.channel,
              timestamp: Date.now(),
            });
          }
          break;

        case 'unsubscribed':
          if (data.channel) {
            client.subscriptions.delete(data.channel);
            this.sendToClient(client, {
              type: 'unsubscribed',
              channel: data.channel,
              timestamp: Date.now(),
            });
          }
          break;

        default:
          break;
      }
    } catch (error) {
      this.sendToClient(client, {
        type: 'error',
        data: 'Invalid message format',
        timestamp: Date.now(),
      });
    }
  }

  private sendToClient(client: WebSocketClient, message: WSMessage): void {
    if (client.socket.readyState === 1) { // WebSocket.OPEN
      client.socket.send(JSON.stringify(message));
    }
  }

  broadcast(message: WSMessage, channel?: string): void {
    for (const client of this.clients.values()) {
      if (!channel || client.subscriptions.has(channel)) {
        this.sendToClient(client, message);
      }
    }
  }

  private subscribeToChannels(): void {
    // Subscribe to market updates from Redis
    redisService.subscribe('market:updates', (message) => {
      try {
        const data = JSON.parse(message);
        this.broadcast({
          type: 'price',
          symbol: data.symbol,
          data: data.data,
          timestamp: data.timestamp,
        }, `market:${data.symbol}`);
      } catch (error) {
        console.error('Error processing market update:', error);
      }
    });

    // Subscribe to whale alerts
    redisService.subscribe('whale:alerts', (message) => {
      try {
        const data = JSON.parse(message);
        this.broadcast({
          type: 'alert',
          data,
          timestamp: Date.now(),
        }, 'whales');
      } catch (error) {
        console.error('Error processing whale alert:', error);
      }
    });
  }

  getConnectedClients(): number {
    return this.clients.size;
  }
}

export const websocketService = new WebSocketService();
