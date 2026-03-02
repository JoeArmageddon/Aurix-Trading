'use client';

import { useEffect, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { Plus, Trash2, Bell, BellOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { Alert, AlertCondition } from '@aurix/types';

const ALERT_LIMIT_FREE = 2;

export default function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlert, setNewAlert] = useState({
    name: '',
    symbol: '',
    metric: 'price' as AlertCondition['metric'],
    operator: '>' as AlertCondition['operator'],
    value: '',
  });

  const fetchAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.getAlerts();
      if (response.success) {
        setAlerts(response.data);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const value = parseFloat(newAlert.value);
    if (isNaN(value)) {
      alert('Please enter a valid numeric value');
      return;
    }
    if (!newAlert.name.trim()) {
      alert('Please enter an alert name');
      return;
    }
    if (!newAlert.symbol.trim()) {
      alert('Please enter a symbol');
      return;
    }
    
    try {
      await api.createAlert({
        name: newAlert.name.trim(),
        symbol: newAlert.symbol.toUpperCase().trim(),
        conditions: {
          metric: newAlert.metric,
          operator: newAlert.operator,
          value,
        },
        cooldownMinutes: 60,
      });
      setNewAlert({ name: '', symbol: '', metric: 'price', operator: '>', value: '' });
      setShowAddForm(false);
      fetchAlerts();
    } catch (error) {
      console.error('Error creating alert:', error);
      alert(error instanceof Error ? error.message : 'Failed to create alert');
    }
  };

  const handleToggleAlert = async (alert: Alert) => {
    if (!alert?.id) {
      console.error('Invalid alert object');
      return;
    }
    try {
      await api.updateAlert(alert.id, { isActive: !alert.isActive });
      fetchAlerts();
    } catch (error) {
      console.error('Error toggling alert:', error);
      alert(error instanceof Error ? error.message : 'Failed to toggle alert');
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!id) {
      console.error('Invalid alert ID');
      return;
    }
    if (!confirm('Are you sure you want to delete this alert?')) return;
    try {
      await api.deleteAlert(id);
      fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete alert');
    }
  };

  const isPro = user?.plan === 'pro';
  const activeAlertsCount = alerts.filter(a => a?.isActive).length;
  const alertLimit = isPro ? Number.MAX_SAFE_INTEGER : ALERT_LIMIT_FREE;
  const hasReachedLimit = !isPro && activeAlertsCount >= ALERT_LIMIT_FREE;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Alerts</h1>
            <p className="text-gray-400 mt-1">
              Get notified when market conditions are met
              {!isPro && (
                <span className="ml-2 text-amber-500">
                  ({activeAlertsCount}/{ALERT_LIMIT_FREE} used)
                </span>
              )}
            </p>
          </div>
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={hasReachedLimit}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Alert
          </Button>
        </div>

        {/* Create Alert Form */}
        {showAddForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Alert</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAlert} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Input
                  placeholder="Alert Name"
                  value={newAlert.name}
                  onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Symbol (e.g., BTC)"
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert({ ...newAlert, symbol: e.target.value })}
                  required
                />
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-white"
                  value={newAlert.metric}
                  onChange={(e) => setNewAlert({ ...newAlert, metric: e.target.value as AlertCondition['metric'] })}
                >
                  <option value="price">Price</option>
                  <option value="rsi">RSI</option>
                  <option value="sentiment">Sentiment</option>
                  <option value="momentum">Momentum</option>
                  <option value="trend">Trend</option>
                </select>
                <div className="flex space-x-2">
                  <select
                    className="flex h-9 w-20 rounded-md border border-border bg-background px-3 py-1 text-sm text-white"
                    value={newAlert.operator}
                    onChange={(e) => setNewAlert({ ...newAlert, operator: e.target.value as AlertCondition['operator'] })}
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="=">=</option>
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Value"
                    value={newAlert.value}
                    onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit">Create</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Alerts List */}
        <div className="grid gap-4">
          {alerts.length > 0 ? (
            alerts.map((alert) => {
              if (!alert?.id) return null;
              
              // Safely extract condition display
              let conditionDisplay = 'Complex condition';
              if (alert.conditions && typeof alert.conditions === 'object') {
                if ('metric' in alert.conditions && 'operator' in alert.conditions && 'value' in alert.conditions) {
                  conditionDisplay = `${alert.conditions.metric} ${alert.conditions.operator} ${alert.conditions.value}`;
                }
              }
              
              return (
                <Card key={alert.id} className={!alert.isActive ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => handleToggleAlert(alert)}
                          className={`p-2 rounded-lg transition-colors ${
                            alert.isActive 
                              ? 'bg-accent/20 text-accent' 
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {alert.isActive ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                        </button>
                        <div>
                          <h3 className="font-semibold text-white">{alert.name || 'Unnamed Alert'}</h3>
                          <p className="text-sm text-gray-400">
                            {alert.symbol || 'Unknown'} - {conditionDisplay}
                          </p>
                          {alert.lastTriggered && (
                            <p className="text-xs text-gray-500">
                              Last triggered: {new Date(alert.lastTriggered).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={alert.isActive ? 'success' : 'secondary'}>
                          {alert.isActive ? 'Active' : 'Paused'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAlert(alert.id)}
                        >
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-danger" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white">No alerts yet</h3>
                <p className="text-gray-400 mt-2">
                  Create your first alert to get notified when market conditions are met.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {!isPro && (
          <Card className="bg-gradient-to-r from-accent/10 to-transparent border-accent/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white">Upgrade to Pro</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Get unlimited alerts, advanced condition combinations, and faster notifications.
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
