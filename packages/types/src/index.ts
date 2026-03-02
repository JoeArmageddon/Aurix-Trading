// ==================== ASSET TYPES ====================

export type AssetType = 'crypto' | 'stock';

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  lastUpdated: Date;
}

export interface CryptoAsset extends Asset {
  type: 'crypto';
  marketCap?: number;
}

export interface StockAsset extends Asset {
  type: 'stock';
  peRatio?: number;
  sector?: string;
}

// ==================== METRICS TYPES ====================

export interface AssetMetrics {
  symbol: string;
  timestamp: Date;
  trendScore: number; // 0-100
  momentumScore: number; // 0-100
  sentimentScore: number; // -100 to 100
  riskScore: number; // 0-100
  onChainBias: OnChainBias;
  volumeAnomaly: boolean;
  aiInsight: string;
}

export type OnChainBias = 'Accumulation' | 'Distribution' | 'Neutral';

// ==================== SENTIMENT TYPES ====================

export interface SentimentData {
  symbol: string;
  timestamp: Date;
  overallScore: number; // -100 to 100
  redditScore: number;
  twitterScore: number;
  fearGreedScore: number;
  newsToneScore: number;
  velocity: number;
  divergence: number;
}

export interface SentimentSnapshot {
  id: string;
  timestamp: Date;
  assets: Record<string, SentimentData>;
  globalSentiment: number;
}

// ==================== ON-CHAIN TYPES ====================

export interface WhaleAlert {
  id: string;
  symbol: string;
  amount: number;
  from: string;
  to: string;
  timestamp: Date;
  usdValue: number;
  isExchangeInflow: boolean;
  isExchangeOutflow: boolean;
}

export interface OnChainMetrics {
  symbol: string;
  timestamp: Date;
  largeTransfers24h: number;
  exchangeInflows24h: number;
  exchangeOutflows24h: number;
  netExchangeFlow: number;
  bias: OnChainBias;
}

// ==================== PORTFOLIO TYPES ====================

export interface PortfolioItem {
  id: string;
  userId: string;
  asset: string;
  entryPrice: number;
  quantity: number;
  addedAt: Date;
  assetType: AssetType;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  exposureBreakdown: Record<string, number>;
  riskScore: number;
  correlationWarnings: CorrelationWarning[];
}

export interface CorrelationWarning {
  assets: [string, string];
  correlation: number;
  message: string;
}

// ==================== ALERT TYPES ====================

export type AlertConditionOperator = '>' | '<' | '>=' | '<=' | '=' | '!=';

export interface AlertCondition {
  metric: 'price' | 'rsi' | 'sentiment' | 'volumeAnomaly' | 'whaleTransfer' | 'momentum' | 'trend';
  operator: AlertConditionOperator;
  value: number | boolean;
}

export type AlertConditionTree = 
  | AlertCondition
  | { and: AlertConditionTree[] }
  | { or: AlertConditionTree[] };

export interface Alert {
  id: string;
  userId: string;
  name: string;
  symbol: string;
  conditions: AlertConditionTree;
  isActive: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
}

export interface AlertLog {
  id: string;
  alertId: string;
  userId: string;
  symbol: string;
  triggeredAt: Date;
  metricsSnapshot: AssetMetrics;
  message: string;
}

// ==================== USER TYPES ====================

export type UserPlan = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  plan: UserPlan;
  aiUsageToday: number;
  aiUsageResetAt: Date;
  createdAt: Date;
  lastLoginAt: Date;
  emailVerified: boolean;
}

export interface UserSession {
  userId: string;
  email: string;
  plan: UserPlan;
  token: string;
  expiresAt: Date;
}

// ==================== AI TYPES ====================

export interface AIAnalysisRequest {
  symbol: string;
  metrics: AssetMetrics;
  historicalContext?: string;
  userPlan: UserPlan;
  userId?: string;
}

export interface AIAnalysisResponse {
  symbol: string;
  analysis: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  keyPoints: string[];
  generatedAt: Date;
}

