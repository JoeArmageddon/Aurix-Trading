import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Binance
  binanceWsUrl: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws',
  
  // Yahoo Finance
  yahooApiKey: process.env.YAHOO_API_KEY,
  
  // Reddit
  redditClientId: process.env.REDDIT_CLIENT_ID,
  redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
  redditUserAgent: process.env.REDDIT_USER_AGENT || 'AurixTrading/1.0',
  
  // Fear & Greed
  fearGreedApi: process.env.FEAR_GREED_API || 'https://api.alternative.me/fng/',
  
  // Whale Alert
  whaleAlertApiKey: process.env.WHALE_ALERT_API_KEY,
  
  // AI APIs
  geminiApiKey: process.env.GEMINI_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  
  // Redis
  upstashRedisUrl: process.env.UPSTASH_REDIS_URL,
  upstashRedisToken: process.env.UPSTASH_REDIS_TOKEN,
  
  // Firebase
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  
  // Resend
  resendApiKey: process.env.RESEND_API_KEY,
  
  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
} as const;

export function validateConfig(): void {
  const required = [
    'upstashRedisUrl',
    'upstashRedisToken',
    'firebaseProjectId',
    'firebaseClientEmail',
    'firebasePrivateKey',
  ];
  
  const missing = required.filter(key => !config[key as keyof typeof config]);
  
  if (missing.length > 0) {
    console.warn(`Missing optional config: ${missing.join(', ')}`);
  }
}
