import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { config } from '../config.js';
import { redisService } from './redisService.js';
import { firebaseService } from './firebaseService.js';
import type { AssetMetrics, AIAnalysisRequest, AIAnalysisResponse, AIReport, UserPlan, OnChainMetrics } from '@aurix/types';
import { CRYPTO_SYMBOLS, NIFTY_50_SYMBOLS } from '@aurix/types';
import { formatSymbolForDisplay } from '@aurix/utils';

// Initialize AI clients
let genAI: GoogleGenerativeAI | null = null;
let groq: Groq | null = null;

if (config.geminiApiKey) {
  genAI = new GoogleGenerativeAI(config.geminiApiKey);
}

if (config.groqApiKey) {
  groq = new Groq({ apiKey: config.groqApiKey });
}

class AIEngine {
  private isProcessing = false;

  async analyzeAsset(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const { symbol, metrics, userPlan } = request;

    // Check rate limit for free users
    if (userPlan === 'free') {
      const canAnalyze = await this.checkAiUsageLimit(request.userId || 'anonymous');
      if (!canAnalyze) {
        throw new Error('Daily AI analysis limit reached. Upgrade to Pro for unlimited access.');
      }
    }

    const prompt = this.buildAnalysisPrompt(symbol, metrics);
    
    try {
      // Try Gemini first
      if (genAI) {
        const analysis = await this.analyzeWithGemini(prompt);
        return this.parseAnalysisResponse(symbol, analysis);
      }
      
      // Fallback to Groq
      if (groq) {
        const analysis = await this.analyzeWithGroq(prompt);
        return this.parseAnalysisResponse(symbol, analysis);
      }

      // Fallback to rule-based analysis
      return this.generateRuleBasedAnalysis(symbol, metrics);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('AI analysis error:', errorMessage);
      return this.generateRuleBasedAnalysis(symbol, metrics);
    }
  }

  private async checkAiUsageLimit(userId: string): Promise<boolean> {
    const key = `ai_usage:${userId}:${new Date().toDateString()}`;
    const count = await redisService.getCounter(key);
    
    if (count >= 5) {
      return false;
    }
    
    await redisService.incrementCounter(key, 86400);
    return true;
  }

  private buildAnalysisPrompt(symbol: string, metrics: AssetMetrics): string {
    return `You are an expert crypto/stock trader with years of experience. Analyze the following asset metrics and provide a concise, trader-style analysis.

Asset: ${symbol}
Metrics:
- Trend Score: ${metrics.trendScore}/100
- Momentum Score: ${metrics.momentumScore}/100 (RSI-like, >70 overbought, <30 oversold)
- Sentiment Score: ${metrics.sentimentScore}/100 (negative = bearish, positive = bullish)
- Risk Score: ${metrics.riskScore}/100 (higher = more volatile/risky)
- On-Chain Bias: ${metrics.onChainBias}
- Volume Anomaly: ${metrics.volumeAnomaly ? 'Yes' : 'No'}

Provide your analysis in this exact format:

SENTIMENT: [bullish/bearish/neutral]
CONFIDENCE: [0-100]
ANALYSIS: [2-3 sentences, conversational trader tone, no disclaimers, focus on key signals]
KEY_POINTS:
- [point 1]
- [point 2]
- [point 3]

Keep it punchy and actionable. No "this is not financial advice" or similar disclaimers.`;
  }

