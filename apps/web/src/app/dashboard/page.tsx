'use client';

import { useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { MarketPulse } from '@/components/MarketPulse';
import { AssetCard } from '@/components/AssetCard';
import { useMarketStore } from '@/stores/marketStore';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { cryptoData, fetchCrypto, isLoading: marketLoading } = useMarketStore();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isAuthenticated) {
      fetchCrypto();
      interval = setInterval(() => {
        fetchCrypto().catch(console.error);
      }, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAuthenticated, fetchCrypto]);

  if (authLoading || !isAuthenticated) {
    return <LoadingSpinner />;
  }

  const featuredAssets = cryptoData.slice(0, 4);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            Real-time market insights and AI-powered analysis
          </p>
        </div>

        {/* Market Pulse */}
        <MarketPulse />

        {/* Featured Assets */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Top Crypto Assets</h2>
          {marketLoading && cryptoData.length === 0 ? (
            <div className="text-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredAssets.map((asset) => (
                <AssetCard
                  key={asset.symbol}
                  symbol={asset.symbol}
                  price={asset.price}
                  metrics={asset.metrics}
                  changePercent={asset.marketData?.changePercent24h}
                />
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Market Overview</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Cryptocurrencies</span>
                <span className="text-white font-mono">10</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Indian Stocks</span>
                <span className="text-white font-mono">50</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Real-time Updates</span>
                <span className="text-accent font-mono">Live</span>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-white mb-4">AI Features</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span className="text-gray-300">Sentiment Analysis</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span className="text-gray-300">Trend Prediction</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span className="text-gray-300">Risk Assessment</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-accent rounded-full" />
                <span className="text-gray-300">Whale Alerts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
