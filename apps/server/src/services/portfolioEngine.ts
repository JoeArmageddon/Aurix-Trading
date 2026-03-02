import { firebaseService } from './firebaseService.js';
import { redisService } from './redisService.js';
import type { 
  PortfolioItem, 
  PortfolioMetrics, 
  CorrelationWarning,
  AssetType,
  UserPlan 
} from '@aurix/types';
import { hasReachedLimit } from '@aurix/utils';

interface PortfolioPosition {
  symbol: string;
  assetType: AssetType;
  entryPrice: number;
  quantity: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

class PortfolioEngine {
  async addPosition(
    userId: string,
    asset: string,
    entryPrice: number,
    quantity: number,
    assetType: AssetType,
    userPlan: UserPlan
  ): Promise<PortfolioItem> {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid userId');
    }
    
    if (!asset || typeof asset !== 'string') {
      throw new Error('Invalid asset symbol');
    }
    
    if (typeof entryPrice !== 'number' || entryPrice <= 0 || !isFinite(entryPrice)) {
      throw new Error('Entry price must be a positive number');
    }
    
    if (typeof quantity !== 'number' || quantity <= 0 || !isFinite(quantity)) {
      throw new Error('Quantity must be a positive number');
    }
    
    if (!['crypto', 'stock'].includes(assetType)) {
      throw new Error('Asset type must be "crypto" or "stock"');
    }

    // Check limits for free users
    if (userPlan === 'free') {
      const currentCount = await firebaseService.countPortfolioItems(userId);
      if (hasReachedLimit(userPlan, 'maxPortfolioAssets', currentCount)) {
        throw new Error('Free plan limited to 10 portfolio positions. Upgrade to Pro.');
      }
    }

    const item: Omit<PortfolioItem, 'id'> = {
      userId,
      asset: asset.toUpperCase(), // Normalize symbol
      entryPrice,
      quantity,
      assetType,
      addedAt: new Date(),
    };

    return firebaseService.createPortfolioItem(item);
  }

  async updatePosition(
    itemId: string,
    updates: Partial<PortfolioItem>
  ): Promise<void> {
    await firebaseService.updatePortfolioItem(itemId, updates);
  }

  async removePosition(itemId: string): Promise<void> {
    await firebaseService.deletePortfolioItem(itemId);
  }

  async getUserPortfolio(userId: string): Promise<PortfolioItem[]> {
    return firebaseService.getPortfolioItems(userId);
  }

  async calculatePortfolioMetrics(userId: string): Promise<PortfolioMetrics> {
    const items = await this.getUserPortfolio(userId);
    
    if (items.length === 0) {
      return {
        totalValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        exposureBreakdown: {},
        riskScore: 0,
        correlationWarnings: [],
      };
    }

    // Get current prices
    const positions: PortfolioPosition[] = [];
    for (const item of items) {
      const currentPrice = await redisService.getPrice(item.asset) || item.entryPrice;
      const value = currentPrice * item.quantity;
      const cost = item.entryPrice * item.quantity;
      const pnl = value - cost;
      const pnlPercent = (pnl / cost) * 100;

      positions.push({
        symbol: item.asset,
        assetType: item.assetType,
        entryPrice: item.entryPrice,
        quantity: item.quantity,
        currentPrice,
        value,
        pnl,
        pnlPercent,
        weight: 0, // Will be calculated after total
      });
    }

    // Calculate totals
    const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
    const totalCost = items.reduce((sum, item) => sum + (item.entryPrice * item.quantity), 0);
    const totalPnL = totalValue - totalCost;
    
    // FIX: Handle division by zero
    let totalPnLPercent: number;
    if (totalCost === 0) {
      totalPnLPercent = 0;
      console.warn('Portfolio has zero cost basis for user:', userId);
    } else {
      totalPnLPercent = (totalPnL / totalCost) * 100;
    }

    // Calculate weights
    for (const pos of positions) {
      pos.weight = (pos.value / totalValue) * 100;
    }

    // Calculate exposure breakdown
    const exposureBreakdown: Record<string, number> = {};
    for (const pos of positions) {
      exposureBreakdown[pos.symbol] = pos.weight;
    }

    // Calculate risk score
    const riskScore = await this.calculateRiskScore(positions);

    // Check correlations
    const correlationWarnings = await this.checkCorrelations(positions);

    return {
      totalValue,
      totalPnL,
      totalPnLPercent,
      exposureBreakdown,
      riskScore,
      correlationWarnings,
    };
  }

