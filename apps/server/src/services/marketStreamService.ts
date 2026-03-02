import WebSocket from 'ws';
import { config } from '../config.js';
import { redisService } from './redisService.js';
import { metricsEngine } from './metricsEngine.js';
import { CRYPTO_SYMBOLS, TOP_10_CRYPTO, type BinanceStreamData } from '@aurix/types';
import type { Asset } from '@aurix/types';

class MarketStreamService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private isRunning = false;
  private isConnecting = false;
  private priceHistory: Map<string, number[]> = new Map();
  private readonly maxHistoryLength = 100;
  private boundHandlers = new Map<string, (...args: unknown[]) => void>();

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.connect();
  }

  stop(): void {
    this.isRunning = false;
    this.cleanupWebSocket();
  }

  private async connect(): Promise<void> {
    if (this.isConnecting) {
      console.log('Connection already in progress');
      return;
    }
    
    this.isConnecting = true;
    
    try {
      // Clean up existing WebSocket
      this.cleanupWebSocket();

      const streams = TOP_10_CRYPTO.map(s => `${s.toLowerCase()}@ticker`).join('/');
      const url = `${config.binanceWsUrl}/stream?streams=${streams}`;
      
      console.log('Connecting to Binance WebSocket...');
      this.ws = new WebSocket(url);

      // Create bound handlers
      const onOpen = () => {
        console.log('Binance WebSocket connected');
        this.reconnectAttempts = 0;
      };

      const onMessage = (data: WebSocket.Data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.data) {
            this.handleTickerData(parsed.data).catch(console.error);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      const onClose = () => {
        console.log('Binance WebSocket closed');
        this.handleReconnect();
      };

      const onError = (error: Error) => {
        console.error('Binance WebSocket error:', error);
      };

      // Store references for cleanup
      this.boundHandlers.set('open', onOpen);
      this.boundHandlers.set('message', onMessage);
      this.boundHandlers.set('close', onClose);
      this.boundHandlers.set('error', onError);

      this.ws.on('open', onOpen);
      this.ws.on('message', onMessage);
      this.ws.on('close', onClose);
      this.ws.on('error', onError);
    } catch (error) {
      console.error('Failed to connect to Binance:', error);
      this.handleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  private cleanupWebSocket(): void {
    if (this.ws) {
      // Remove all listeners
      for (const [event, handler] of this.boundHandlers.entries()) {
        this.ws.removeListener(event, handler);
      }
      this.boundHandlers.clear();
      
      // Close connection if open
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.terminate();
      }
      
      this.ws = null;
    }
  }

  private handleReconnect(): void {
    if (!this.isRunning || this.isConnecting) return;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.connect(), this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
      // Reset after longer delay to allow retry
      setTimeout(() => {
        this.reconnectAttempts = 0;
        this.connect();
      }, 60000);
    }
  }

  private async handleTickerData(data: BinanceStreamData): Promise<void> {
    try {
      const symbol = data.s.replace('USDT', '');
      const price = parseFloat(data.c);
      const change24h = parseFloat(data.p);
      const changePercent24h = parseFloat(data.P);
      const volume24h = parseFloat(data.v);
      const high24h = parseFloat(data.h);
      const low24h = parseFloat(data.l);

      // Validate parsed values
      if (isNaN(price) || isNaN(change24h) || isNaN(changePercent24h)) {
        console.error(`Invalid numeric data for ${symbol}:`, data);
        return;
      }

      // Update price history
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, []);
      }
      const history = this.priceHistory.get(symbol)!;
      history.push(price);
      
      // Enforce max history length
      while (history.length > this.maxHistoryLength) {
        history.shift();
      }

    const asset: Asset = {
      symbol,
      name: this.getCryptoName(symbol),
      type: 'crypto',
      price,
      change24h,
      changePercent24h,
      volume24h,
      high24h,
      low24h,
      lastUpdated: new Date(data.E),
    };

    // Parallel cache operations with error handling
    await Promise.allSettled([
      redisService.setMarketData(symbol, {
        price,
        change24h,
        changePercent24h,
        volume24h,
        high24h,
        low24h,
        lastUpdated: new Date().toISOString(),
      }),
      redisService.setPrice(symbol, price),
      metricsEngine.updateCryptoMetrics(symbol, asset as import('@aurix/types').CryptoAsset, history),
      redisService.publish('market:updates', {
        type: 'price',
        symbol,
        data: asset,
        timestamp: Date.now(),
      }),
    ]);
    } catch (error) {
      console.error('Error handling ticker data:', error);
    }
  }

  private getCryptoName(symbol: string): string {
    const names: Record<string, string> = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      SOL: 'Solana',
      BNB: 'BNB',
      XRP: 'XRP',
      ADA: 'Cardano',
      AVAX: 'Avalanche',
      DOGE: 'Dogecoin',
      LINK: 'Chainlink',
      MATIC: 'Polygon',
    };
    return names[symbol] || symbol;
  }

  getPriceHistory(symbol: string): number[] {
    return this.priceHistory.get(symbol) || [];
  }

  getLatestPrice(symbol: string): number | null {
    const history = this.priceHistory.get(symbol);
    if (!history || history.length === 0) {
      return null;
    }
    const price = history[history.length - 1];
    return typeof price === 'number' && !isNaN(price) ? price : null;
  }
}

export const marketStreamService = new MarketStreamService();
