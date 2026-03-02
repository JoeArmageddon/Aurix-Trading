import type { AlertCondition, AlertConditionTree, AssetMetrics, UserPlan } from '@aurix/types';
import { FREEMIUM_LIMITS } from '@aurix/types';

// ==================== DATE UTILS ====================

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function formatRelativeTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'invalid date';
  }
  
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const isFuture = diff < 0;
  const absDiff = Math.abs(diff);
  
  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  let result: string;
  if (seconds < 60) result = 'just now';
  else if (minutes < 60) result = `${minutes}m ago`;
  else if (hours < 24) result = `${hours}h ago`;
  else result = `${days}d ago`;
  
  return isFuture ? `in ${result.replace(' ago', '')}` : result;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

// ==================== NUMBER UTILS ====================

export function formatPrice(price: number, decimals = 2): string {
  if (price === null || price === undefined || isNaN(price)) {
    return '—';
  }
  if (decimals < 0) decimals = 0;
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return price.toFixed(decimals);
}

export function formatPercent(value: number, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '—%';
  }
  const safeDecimals = Math.max(0, Math.min(20, decimals));
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(safeDecimals)}%`;
}

export function formatCompactNumber(num: number): string {
  if (num === null || num === undefined || isNaN(num)) return '—';
  if (num === 0) return '0';
  
  const absNum = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  let formatted: string;
  
  if (absNum >= 1e12) formatted = (absNum / 1e12).toFixed(1) + 'T';
  else if (absNum >= 1e9) formatted = (absNum / 1e9).toFixed(1) + 'B';
  else if (absNum >= 1e6) formatted = (absNum / 1e6).toFixed(1) + 'M';
  else if (absNum >= 1e3) formatted = (absNum / 1e3).toFixed(1) + 'K';
  else formatted = absNum.toString();
  
  return sign + formatted;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalizeScore(value: number, min: number, max: number): number {
  if (max === min) return 50; // Return middle value when range is zero
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

// ==================== ALERT EVALUATION ====================

export function evaluateCondition(
  condition: AlertCondition,
  metrics: AssetMetrics
): boolean {
  let actualValue: number | boolean;

  switch (condition.metric) {
    case 'price':
      // Price would need to be fetched separately or stored in metrics
      return false;
    case 'rsi':
      // RSI calculated from momentum score
      actualValue = metrics.momentumScore;
      break;
    case 'sentiment':
      actualValue = metrics.sentimentScore;
      break;
    case 'momentum':
      actualValue = metrics.momentumScore;
      break;
    case 'trend':
      actualValue = metrics.trendScore;
      break;
    case 'volumeAnomaly':
      actualValue = metrics.volumeAnomaly;
      break;
    case 'whaleTransfer':
      // Whale transfers would need separate tracking
      return false;
    default:
      return false;
  }

  if (typeof condition.value === 'boolean' || typeof actualValue === 'boolean') {
    return actualValue === condition.value;
  }

  const expected = condition.value as number;
  const actual = actualValue as number;

  switch (condition.operator) {
    case '>':
      return actual > expected;
    case '<':
      return actual < expected;
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    case '=':
      return actual === expected;
    case '!=':
      return actual !== expected;
    default:
      return false;
  }
}

export function evaluateConditionTree(
  tree: AlertConditionTree,
  metrics: AssetMetrics
): boolean {
  if ('and' in tree) {
    return tree.and.every(child => evaluateConditionTree(child, metrics));
  }
  if ('or' in tree) {
    return tree.or.some(child => evaluateConditionTree(child, metrics));
  }
  return evaluateCondition(tree, metrics);
}

// ==================== FREEMIUM UTILS ====================

export function canUseFeature(
  plan: UserPlan,
  feature: keyof typeof FREEMIUM_LIMITS.free
): boolean {
  const limits = FREEMIUM_LIMITS[plan];
  if (limits[feature] === -1) return true;
  if (limits[feature] === false) return false;
  return true;
}

export function getFeatureLimit(
  plan: UserPlan,
  feature: 'maxWatchlistAssets' | 'maxAlerts' | 'maxAiUsagePerDay' | 'maxPortfolioAssets'
): number {
  return FREEMIUM_LIMITS[plan][feature];
}

export function hasReachedLimit(
  plan: UserPlan,
  feature: 'maxWatchlistAssets' | 'maxAlerts' | 'maxAiUsagePerDay' | 'maxPortfolioAssets',
  current: number
): boolean {
  const limit = getFeatureLimit(plan, feature);
  if (limit === -1) return false;
  return current >= limit;
}

// ==================== CRYPTO UTILS ====================

export function isCryptoSymbol(symbol: string): boolean {
  // Crypto symbols don't have exchange suffixes
  return !symbol.includes('.');
}

export function formatSymbolForDisplay(symbol: string): string {
  if (symbol.endsWith('USDT')) {
    return symbol.replace('USDT', '');
  }
  if (symbol.endsWith('.NS')) {
    return symbol.replace('.NS', '');
  }
  return symbol;
}

export function formatSymbolForBinance(symbol: string): string {
  if (!symbol) return '';
  const upperSymbol = symbol.toUpperCase();
  if (!upperSymbol.includes('USDT')) {
    return `${upperSymbol}USDT`;
  }
  return upperSymbol;
}

export function formatSymbolForYahoo(symbol: string, exchange: 'NS' | 'BO' | 'US' = 'NS'): string {
  if (!symbol) return '';
  if (symbol.includes('.')) return symbol; // Already has exchange suffix
  
  // US stocks typically don't have suffixes on Yahoo Finance
  if (exchange === 'US') return symbol;
  
  return `${symbol}.${exchange}`;
}

// ==================== COLOR UTILS ====================

export function getScoreColor(score: number, type: 'positive' | 'negative' = 'positive'): string {
  if (score === null || score === undefined || isNaN(score)) {
    return '#6B7280'; // gray-500 for unknown
  }
  
  if (type === 'positive') {
    if (score >= 70) return '#10B981'; // green-500
    if (score >= 40) return '#F59E0B'; // amber-500
    return '#EF4444'; // red-500
  }
  // For negative metrics (like risk)
  if (score >= 70) return '#EF4444'; // red-500
  if (score >= 40) return '#F59E0B'; // amber-500
  return '#10B981'; // green-500
}

export function getSentimentColor(score: number): string {
  if (score >= 50) return '#10B981'; // Very positive
  if (score >= 20) return '#34D399'; // Positive
  if (score > -20) return '#9CA3AF'; // Neutral
  if (score > -50) return '#F87171'; // Negative
  return '#EF4444'; // Very negative
}

// ==================== VALIDATION ====================

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  // More comprehensive regex: local@domain.tld (tld at least 2 chars)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(email)) return false;
  
  // Additional checks
  if (email.length > 254) return false; // RFC 5321
  const [local, domain] = email.split('@');
  if (local.length > 64) return false; // RFC 5321
  if (!domain || domain.length > 255) return false;
  
  return true;
}

export function isValidSymbol(symbol: string): boolean {
  if (!symbol || typeof symbol !== 'string') return false;
  return /^[A-Za-z0-9.-]+$/.test(symbol);
}

// ==================== ARRAY UTILS ====================

export function chunkArray<T>(array: T[], size: number): T[][] {
  if (!Array.isArray(array)) return [];
  if (size <= 0) throw new Error('Chunk size must be greater than 0');
  
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function uniqueArray<T>(array: T[]): T[] {
  return [...new Set(array)];
}

// ==================== LOCAL STORAGE UTILS (Client-side) ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const window: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getWindow = (): any => (typeof window !== 'undefined' ? window : undefined);

export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    const w = getWindow();
    if (!w) return defaultValue;
    try {
      const item = w.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: <T>(key: string, value: T): void => {
    const w = getWindow();
    if (!w) return;
    try {
      w.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  },
  remove: (key: string): void => {
    const w = getWindow();
    if (!w) return;
    try {
      w.localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  },
};

// ==================== DEBOUNCE/THROTTLE ====================

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