export interface AIReport {
  id: string;
  timestamp: Date;
  period: '4h' | 'daily';
  marketBias: 'bullish' | 'bearish' | 'neutral';
  riskZones: string[];
  assetsToWatch: string[];
  summary: string;
  cryptoMetrics: Record<string, AssetMetrics>;
  niftyMetrics: Record<string, AssetMetrics>;
  sentimentOverview: string;
  whaleSummary: string;
}

// ==================== MARKET DATA TYPES ====================

export interface BinanceStreamData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
  p: string; // Price change
  P: string; // Price change percent
  w: string; // Weighted average price
  x: string; // First trade ID
  Q: string; // Last quantity
  F: number; // First trade ID
  L: number; // Last trade ID
  n: number; // Total number of trades
}

export interface YahooFinanceData {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketOpen: number;
  regularMarketPreviousClose: number;
}

// ==================== WATCHLIST TYPES ====================

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  symbols: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ==================== REAL-TIME TYPES ====================

export interface MarketPulse {
  timestamp: Date;
  globalSentiment: number;
  cryptoDominance: number;
  fearGreedIndex: number;
  marketPulseScore: number;
}

export interface TopMover {
  symbol: string;
  changePercent: number;
  volume: number;
  type: AssetType;
}

// ==================== FREEMIUM LIMITS ====================

export const FREEMIUM_LIMITS = {
  free: {
    maxWatchlistAssets: 3,
    maxAlerts: 2,
    maxAiUsagePerDay: 5,
    maxPortfolioAssets: 10,
    reportAccess: false,
  },
  pro: {
    maxWatchlistAssets: 50,
    maxAlerts: -1, // unlimited
    maxAiUsagePerDay: -1, // unlimited
    maxPortfolioAssets: 100,
    reportAccess: true,
  },
} as const;

// ==================== CRYPTO CONSTANTS ====================

export const TOP_10_CRYPTO = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'DOGEUSDT',
  'LINKUSDT',
  'MATICUSDT',
] as const;

export const CRYPTO_SYMBOLS = TOP_10_CRYPTO.map(s => s.replace('USDT', ''));

// ==================== NIFTY 50 CONSTANTS ====================

export const NIFTY_50_SYMBOLS = [
  'RELIANCE.NS',
  'TCS.NS',
  'HDFCBANK.NS',
  'INFY.NS',
  'ICICIBANK.NS',
  'HINDUNILVR.NS',
  'SBIN.NS',
  'BHARTIARTL.NS',
  'ITC.NS',
  'KOTAKBANK.NS',
  'LT.NS',
  'BAJFINANCE.NS',
  'AXISBANK.NS',
  'ASIANPAINT.NS',
  'MARUTI.NS',
  'TITAN.NS',
  'SUNPHARMA.NS',
  'HCLTECH.NS',
  'ADANIENT.NS',
  'WIPRO.NS',
  'ULTRACEMCO.NS',
  'NESTLEIND.NS',
  'POWERGRID.NS',
  'JSWSTEEL.NS',
  'NTPC.NS',
  'TATAMOTORS.NS',
  'M&M.NS',
  'GRASIM.NS',
  'COALINDIA.NS',
  'TECHM.NS',
  'TATASTEEL.NS',
  'HDFCLIFE.NS',
  'BAJAJFINSV.NS',
  'BRITANNIA.NS',
  'INDUSINDBK.NS',
  'CIPLA.NS',
  'ONGC.NS',
  'EICHERMOT.NS',
  'DIVISLAB.NS',
  'APOLLOHOSP.NS',
  'HEROMOTOCO.NS',
  'BPCL.NS',
  'ADANIPORTS.NS',
  'DRREDDY.NS',
  'SBILIFE.NS',
  'HINDALCO.NS',
  'UPL.NS',
  'TATACONSUM.NS',
  'IOC.NS',
  'BAJAJ-AUTO.NS',
] as const;

// ==================== WEBSOCKET MESSAGE TYPES ====================

export interface WSMessage<T = unknown> {
  type: 'price' | 'metrics' | 'sentiment' | 'alert' | 'error' | 'connected' | 'subscribed' | 'unsubscribed';
  channel?: string;
  symbol?: string;
  data?: T;
  timestamp: number;
}
