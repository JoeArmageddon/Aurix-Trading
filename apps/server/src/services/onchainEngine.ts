import axios from 'axios';
import { config } from '../config.js';
import { firebaseService } from './firebaseService.js';
import { redisService } from './redisService.js';
import { CRYPTO_SYMBOLS, type WhaleAlert, type OnChainMetrics, type OnChainBias } from '@aurix/types';

interface WhaleAlertTransaction {
  blockchain: string;
  symbol: string;
  transaction_type: string;
  hash: string;
  from: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  to: {
    address: string;
    owner?: string;
    owner_type?: string;
  };
  timestamp: number;
  amount: number;
  amount_usd: number;
}

class OnChainEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly updateInterval = 60000; // 1 minute
  
  // Recent whale alerts cache
  private recentAlerts: WhaleAlert[] = [];
  private readonly maxAlerts = 100;
  
  // Exchange addresses cache
  private exchangeAddresses: Set<string> = new Set([
    'binance',
    'coinbase',
    'kraken',
    'bitfinex',
    'okx',
    'bybit',
    'kucoin',
  ]);

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start monitoring
    this.intervalId = setInterval(() => {
      this.checkWhaleActivity().catch(console.error);
    }, this.updateInterval);

    console.log('On-chain engine started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('On-chain engine stopped');
  }

  private async checkWhaleActivity(): Promise<void> {
    if (!config.whaleAlertApiKey) {
      // Simulate data for development
      this.simulateWhaleData();
      return;
    }

    try {
      const minValue = 500000; // $500k minimum
      const url = `https://api.whale-alert.io/v1/transactions?min_value=${minValue}&limit=50`;

      const response = await axios.get(url, { 
        timeout: 30000,
        headers: {
          'X-WA-API-KEY': config.whaleAlertApiKey,
        },
      });
      
      // Validate response structure
      if (!response.data || !Array.isArray(response.data.transactions)) {
        console.error('Invalid response structure from Whale Alert API:', response.data);
        this.simulateWhaleData();
        return;
      }
      
      const transactions: WhaleAlertTransaction[] = response.data.transactions;

      for (const tx of transactions) {
        await this.processTransaction(tx);
      }

      // Update on-chain metrics for all symbols
      await this.updateOnChainMetrics();
    } catch (error) {
      console.error('Error fetching whale alerts:', error);
      // Fall back to simulation
      this.simulateWhaleData();
    }
  }

  private async processTransaction(tx: WhaleAlertTransaction): Promise<void> {
    // Validate transaction data
    if (!this.isValidTransaction(tx)) {
      console.warn('Invalid transaction data:', tx);
      return;
    }
    
    const symbol = tx.symbol.toUpperCase();
    
    // Only track our supported symbols
    if (!CRYPTO_SYMBOLS.includes(symbol)) return;

    // Check if already being processed
    if (this.processingTransactions.has(tx.hash)) {
      return;
    }
    
    // Check if already in recent alerts
    if (this.recentAlerts.some(a => a.id === tx.hash)) {
      return;
    }

    this.processingTransactions.add(tx.hash);

    try {
      const isExchangeInflow = this.isExchangeAddress(tx.to.owner_type);
      const isExchangeOutflow = this.isExchangeAddress(tx.from.owner_type);

      const alert: WhaleAlert = {
        id: tx.hash,
        symbol,
        amount: tx.amount,
        from: tx.from.owner || tx.from.address.slice(0, 10) + '...',
        to: tx.to.owner || tx.to.address.slice(0, 10) + '...',
        timestamp: new Date(tx.timestamp * 1000),
        usdValue: tx.amount_usd,
        isExchangeInflow,
        isExchangeOutflow,
      };

      this.recentAlerts.unshift(alert);
      this.alertTimestamps.set(alert.id, Date.now());
      
      // Enforce size limit
      while (this.recentAlerts.length > this.maxAlerts) {
        const removed = this.recentAlerts.pop();
        if (removed) {
          this.alertTimestamps.delete(removed.id);
        }
      }
      
      // Also clean up old alerts by time (24 hours)
      this.cleanupOldAlerts();

      // Publish to Redis for real-time updates
      await redisService.publish('whale:alerts', alert);

      console.log(`🐋 Whale Alert: ${alert.amount.toFixed(2)} ${symbol} ($${alert.usdValue.toLocaleString()})`);
    } finally {
      this.processingTransactions.delete(tx.hash);
    }
  }

  private isValidTransaction(tx: unknown): tx is WhaleAlertTransaction {
    if (typeof tx !== 'object' || tx === null) return false;
    
    const t = tx as Record<string, unknown>;
    
    return (
      typeof t.blockchain === 'string' &&
      typeof t.symbol === 'string' &&
      typeof t.transaction_type === 'string' &&
      typeof t.hash === 'string' &&
      typeof t.amount === 'number' &&
      typeof t.amount_usd === 'number' &&
      typeof t.timestamp === 'number' &&
      typeof t.from === 'object' &&
      t.from !== null &&
      typeof t.to === 'object' &&
      t.to !== null
    );
  }

  private cleanupOldAlerts(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let i = this.recentAlerts.length;
    
    while (i--) {
      const alert = this.recentAlerts[i];
      const timestamp = this.alertTimestamps.get(alert.id) || alert.timestamp.getTime();
      
      if (timestamp < cutoff) {
        this.recentAlerts.splice(i, 1);
        this.alertTimestamps.delete(alert.id);
      }
    }
  }

  private isExchangeAddress(ownerType?: string): boolean {
    if (!ownerType) return false;
    const normalized = ownerType.toLowerCase().trim();
    return normalized === 'exchange' || normalized === 'exchange_wallet';
  }

  private simulateWhaleData(): void {
    // Generate simulated whale alerts for development
    if (Math.random() > 0.9) { // 10% chance per interval
      const symbol = CRYPTO_SYMBOLS[Math.floor(Math.random() * CRYPTO_SYMBOLS.length)];
      const amount = Math.random() * 1000 + 100;
      const price = Math.random() * 50000 + 1000;
      const usdValue = amount * price;

      const alert: WhaleAlert = {
        id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        amount,
        from: Math.random() > 0.5 ? 'Unknown Wallet' : 'Exchange Outflow',
        to: Math.random() > 0.5 ? 'Unknown Wallet' : 'Exchange Inflow',
        timestamp: new Date(),
        usdValue,
        isExchangeInflow: Math.random() > 0.5,
        isExchangeOutflow: Math.random() > 0.5,
      };

      this.recentAlerts.unshift(alert);
      if (this.recentAlerts.length > this.maxAlerts) {
        this.recentAlerts.pop();
      }

      redisService.publish('whale:alerts', alert).catch(err => {
        console.error('Error publishing whale alert:', err);
      });
    }
  }

  private async updateOnChainMetrics(): Promise<void> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

    for (const symbol of CRYPTO_SYMBOLS) {
      const symbolAlerts = this.recentAlerts.filter(
        a => a.symbol === symbol && a.timestamp >= cutoff
      );

      const largeTransfers = symbolAlerts.length;
      const exchangeInflows = symbolAlerts
        .filter(a => a.isExchangeInflow)
        .reduce((sum, a) => sum + a.usdValue, 0);
      const exchangeOutflows = symbolAlerts
        .filter(a => a.isExchangeOutflow)
        .reduce((sum, a) => sum + a.usdValue, 0);
      const netExchangeFlow = exchangeOutflows - exchangeInflows;

      // Determine bias based on flows
      let bias: OnChainBias = 'Neutral';
      const flowRatio = exchangeInflows + exchangeOutflows > 0
        ? netExchangeFlow / (exchangeInflows + exchangeOutflows)
        : 0;

      if (flowRatio > 0.2) bias = 'Accumulation';
      else if (flowRatio < -0.2) bias = 'Distribution';

      const metrics: OnChainMetrics = {
        symbol,
        timestamp: now,
        largeTransfers24h: largeTransfers,
        exchangeInflows24h: exchangeInflows,
        exchangeOutflows24h: exchangeOutflows,
        netExchangeFlow,
        bias,
      };

      // Cache in Redis
      await redisService.set(`onchain:${symbol}`, JSON.stringify(metrics), 3600);
    }
  }

  getRecentAlerts(symbol?: string, limit = 20): WhaleAlert[] {
    let alerts = this.recentAlerts;
    if (symbol) {
      alerts = alerts.filter(a => a.symbol === symbol);
    }
    return alerts.slice(0, limit);
  }

  async getOnChainMetrics(symbol: string): Promise<OnChainMetrics | null> {
    const data = await redisService.get(`onchain:${symbol}`);
    if (data) {
      return JSON.parse(data);
    }
    
    // Return default metrics if none cached
    return {
      symbol,
      timestamp: new Date(),
      largeTransfers24h: 0,
      exchangeInflows24h: 0,
      exchangeOutflows24h: 0,
      netExchangeFlow: 0,
      bias: 'Neutral',
    };
  }

  async getAllOnChainMetrics(): Promise<Record<string, OnChainMetrics>> {
    const result: Record<string, OnChainMetrics> = {};
    
    for (const symbol of CRYPTO_SYMBOLS) {
      const metrics = await this.getOnChainMetrics(symbol);
      if (metrics) {
        result[symbol] = metrics;
      }
    }
    
    return result;
  }
}

export const onchainEngine = new OnChainEngine();
