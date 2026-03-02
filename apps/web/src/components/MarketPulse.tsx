'use client';

import { useEffect } from 'react';
import { useMarketStore } from '@/stores/marketStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, Brain, AlertCircle } from 'lucide-react';

export function MarketPulse() {
  const { marketPulse, fetchMarketPulse } = useMarketStore();

  useEffect(() => {
    fetchMarketPulse();
    const interval = setInterval(fetchMarketPulse, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketPulse]);

  const getPulseColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const getFearGreedLabel = (value: number) => {
    if (value >= 75) return 'Extreme Greed';
    if (value >= 55) return 'Greed';
    if (value >= 45) return 'Neutral';
    if (value >= 25) return 'Fear';
    return 'Extreme Fear';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            Market Pulse
          </CardTitle>
          <Activity className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {marketPulse?.marketPulseScore || '--'}
          </div>
          <p className={`text-xs mt-1 ${getPulseColor(marketPulse?.marketPulseScore || 50)}`}>
            {marketPulse?.marketPulseScore && marketPulse.marketPulseScore > 60 
              ? 'Bullish momentum' 
              : marketPulse?.marketPulseScore && marketPulse.marketPulseScore < 40
              ? 'Bearish pressure'
              : 'Neutral zone'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            Fear & Greed
          </CardTitle>
          <AlertCircle className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {marketPulse?.fearGreedIndex || '--'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {getFearGreedLabel(marketPulse?.fearGreedIndex || 50)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            Global Sentiment
          </CardTitle>
          <Brain className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getPulseColor((marketPulse?.globalSentiment || 0) + 50)}`}>
            {marketPulse?.globalSentiment !== undefined 
              ? `${marketPulse.globalSentiment > 0 ? '+' : ''}${marketPulse.globalSentiment}`
              : '--'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Social media aggregate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            Crypto Dominance
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {marketPulse?.cryptoDominance || '--'}%
          </div>
          <p className="text-xs text-gray-400 mt-1">
            BTC + ETH market share
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