  private async analyzeWithGemini(prompt: string): Promise<string> {
    if (!genAI) throw new Error('Gemini not configured');
    
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    // Add timeout using Promise.race
    const timeoutMs = 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gemini API timeout')), timeoutMs);
    });
    
    const resultPromise = model.generateContent(prompt);
    const result = await Promise.race([resultPromise, timeoutPromise]);
    
    const response = await result.response;
    const text = response.text();
    
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from Gemini');
    }
    
    return text;
  }

  private async analyzeWithGroq(prompt: string): Promise<string> {
    if (!groq) throw new Error('Groq not configured');
    
    const timeoutMs = 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Groq API timeout')), timeoutMs);
    });
    
    const completionPromise = groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an expert trader providing concise market analysis.' },
        { role: 'user', content: prompt },
      ],
      model: 'llama3-70b-8192',
      temperature: 0.7,
      max_tokens: 300,
    });
    
    const completion = await Promise.race([completionPromise, timeoutPromise]);
    const content = completion.choices[0]?.message?.content;
    
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Groq');
    }
    
    return content;
  }

  private parseAnalysisResponse(symbol: string, text: string): AIAnalysisResponse {
    const sentimentMatch = text.match(/SENTIMENT:\s*(bullish|bearish|neutral)/i);
    const confidenceMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
    const analysisMatch = text.match(/ANALYSIS:\s*([^\n]+(?:\n(?!(KEY_POINTS|SENTIMENT|CONFIDENCE):)[^\n]+)*)/i);
    const keyPointsMatch = text.match(/KEY_POINTS:([\s\S]+)/i);

    const sentiment = (sentimentMatch?.[1]?.toLowerCase() || 'neutral') as AIAnalysisResponse['sentiment'];
    
    // FIX: Add NaN check and bounds
    let confidence = parseInt(confidenceMatch?.[1] || '50', 10);
    if (isNaN(confidence)) {
      confidence = 50;
    }
    confidence = Math.min(100, Math.max(0, confidence));
    
    const analysis = analysisMatch?.[1]?.trim() || 'Analysis unavailable';
    
    const keyPoints = keyPointsMatch?.[1]
      ?.split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('-'))
      .map(line => line.replace(/^-\s*/, ''))
      .slice(0, 3) || [];

    return {
      symbol,
      analysis,
      sentiment,
      confidence,
      keyPoints,
      generatedAt: new Date(),
    };
  }

  private generateRuleBasedAnalysis(symbol: string, metrics: AssetMetrics): AIAnalysisResponse {
    const parts: string[] = [];
    let sentiment: AIAnalysisResponse['sentiment'] = 'neutral';
    let confidence = 50;

    // Trend analysis
    if (metrics.trendScore > 70) {
      parts.push('Strong uptrend intact');
      sentiment = 'bullish';
      confidence += 15;
    } else if (metrics.trendScore < 30) {
      parts.push('Clear downtrend in progress');
      sentiment = 'bearish';
      confidence += 15;
    }

    // Momentum analysis
    if (metrics.momentumScore > 70) {
      parts.push('overbought conditions suggest caution');
      confidence += 10;
    } else if (metrics.momentumScore < 30) {
      parts.push('oversold bounce setup forming');
      confidence += 10;
    }

    // Sentiment analysis
    if (metrics.sentimentScore > 50) {
      parts.push('crowd sentiment is bullish');
      if (sentiment === 'neutral') sentiment = 'bullish';
      confidence += 10;
    } else if (metrics.sentimentScore < -50) {
      parts.push('bearish social media chatter');
      if (sentiment === 'neutral') sentiment = 'bearish';
      confidence += 10;
    }

    // Risk
    if (metrics.riskScore > 70) {
      parts.push('high volatility environment');
      confidence -= 10;
    }

    // On-chain
    if (metrics.onChainBias === 'Accumulation') {
      parts.push('smart money accumulating');
      confidence += 10;
    } else if (metrics.onChainBias === 'Distribution') {
      parts.push('distribution signals flashing');
      confidence -= 10;
    }

    const analysis = parts.join(', ') || 'Mixed signals, wait for clarity';

    return {
      symbol,
      analysis,
      sentiment,
      confidence: Math.min(100, Math.max(0, confidence)),
      keyPoints: [
        `Trend score: ${metrics.trendScore}/100`,
        `Momentum: ${metrics.momentumScore > 70 ? 'Overbought' : metrics.momentumScore < 30 ? 'Oversold' : 'Neutral'}`,
        `Risk level: ${metrics.riskScore > 70 ? 'High' : metrics.riskScore < 30 ? 'Low' : 'Moderate'}`,
      ],
      generatedAt: new Date(),
    };
  }

  async generateDailyReport(): Promise<AIReport> {
    if (this.isProcessing) {
      throw new Error('Report generation already in progress');
    }

    this.isProcessing = true;

    try {
      // Gather all metrics
      const allMetrics = await redisService.getAllMetrics();
      const cryptoMetrics: Record<string, AssetMetrics> = {};
      const niftyMetrics: Record<string, AssetMetrics> = {};

      for (const [symbol, metrics] of Object.entries(allMetrics)) {
        if (CRYPTO_SYMBOLS.includes(symbol)) {
          cryptoMetrics[symbol] = metrics;
        } else if (NIFTY_50_SYMBOLS.map(s => formatSymbolForDisplay(s)).includes(symbol)) {
          niftyMetrics[symbol] = metrics;
        }
      }

      // Calculate market bias
      const cryptoScores = Object.values(cryptoMetrics);
      const avgCryptoSentiment = cryptoScores.length > 0
        ? cryptoScores.reduce((sum, m) => sum + m.sentimentScore, 0) / cryptoScores.length
        : 0;

      let marketBias: AIReport['marketBias'] = 'neutral';
      if (avgCryptoSentiment > 30) marketBias = 'bullish';
      else if (avgCryptoSentiment < -30) marketBias = 'bearish';

      // Identify risk zones
      const riskZones: string[] = [];
      for (const [symbol, metrics] of Object.entries(cryptoMetrics)) {
        if (metrics.riskScore > 80) {
          riskZones.push(`${symbol} showing extreme volatility`);
        }
        if (metrics.momentumScore > 80) {
          riskZones.push(`${symbol} potentially overbought`);
        }
      }

      // Assets to watch
      const assetsToWatch = cryptoScores
        .filter(m => m.trendScore > 70 && m.sentimentScore > 40)
        .sort((a, b) => b.trendScore - a.trendScore)
        .slice(0, 5)
        .map(m => m.symbol);

      // Generate summary using AI if available
      let summary = '';
      if (genAI || groq) {
        summary = await this.generateReportSummary(cryptoMetrics, niftyMetrics, marketBias);
      } else {
        summary = this.generateRuleBasedSummary(marketBias, cryptoMetrics, riskZones);
      }

      // Get whale summary
      const whaleSummary = await this.generateWhaleSummary();

      const report: AIReport = {
        id: '',
        timestamp: new Date(),
        period: 'daily',
        marketBias,
        riskZones: riskZones.slice(0, 5),
        assetsToWatch,
        summary,
        cryptoMetrics,
        niftyMetrics,
        sentimentOverview: `Global sentiment at ${Math.round(avgCryptoSentiment)}, ${marketBias} bias dominant`,
        whaleSummary,
      };

      // Store in Firestore
      const saved = await firebaseService.createAIReport(report);
      
      console.log('Daily AI report generated:', saved.id);
      return saved;
    } finally {
      this.isProcessing = false;
    }
  }

  private async generateReportSummary(
    cryptoMetrics: Record<string, AssetMetrics>,
    niftyMetrics: Record<string, AssetMetrics>,
    bias: string
  ): Promise<string> {
    const prompt = `Generate a daily market summary for a crypto/stock trading app.

Market Bias: ${bias}

Top Crypto Metrics:
${Object.entries(cryptoMetrics)
  .slice(0, 5)
  .map(([s, m]) => `${s}: trend=${m.trendScore}, momentum=${m.momentumScore}, sentiment=${m.sentimentScore}`)
  .join('\n')}

Provide a 2-3 paragraph summary in conversational trader tone. Cover:
1. Overall market sentiment and direction
2. Key themes or patterns
3. Any caution points

Keep it punchy and professional. No disclaimers.`;

    try {
      if (genAI) {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      }
      
      if (groq) {
        const completion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama3-70b-8192',
          temperature: 0.7,
          max_tokens: 500,
        });
        return completion.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('AI report generation error:', error);
    }

    return '';
  }

  private generateRuleBasedSummary(
    bias: string,
    cryptoMetrics: Record<string, AssetMetrics>,
    riskZones: string[]
  ): string {
    const parts: string[] = [];

    if (bias === 'bullish') {
      parts.push('Markets showing positive momentum across major assets.');
    } else if (bias === 'bearish') {
      parts.push('Caution warranted as bearish sentiment dominates.');
    } else {
      parts.push('Mixed signals with no clear direction yet.');
    }

    const strongTrenders = Object.values(cryptoMetrics).filter(m => m.trendScore > 70);
    if (strongTrenders.length > 0) {
      parts.push(`${strongTrenders.length} assets showing strong trend strength.`);
    }

    if (riskZones.length > 0) {
      parts.push(`${riskZones.length} risk zones identified - manage position sizes.`);
    }

    return parts.join(' ') || 'Markets in consolidation. Wait for clearer signals.';
  }

  private async generateWhaleSummary(): Promise<string> {
    try {
      const { onchainEngine } = await import('./onchainEngine.js');
      const metrics = await onchainEngine.getAllOnChainMetrics();
    
    const accumulationAssets = Object.entries(metrics)
      .filter(([, m]) => m.bias === 'Accumulation')
      .map(([s]) => s);
    
    const distributionAssets = Object.entries(metrics)
      .filter(([, m]) => m.bias === 'Distribution')
      .map(([s]) => s);

    if (accumulationAssets.length > 0) {
      return `Smart money accumulating in ${accumulationAssets.join(', ')}. ` +
             (distributionAssets.length > 0 
               ? `Distribution signals in ${distributionAssets.join(', ')}.` 
               : 'No major outflows detected.');
    }

    if (distributionAssets.length > 0) {
      return `Caution: Distribution patterns in ${distributionAssets.join(', ')}.`;
    }

    return 'On-chain flows relatively neutral today.';
    } catch (error) {
      console.error('Error generating whale summary:', error);
      return 'On-chain data temporarily unavailable.';
    }
  }

export const aiEngine = new AIEngine();
