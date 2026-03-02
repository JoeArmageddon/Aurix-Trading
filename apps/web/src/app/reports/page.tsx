'use client';

import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, TrendingDown, Minus, FileText, Lock } from 'lucide-react';
import type { AIReport } from '@aurix/types';

export default function ReportsPage() {
  const { user } = useAuth();
  const [report, setReport] = useState<AIReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await api.getLatestAIReport('daily');
        if (response.success) {
          setReport(response.data);
        }
      } catch (error) {
        console.error('Error fetching report:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user?.plan === 'pro') {
      fetchReport();
    } else {
      setIsLoading(false);
    }
  }, [user?.plan]);

  const isPro = user?.plan === 'pro';

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!isPro) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-accent" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Pro Feature</h1>
          <p className="text-gray-400 mb-8">
            Daily AI reports are available exclusively for Pro users. Upgrade to get 
            comprehensive market analysis delivered to your inbox every day.
          </p>
          <div className="bg-surface rounded-xl p-6 text-left">
            <h3 className="font-semibold text-white mb-4">What&apos;s included:</h3>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                Daily market bias analysis
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                Risk zone identification
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                Assets to watch recommendations
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                Whale activity summary
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-accent rounded-full mr-3" />
                Sentiment overview
              </li>
            </ul>
          </div>
        </div>
      </Layout>
    );
  }

  const getBiasIcon = (bias: string) => {
    if (bias === 'bullish') return <TrendingUp className="w-6 h-6 text-green-500" />;
    if (bias === 'bearish') return <TrendingDown className="w-6 h-6 text-red-500" />;
    return <Minus className="w-6 h-6 text-amber-500" />;
  };

  const getBiasColor = (bias: string) => {
    if (bias === 'bullish') return 'text-green-500';
    if (bias === 'bearish') return 'text-red-500';
    return 'text-amber-500';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">AI Reports</h1>
          <p className="text-gray-400 mt-1">
            Daily market analysis powered by AI
          </p>
        </div>

        {report ? (
          <>
            {/* Market Bias */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-accent" />
                  Daily Market Report
                  <span className="ml-auto text-sm text-gray-400">
                    {new Date(report.timestamp).toLocaleDateString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4 mb-6">
                  {getBiasIcon(report.marketBias)}
                  <div>
                    <p className="text-sm text-gray-400">Market Bias</p>
                    <p className={`text-2xl font-bold ${getBiasColor(report.marketBias)}`}>
                      {report.marketBias.charAt(0).toUpperCase() + report.marketBias.slice(1)}
                    </p>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-300 leading-relaxed">{report.summary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Assets to Watch */}
            <Card>
              <CardHeader>
                <CardTitle>Assets to Watch</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {report.assetsToWatch.map((asset) => (
                    <Badge key={asset} variant="default" className="text-lg px-4 py-2">
                      {asset}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Zones */}
            {report.riskZones.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-amber-500">Risk Zones</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {report.riskZones.map((risk, idx) => (
                      <li key={idx} className="flex items-start text-gray-300">
                        <span className="text-amber-500 mr-2">•</span>
                        {risk}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Sentiment & Whale Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sentiment Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300">{report.sentimentOverview}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>On-Chain Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300">{report.whaleSummary}</p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white">No reports yet</h3>
              <p className="text-gray-400 mt-2">
                Daily reports are generated at midnight UTC. Check back tomorrow for your first report.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
