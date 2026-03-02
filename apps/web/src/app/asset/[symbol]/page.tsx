'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatPrice, formatPercent, getScoreColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, Brain } from 'lucide-react';
import type { AssetMetrics } from '@aurix/types';

interface AssetData {
  symbol: string;
  price: number | null;
  marketData: {
    price: number;
    change24h: number;
    changePercent24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
  } | null;
  metrics: AssetMetrics | null;
}

export default function AssetPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  const [assetData, setAssetData] = useState<AssetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchAsset = async () => {
      try {
        const isCrypto = !symbol.includes('.NS');
        const response = isCrypto 
          ? await api.getCrypto(symbol)
          : await api.getStock(symbol);
        
        if (response.success) {
          setAssetData(response.data);
        }
      } catch (error) {
        console.error('Error fetching asset:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAsset();
  }, [symbol]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await api.analyzeAsset(symbol);
      if (response.success) {
        setAiAnalysis(response.data.analysis);
      }
    } catch (error) {
      console.error('Error getting AI analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!assetData) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-white">Asset not found</h1>
          <p className="text-gray-400 mt-2">The asset you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </Layout>
    );
  }

  const { price, marketData, metrics } = assetData;
  const changePercent = marketData?.changePercent24h || 0;
  const isPositive = changePercent >= 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white">{symbol}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-3xl font-mono font-semibold text-white">
                ${price ? formatPrice(price) : '--'}
              </span>
              <span className={`text-lg font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp className="inline w-5 h-5 mr-1" /> : <TrendingDown className="inline w-5 h-5 mr-1" />}
                {formatPercent(changePercent)}
              </span>
            </div>
          </div>
          <Button onClick={handleAIAnalysis} disabled={isAnalyzing}>
            <Brain className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
          </Button>
        </div>

        {/* Metrics Grid */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Trend Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${getScoreColor(metrics.trendScore)}`}>
                  {metrics.trendScore}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Momentum</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${getScoreColor(metrics.momentumScore)}`}>
                  {metrics.momentumScore}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Sentiment</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${metrics.sentimentScore > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {metrics.sentimentScore > 0 ? '+' : ''}{metrics.sentimentScore}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Risk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${getScoreColor(metrics.riskScore, 'negative')}`}>
                  {metrics.riskScore}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Analysis */}
        {aiAnalysis && (
          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center text-accent">
                <Brain className="w-5 h-5 mr-2" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300 leading-relaxed">{aiAnalysis}</p>
            </CardContent>
          </Card>
        )}

        {/* Market Data */}
        {marketData && (
          <Card>
            <CardHeader>
              <CardTitle>Market Data (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Volume</p>
                  <p className="text-lg font-mono text-white">
                    ${(marketData.volume24h / 1e9).toFixed(2)}B
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">High</p>
                  <p className="text-lg font-mono text-white">
                    ${formatPrice(marketData.high24h)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Low</p>
                  <p className="text-lg font-mono text-white">
                    ${formatPrice(marketData.low24h)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Change</p>
                  <p className={`text-lg font-mono ${marketData.change24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    ${formatPrice(marketData.change24h)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Insights */}
        {metrics?.aiInsight && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-accent" />
                Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-300">{metrics.aiInsight}</p>
              
              {metrics.volumeAnomaly && (
                <div className="mt-4 flex items-center space-x-2 text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">Unusual volume detected</span>
                </div>
              )}

              {metrics.onChainBias && metrics.onChainBias !== 'Neutral' && (
                <div className="mt-2">
                  <Badge variant={metrics.onChainBias === 'Accumulation' ? 'success' : 'destructive'}>
                    On-Chain: {metrics.onChainBias}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
