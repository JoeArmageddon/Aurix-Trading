import { redisService } from './redisService.js';
import { sentimentEngine } from './sentimentEngine.js';
import { onchainEngine } from './onchainEngine.js';
import type { Asset, AssetMetrics, CryptoAsset, StockAsset } from '@aurix/types';

class MetricsEngine {
  private priceHistory: Map<string, number[]> = new Map();
  private readonly maxHistoryLength = 100;

  async updateCryptoMetrics(symbol: string, asset: CryptoAsset, history: number[]): Promise<AssetMetrics> {
    this.priceHistory.set(symbol, history);
    return this.calculateMetrics(symbol, asset);
  }

  async updateStockMetrics(symbol: string, asset: StockAsset, history: number[]): Promise<AssetMetrics> {
    this.priceHistory.set(symbol, history);
    return this.calculateMetrics(symbol, asset);
  }

  private async calculateMetrics(symbol: string, asset: Asset): Promise<AssetMetrics> {
    const history = this.priceHistory.get(symbol) || [];
    
    // Calculate trend score (0-100)
    const trendScore = this.calculateTrendScore(history);
    
    // Calculate momentum score (0-100)
    const momentumScore = this.calculateMomentumScore(history);
    
    // Get sentiment score (-100 to 100)
    const sentimentData = sentimentEngine.getSentiment(symbol);
    const sentimentScore = sentimentData?.overallScore || 0;
    
    // Calculate risk score (0-100)
    const riskScore = this.calculateRiskScore(history, asset);
    
    // Get on-chain bias for crypto
    let onChainBias: AssetMetrics['onChainBias'] = 'Neutral';
    if (asset.type === 'crypto') {
      // Type guard ensures asset is CryptoAsset
      const cryptoAsset = asset as import('@aurix/types').CryptoAsset;
      const onchainMetrics = await onchainEngine.getOnChainMetrics(cryptoAsset.symbol);
      onChainBias = onchainMetrics?.bias || 'Neutral';
    }
    
    // Detect volume anomaly
    const volumeAnomaly = this.detectVolumeAnomaly(asset);
    
    // Generate AI insight
    const aiInsight = this.generateInsight(symbol, asset, {
      trendScore,
      momentumScore,
      sentimentScore,
      riskScore,
      onChainBias,
      volumeAnomaly,
    });

    const metrics: AssetMetrics = {
      symbol,
      timestamp: new Date(),
      trendScore,
      momentumScore,
      sentimentScore,
      riskScore,
      onChainBias,
      volumeAnomaly,
      aiInsight,
    };

    // Cache in Redis
    await redisService.setMetrics(symbol, metrics);

    return metrics;
  }

  private calculateTrendScore(prices: number[]): number {
    if (prices.length < 10) return 50;

    const shortTerm = this.calculateSMA(prices, 10);
    const mediumTerm = prices.length >= 20 ? this.calculateSMA(prices, 20) : shortTerm;

    if (mediumTerm === 0) return 50;

    const trendStrength = ((shortTerm - mediumTerm) / mediumTerm) * 100;
    
    // Normalize to 0-100 score
    // Strong uptrend = 100, strong downtrend = 0
    return Math.min(100, Math.max(0, 50 + trendStrength * 2));
  }

