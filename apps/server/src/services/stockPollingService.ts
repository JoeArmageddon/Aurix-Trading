import axios from 'axios';
import { config } from '../config.js';
import { redisService } from './redisService.js';
import { metricsEngine } from './metricsEngine.js';
import { NIFTY_50_SYMBOLS, type StockAsset, type YahooFinanceData } from '@aurix/types';

class StockPollingService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly pollingInterval = 60000; // 60 seconds
  private isRunning = false;
  private priceHistory: Map<string, number[]> = new Map();
  private readonly maxHistoryLength = 100;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Initial fetch
    await this.fetchAllStocks();
    
    // Start polling
    this.intervalId = setInterval(() => {
      this.fetchAllStocks().catch(console.error);
    }, this.pollingInterval);

    console.log('Stock polling service started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Stock polling service stopped');
  }

  private async fetchAllStocks(): Promise<void> {
    try {
      // Fetch stocks in batches of 10 to avoid rate limits
      const batches = this.chunkArray([...NIFTY_50_SYMBOLS], 10);
      
      for (const batch of batches) {
        await Promise.all(batch.map(symbol => this.fetchStock(symbol)));
        // Small delay between batches
        await this.delay(1000);
      }
    } catch (error) {
      console.error('Error fetching stocks:', error);
    }
  }

  private async fetchStock(symbol: string): Promise<void> {
    try {
      // Using Yahoo Finance API (can be replaced with actual API key if available)
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const result = response.data.chart?.result?.[0];
      if (!result) {
        console.warn(`No data for ${symbol}`);
        return;
      }

      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];
      
      if (!meta || !quote) return;

      const price = meta.regularMarketPrice;
      const previousClose = meta.previousClose || meta.chartPreviousClose;
      const change24h = price - previousClose;
      const changePercent24h = (change24h / previousClose) * 100;
      const volume24h = meta.regularMarketVolume || 0;
      const high24h = meta.regularMarketDayHigh || price;
      const low24h = meta.regularMarketDayLow || price;

      // Update price history
      if (!this.priceHistory.has(symbol)) {
        this.priceHistory.set(symbol, []);
      }
      const history = this.priceHistory.get(symbol)!;
      history.push(price);
      if (history.length > this.maxHistoryLength) {
        history.shift();
      }

      const asset: StockAsset = {
        symbol: symbol.replace('.NS', ''),
        name: this.getStockName(symbol),
        type: 'stock',
        price,
        change24h,
        changePercent24h,
        volume24h,
        high24h,
        low24h,
        lastUpdated: new Date(),
        peRatio: meta.trailingPE,
        sector: this.getStockSector(symbol),
      };

      // Cache in Redis
      await redisService.setMarketData(symbol.replace('.NS', ''), {
        price,
        change24h,
        changePercent24h,
        volume24h,
        high24h,
        low24h,
        lastUpdated: new Date().toISOString(),
      });

      await redisService.setPrice(symbol.replace('.NS', ''), price);

      // Update metrics
      await metricsEngine.updateStockMetrics(symbol.replace('.NS', ''), asset, history);

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Stock not found, ignore
        return;
      }
      console.error(`Error fetching ${symbol}:`, error);
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getStockName(symbol: string): string {
    const names: Record<string, string> = {
      'RELIANCE.NS': 'Reliance Industries',
      'TCS.NS': 'Tata Consultancy Services',
      'HDFCBANK.NS': 'HDFC Bank',
      'INFY.NS': 'Infosys',
      'ICICIBANK.NS': 'ICICI Bank',
      'HINDUNILVR.NS': 'Hindustan Unilever',
      'SBIN.NS': 'State Bank of India',
      'BHARTIARTL.NS': 'Bharti Airtel',
      'ITC.NS': 'ITC Limited',
      'KOTAKBANK.NS': 'Kotak Mahindra Bank',
    };
    return names[symbol] || symbol.replace('.NS', '');
  }

  private getStockSector(symbol: string): string {
    const sectors: Record<string, string> = {
      'RELIANCE.NS': 'Energy',
      'TCS.NS': 'Technology',
      'HDFCBANK.NS': 'Financials',
      'INFY.NS': 'Technology',
      'ICICIBANK.NS': 'Financials',
      'HINDUNILVR.NS': 'Consumer Staples',
      'SBIN.NS': 'Financials',
      'BHARTIARTL.NS': 'Communication',
      'ITC.NS': 'Consumer Staples',
      'KOTAKBANK.NS': 'Financials',
    };
    return sectors[symbol] || 'Unknown';
  }

  getPriceHistory(symbol: string): number[] {
    return this.priceHistory.get(symbol) || [];
  }
}

export const stockPollingService = new StockPollingService();
