'use client';

import { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatPrice, formatPercent } from '@/lib/utils';
import { Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Position {
  id: string;
  asset: string;
  entryPrice: number;
  quantity: number;
  assetType: 'crypto' | 'stock';
  pnl: number;
  pnlPercent: number;
  currentValue: number;
}

interface PortfolioData {
  positions: Position[];
  metrics: {
    totalValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    riskScore: number;
    correlationWarnings: Array<{
      assets: string[];
      message: string;
    }>;
  };
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPosition, setNewPosition] = useState({
    asset: '',
    entryPrice: '',
    quantity: '',
    assetType: 'crypto' as 'crypto' | 'stock',
  });

  const fetchPortfolio = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getPortfolio();
      if (response.success) {
        setPortfolio(response.data);
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const entryPrice = parseFloat(newPosition.entryPrice);
    const quantity = parseFloat(newPosition.quantity);
    
    if (isNaN(entryPrice) || entryPrice <= 0) {
      alert('Please enter a valid entry price greater than 0');
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity greater than 0');
      return;
    }
    if (!newPosition.asset.trim()) {
      alert('Please enter an asset symbol');
      return;
    }
    
    try {
      await api.addPosition({
        asset: newPosition.asset.toUpperCase().trim(),
        entryPrice,
        quantity,
        assetType: newPosition.assetType,
      });
      setNewPosition({ asset: '', entryPrice: '', quantity: '', assetType: 'crypto' });
      setShowAddForm(false);
      fetchPortfolio();
    } catch (error) {
      console.error('Error adding position:', error);
      alert(error instanceof Error ? error.message : 'Failed to add position');
    }
  };

  const handleDeletePosition = async (id: string) => {
    if (!confirm('Are you sure you want to remove this position?')) return;
    try {
      await api.deletePosition(id);
      fetchPortfolio();
    } catch (error) {
      console.error('Error deleting position:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete position');
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

  const isPro = user?.plan === 'pro';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Portfolio</h1>
            <p className="text-gray-400 mt-1">Track your positions and performance</p>
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Position
          </Button>
        </div>

        {/* Summary Cards */}
        {portfolio?.metrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">
                  ${formatPrice(portfolio.metrics.totalValue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Total PnL</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${portfolio.metrics.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {portfolio.metrics.totalPnL >= 0 ? '+' : ''}${formatPrice(portfolio.metrics.totalPnL)}
                </p>
                <p className={`text-sm ${portfolio.metrics.totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPercent(portfolio.metrics.totalPnLPercent)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-400">Risk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${portfolio.metrics.riskScore > 70 ? 'text-red-500' : portfolio.metrics.riskScore > 40 ? 'text-amber-500' : 'text-green-500'}`}>
                  {portfolio.metrics.riskScore}/100
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Risk Warnings */}
        {portfolio?.metrics?.correlationWarnings && portfolio.metrics.correlationWarnings.length > 0 && (
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center text-amber-500">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Risk Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {portfolio.metrics.correlationWarnings.map((warning, idx) => (
                  <li key={idx} className="text-gray-300 text-sm">
                    • {warning.message}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Add Position Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Position</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddPosition} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  placeholder="Asset (e.g., BTC)"
                  value={newPosition.asset}
                  onChange={(e) => setNewPosition({ ...newPosition, asset: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  placeholder="Entry Price"
                  value={newPosition.entryPrice}
                  onChange={(e) => setNewPosition({ ...newPosition, entryPrice: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  placeholder="Quantity"
                  value={newPosition.quantity}
                  onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
                  required
                />
                <div className="flex space-x-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-white"
                    value={newPosition.assetType}
                    onChange={(e) => setNewPosition({ ...newPosition, assetType: e.target.value as 'crypto' | 'stock' })}
                  >
                    <option value="crypto">Crypto</option>
                    <option value="stock">Stock</option>
                  </select>
                  <Button type="submit">Add</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Positions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {portfolio?.positions && portfolio.positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-400 border-b border-border">
                      <th className="pb-3">Asset</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Entry Price</th>
                      <th className="pb-3">Quantity</th>
                      <th className="pb-3">Current Value</th>
                      <th className="pb-3">PnL</th>
                      <th className="pb-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.positions.map((position) => (
                      <tr key={position.id} className="border-b border-border/50">
                        <td className="py-4 font-medium text-white">{position.asset}</td>
                        <td className="py-4">
                          <Badge variant={position.assetType === 'crypto' ? 'default' : 'secondary'}>
                            {position.assetType}
                          </Badge>
                        </td>
                        <td className="py-4 font-mono">${formatPrice(position.entryPrice)}</td>
                        <td className="py-4 font-mono">
                          {typeof position.quantity === 'number' 
                            ? position.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })
                            : position.quantity}
                        </td>
                        <td className="py-4 font-mono">${formatPrice(position.currentValue)}</td>
                        <td className="py-4">
                          <div className={`flex items-center ${position.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {position.pnl >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                            <span className="font-mono">{formatPercent(position.pnlPercent)}</span>
                          </div>
                        </td>
                        <td className="py-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePosition(position.id)}
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-danger" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400">No positions yet. Add your first position to start tracking.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {!isPro && (
          <Card className="bg-gradient-to-r from-accent/10 to-transparent border-accent/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Upgrade to Pro</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Get unlimited portfolio positions, advanced risk metrics, and correlation analysis.
                  </p>
                </div>
                <Button variant="outline">Upgrade</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
