'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatPercent, getScoreColor } from '@/lib/utils';
import type { AssetMetrics } from '@aurix/types';

interface AssetCardProps {
  symbol: string;
  price: number;
  metrics: AssetMetrics | null;
  changePercent?: number;
}

export function AssetCard({ symbol, price, metrics, changePercent }: AssetCardProps) {
  const trendColor = changePercent && changePercent >= 0 ? 'text-green-500' : 'text-red-500';
  const trendIcon = changePercent && changePercent >= 0 ? '↑' : '↓';

  return (
    <Link href={`/asset/${symbol}`}>
      <Card className="hover:border-accent/50 transition-all cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg text-white group-hover:text-accent transition-colors">
                {symbol}
              </h3>
              <p className="text-sm text-gray-400">{metrics ? 'Live' : 'Loading...'}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-xl font-semibold text-white">
                ${formatPrice(price)}
              </p>
              {changePercent !== undefined && (
                <p className={`text-sm font-medium ${trendColor}`}>
                  {trendIcon} {formatPercent(changePercent)}
                </p>
              )}
            </div>
          </div>

          {metrics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-surface-light rounded p-2">
                <p className="text-gray-400 mb-1">Trend</p>
                <p className={getScoreColor(metrics.trendScore)}>
                  {metrics.trendScore}/100
                </p>
              </div>
              <div className="bg-surface-light rounded p-2">
                <p className="text-gray-400 mb-1">Momentum</p>
                <p className={getScoreColor(metrics.momentumScore)}>
                  {metrics.momentumScore}/100
                </p>
              </div>
              <div className="bg-surface-light rounded p-2">
                <p className="text-gray-400 mb-1">Risk</p>
                <p className={getScoreColor(metrics.riskScore, 'negative')}>
                  {metrics.riskScore}/100
                </p>
              </div>
            </div>
          )}

          {metrics?.aiInsight && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-gray-400 line-clamp-2">
                {metrics.aiInsight}
              </p>
            </div>
          )}

          {metrics?.onChainBias && metrics.onChainBias !== 'Neutral' && (
            <div className="mt-2">
              <Badge variant={metrics.onChainBias === 'Accumulation' ? 'success' : 'destructive'}>
                {metrics.onChainBias}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