  private async calculateRiskScore(positions: PortfolioPosition[]): Promise<number> {
    if (positions.length === 0) return 0;

    let totalWeightedRisk = 0;
    let totalWeight = 0;

    for (const pos of positions) {
      const metrics = await redisService.getMetrics(pos.symbol);
      const risk = metrics?.riskScore || 50;
      
      // Crypto is inherently riskier
      const adjustedRisk = pos.assetType === 'crypto' ? risk * 1.2 : risk;
      
      totalWeightedRisk += adjustedRisk * pos.weight;
      totalWeight += pos.weight;
    }

    // Concentration risk
    const maxPosition = Math.max(...positions.map(p => p.weight));
    const concentrationRisk = maxPosition > 30 ? (maxPosition - 30) * 2 : 0;

    const avgRisk = totalWeight > 0 ? totalWeightedRisk / totalWeight : 50;
    return Math.min(100, Math.round(avgRisk + concentrationRisk));
  }

  private async checkCorrelations(positions: PortfolioPosition[]): Promise<CorrelationWarning[]> {
    const warnings: CorrelationWarning[] = [];

    // Simple correlation check based on asset type and sector
    const cryptos = positions.filter(p => p.assetType === 'crypto');
    const stocks = positions.filter(p => p.assetType === 'stock');

    // High crypto concentration warning
    const cryptoWeight = cryptos.reduce((sum, p) => sum + p.weight, 0);
    if (cryptoWeight > 70) {
      warnings.push({
        assets: ['Crypto Portfolio', 'Portfolio'], // FIX: Use valid strings instead of empty
        correlation: cryptoWeight / 100,
        message: `High crypto exposure (${cryptoWeight.toFixed(1)}%). Consider diversification.`,
      });
    }

    // Similar crypto correlation (BTC and ETH often move together)
    const hasBTC = cryptos.some(p => p.symbol === 'BTC');
    const hasETH = cryptos.some(p => p.symbol === 'ETH');
    if (hasBTC && hasETH) {
      warnings.push({
        assets: ['BTC', 'ETH'],
        correlation: 0.85,
        message: 'BTC and ETH typically show high correlation. Consider reducing combined exposure.',
      });
    }

    // Check for concentrated single positions
    for (const pos of positions) {
      if (pos.weight > 40) {
        warnings.push({
          assets: [pos.symbol, ''],
          correlation: 1,
          message: `${pos.symbol} represents ${pos.weight.toFixed(1)}% of portfolio. High concentration risk.`,
        });
      }
    }

    return warnings.slice(0, 5);
  }

  async getPositionPnL(item: PortfolioItem): Promise<{
    pnl: number;
    pnlPercent: number;
    currentValue: number;
  }> {
    const currentPrice = await redisService.getPrice(item.asset) || item.entryPrice;
    const currentValue = currentPrice * item.quantity;
    const cost = item.entryPrice * item.quantity;
    const pnl = currentValue - cost;
    
    // FIX: Handle division by zero
    let pnlPercent: number;
    if (cost === 0) {
      pnlPercent = 0;
      console.warn(`Zero cost basis for position ${item.asset}`);
    } else {
      pnlPercent = (pnl / cost) * 100;
    }

    return { pnl, pnlPercent, currentValue };
  }
}

export const portfolioEngine = new PortfolioEngine();
