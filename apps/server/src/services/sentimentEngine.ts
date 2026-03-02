import axios from 'axios';
import { config } from '../config.js';
import { firebaseService } from './firebaseService.js';
import { CRYPTO_SYMBOLS, NIFTY_50_SYMBOLS, type SentimentData } from '@aurix/types';
import { formatSymbolForDisplay } from '@aurix/utils';

interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  upvote_ratio: number;
  num_comments: number;
  created_utc: number;
}

interface FearGreedData {
  value: number;
  value_classification: string;
  timestamp: string;
}

class SentimentEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly updateInterval = 3600000; // 1 hour
  
  // In-memory cache for sentiment scores
  private sentimentCache: Map<string, SentimentData> = new Map();
  private readonly maxCacheSize = 200; // Add limit
  private cacheAccessOrder: string[] = []; // LRU tracking
  
  // Last Fear & Greed value
  private fearGreedValue = 50;
  private lastRedditCall = 0; // Rate limiting
  private readonly redditMinInterval = 2000; // 2 seconds between calls

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Initial fetch
    await this.updateAllSentiment();

    // Schedule periodic updates with protection
    let isUpdating = false;
    this.intervalId = setInterval(async () => {
      if (isUpdating) {
        console.warn('Previous sentiment update still running, skipping this cycle');
        return;
      }
      
      isUpdating = true;
      try {
        await this.updateAllSentiment();
      } catch (error) {
        console.error('Error in scheduled sentiment update:', error);
      } finally {
        isUpdating = false;
      }
    }, this.updateInterval);

    console.log('Sentiment engine started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Sentiment engine stopped');
  }

  private async updateAllSentiment(): Promise<void> {
    try {
      // Fetch global Fear & Greed Index
      await this.fetchFearGreedIndex();

      // Update sentiment for all crypto symbols
      for (const symbol of CRYPTO_SYMBOLS) {
        await this.calculateSentiment(symbol, 'crypto');
      }

      // Update sentiment for major Indian stocks (top 10)
      const topStocks = NIFTY_50_SYMBOLS.slice(0, 10);
      for (const symbol of topStocks) {
        await this.calculateSentiment(formatSymbolForDisplay(symbol), 'stock');
      }

      // Store snapshot in Firestore
      await this.storeSentimentSnapshot();

      console.log('Sentiment update completed');
    } catch (error) {
      console.error('Error updating sentiment:', error);
    }
  }

  private async fetchFearGreedIndex(): Promise<void> {
    try {
      const response = await axios.get(`${config.fearGreedApi}?limit=1`, {
        timeout: 10000,
      });

      const data: FearGreedData = response.data.data?.[0];
      if (data) {
        this.fearGreedValue = parseInt(data.value);
        console.log(`Fear & Greed Index: ${this.fearGreedValue} (${data.value_classification})`);
      }
    } catch (error) {
      console.error('Error fetching Fear & Greed Index:', error);
    }
  }

  private async calculateSentiment(symbol: string, type: 'crypto' | 'stock'): Promise<SentimentData> {
    const now = new Date();
    
    // Fetch Reddit data
    const redditScore = await this.fetchRedditSentiment(symbol, type);
    
    // Calculate Twitter score (placeholder - would need Twitter API)
    const twitterScore = this.calculateTwitterSentiment(symbol);
    
    // Fear & Greed for crypto, market sentiment for stocks
    const fearGreedScore = type === 'crypto' 
      ? this.fearGreedValue 
      : this.calculateMarketSentiment();
    
    // News tone score (placeholder)
    const newsToneScore = this.calculateNewsTone(symbol);

    // Weighted formula:
    // Reddit: 35%, Twitter: 25%, FearGreed: 25%, NewsTone: 15%
    const overallScore = Math.round(
      redditScore * 0.35 +
      twitterScore * 0.25 +
      fearGreedScore * 0.25 +
      newsToneScore * 0.15
    );

    // Calculate velocity (change from previous)
    const previousData = this.sentimentCache.get(symbol);
    const velocity = previousData 
      ? overallScore - previousData.overallScore 
      : 0;

    // Calculate divergence (would need price data)
    const divergence = 0; // Placeholder

    const sentimentData: SentimentData = {
      symbol,
      timestamp: now,
      overallScore: this.clamp(overallScore, -100, 100),
      redditScore,
      twitterScore,
      fearGreedScore,
      newsToneScore,
      velocity,
      divergence,
    };

    this.setSentimentCache(symbol, sentimentData);
    return sentimentData;
  }

  private async fetchRedditSentiment(symbol: string, type: 'crypto' | 'stock'): Promise<number> {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastCall = now - this.lastRedditCall;
      if (timeSinceLastCall < this.redditMinInterval) {
        await new Promise(resolve => setTimeout(resolve, this.redditMinInterval - timeSinceLastCall));
      }
      this.lastRedditCall = Date.now();

      // Use fixed subreddit lists
      const cryptoSubreddits = ['cryptocurrency', 'bitcoin', 'ethfinance', 'CryptoMarkets'];
      const stockSubreddits = ['IndianStreetBets', 'IndiaInvestments'];
      
      const subreddits = type === 'crypto' ? cryptoSubreddits : stockSubreddits;
      const subredditParam = subreddits.join('+');
      
      const searchQuery = type === 'crypto' 
        ? `${symbol} crypto` 
        : `${symbol} stock`;

      const url = `https://www.reddit.com/r/${subredditParam}/search.json?q=${encodeURIComponent(searchQuery)}&sort=hot&limit=25&t=day`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': config.redditUserAgent,
        },
        timeout: 10000,
      });

      const posts: RedditPost[] = response.data.data?.children?.map((child: { data: RedditPost }) => child.data) || [];
      
      if (posts.length === 0) return 0;

      // Calculate weighted sentiment based on upvotes and engagement
      let totalScore = 0;
      let totalWeight = 0;

      for (const post of posts) {
        const weight = post.score * post.upvote_ratio;
        
        // Simple sentiment analysis based on keywords
        const text = `${post.title} ${post.selftext}`.toLowerCase();
        const sentiment = this.analyzeTextSentiment(text);
        
        totalScore += sentiment * weight;
        totalWeight += weight;
      }

      const normalizedScore = totalWeight > 0 
        ? (totalScore / totalWeight) * 100 
        : 0;

      return this.clamp(normalizedScore, -100, 100);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        console.error(`Reddit rate limit hit for ${symbol}`);
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
      console.error(`Error fetching Reddit sentiment for ${symbol}:`, error);
      return 0;
    }
  }

  private analyzeTextSentiment(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0; // Neutral for empty text
    }

    const positiveWords = ['bull', 'bullish', 'moon', 'pump', 'gain', 'profit', 'up', 'rise', 'growth', 'good', 'great', 'strong', 'buy', 'long'];
    const negativeWords = ['bear', 'bearish', 'dump', 'crash', 'loss', 'down', 'fall', 'decline', 'bad', 'weak', 'sell', 'short', 'panic'];

    let score = 0;
    let matches = 0;

    const words = text.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length === 0) continue;
      
      if (positiveWords.includes(cleanWord)) {
        score += 1;
        matches++;
      } else if (negativeWords.includes(cleanWord)) {
        score -= 1;
        matches++;
      }
    }

    if (matches === 0) return 0;
    
    // Normalize to -1 to 1 range
    return score / matches;
  }

  private calculateTwitterSentiment(symbol: string): number {
    // Placeholder - would require Twitter/X API access
    // Return neutral sentiment for now
    return 0;
  }

  private calculateMarketSentiment(): number {
    // For Indian stocks, derive from general market conditions
    // This is a simplified calculation
    return 0;
  }

  private calculateNewsTone(symbol: string): number {
    // Placeholder - would require news API integration
    return 0;
  }

  private async storeSentimentSnapshot(): Promise<void> {
    try {
      const snapshot = {
        timestamp: new Date(),
        assets: Object.fromEntries(this.sentimentCache),
        globalSentiment: this.calculateGlobalSentiment(),
      };

      await firebaseService.createSentimentSnapshot(snapshot);
    } catch (error) {
      console.error('Error storing sentiment snapshot:', error);
    }
  }

  private calculateGlobalSentiment(): number {
    if (this.sentimentCache.size === 0) return 0;
    
    let total = 0;
    for (const data of this.sentimentCache.values()) {
      total += data.overallScore;
    }
    
    return Math.round(total / this.sentimentCache.size);
  }

  getSentiment(symbol: string): SentimentData | undefined {
    const data = this.sentimentCache.get(symbol);
    if (data) {
      // Update LRU
      this.updateLRU(symbol);
    }
    return data;
  }

  private setSentimentCache(symbol: string, data: SentimentData): void {
    // Enforce size limit
    if (this.sentimentCache.size >= this.maxCacheSize && !this.sentimentCache.has(symbol)) {
      const oldest = this.cacheAccessOrder.shift();
      if (oldest) {
        this.sentimentCache.delete(oldest);
      }
    }
    
    this.sentimentCache.set(symbol, data);
    this.updateLRU(symbol);
  }

  private updateLRU(symbol: string): void {
    const index = this.cacheAccessOrder.indexOf(symbol);
    if (index > -1) {
      this.cacheAccessOrder.splice(index, 1);
    }
    this.cacheAccessOrder.push(symbol);
  }

  getAllSentiment(): Map<string, SentimentData> {
    return new Map(this.sentimentCache);
  }

  getFearGreedIndex(): number {
    return this.fearGreedValue;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

export const sentimentEngine = new SentimentEngine();