  private calculateMomentumScore(prices: number[]): number {
    if (prices.length < 14) return 50;

    // RSI calculation
    const rsi = this.calculateRSI(prices, 14);
    
    // Normalize RSI (0-100) to momentum score
    // RSI > 70 = overbought (high momentum but risky)
    // RSI < 30 = oversold (potential reversal)
    // RSI 40-60 = neutral
    return rsi;
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  private calculateRiskScore(prices: number[], asset: Asset): number {
    if (prices.length < 2) return 50;

    // Calculate volatility (standard deviation of returns)
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * 100; // Convert to percentage

    // Normalize volatility to 0-100 risk score
    // 0% volatility = 0 risk, 10%+ volatility = 100 risk
    let riskScore = Math.min(100, volatility * 10);

    // Adjust for asset type
    if (asset.type === 'stock') {
      // Stocks generally less risky
      riskScore *= 0.8;
    }

    // FIX: Ensure bounds after adjustment
    return Math.min(100, Math.max(0, Math.round(riskScore)));
  }

  private detectVolumeAnomaly(asset: Asset): boolean {
    // FIX: Use a more reasonable approach - detect unusual price volatility
    // as a proxy for volume anomaly (high price moves often correlate with volume spikes)
    if (!asset.volume24h || asset.volume24h <= 0) {
      return false;
    }
    
    // A volume anomaly would typically be 2-3 standard deviations from mean
    // Since we don't have historical volume data, use price change as a proxy
    const isHighPriceVolatility = Math.abs(asset.changePercent24h) > 5;
    
    return isHighPriceVolatility;
  }

  private generateInsight(
    symbol: string,
    asset: Asset,
    metrics: Pick<AssetMetrics, 'trendScore' | 'momentumScore' | 'sentimentScore' | 'riskScore' | 'onChainBias' | 'volumeAnomaly'>
  ): string {
    const insights: string[] = [];

    // Trend insight
    if (metrics.trendScore > 70) {
      insights.push('Strong uptrend in play');
    } else if (metrics.trendScore < 30) {
      insights.push('Downtrend persists');
    } else {
      insights.push('Consolidating');
    }

    // Momentum insight
    if (metrics.momentumScore > 70) {
      insights.push('overbought conditions');
    } else if (metrics.momentumScore < 30) {
      insights.push('oversold bounce potential');
    }

    // Sentiment insight
    if (metrics.sentimentScore > 50) {
      insights.push('bullish social sentiment');
    } else if (metrics.sentimentScore < -50) {
      insights.push('bearish crowd positioning');
    }

    // Risk insight
    if (metrics.riskScore > 70) {
      insights.push('elevated volatility');
    }

    // On-chain insight (crypto only)
    if (asset.type === 'crypto' && metrics.onChainBias !== 'Neutral') {
      insights.push(`${metrics.onChainBias.toLowerCase()} on-chain signals`);
    }

    // Volume insight
    if (metrics.volumeAnomaly) {
      insights.push('unusual volume spike');
    }

    return insights.join(', ') || 'Stable conditions';
  }

  async getMetrics(symbol: string): Promise<AssetMetrics | null> {
    return redisService.getMetrics(symbol);
  }

  async getAllMetrics(): Promise<Record<string, AssetMetrics>> {
    return redisService.getAllMetrics();
  }

  async getMarketPulse(): Promise<{
    globalSentiment: number;
    cryptoDominance: number;
    fearGreedIndex: number;
    marketPulseScore: number;
  }> {
    const allMetrics = await this.getAllMetrics();
    const sentimentData = sentimentEngine.getAllSentiment();
    
    // Calculate global sentiment
    let totalSentiment = 0;
    let count = 0;
    for (const metrics of Object.values(allMetrics)) {
      totalSentiment += metrics.sentimentScore;
      count++;
    }
    const globalSentiment = count > 0 ? Math.round(totalSentiment / count) : 0;

    // Get Fear & Greed Index
    const fearGreedIndex = sentimentEngine.getFearGreedIndex();

    // Calculate market pulse score (composite)
    const cryptoMetrics = Object.values(allMetrics).filter(m => 
      !m.symbol.includes('.NS')
    );
    
    let pulseScore = 50;
    if (cryptoMetrics.length > 0) {
      const avgTrend = cryptoMetrics.reduce((sum, m) => sum + m.trendScore, 0) / cryptoMetrics.length;
      const avgMomentum = cryptoMetrics.reduce((sum, m) => sum + m.momentumScore, 0) / cryptoMetrics.length;
      pulseScore = Math.round((avgTrend + avgMomentum) / 2);
    }

    return {
      globalSentiment,
      cryptoDominance: 65, // Placeholder
      fearGreedIndex,
      marketPulseScore: pulseScore,
    };
  }
}

export const metricsEngine = new MetricsEngine();
