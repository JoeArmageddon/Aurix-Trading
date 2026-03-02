import { firebaseService } from './firebaseService.js';
import { redisService } from './redisService.js';
import { evaluateConditionTree, formatSymbolForDisplay } from '@aurix/utils';
import type { Alert, AlertConditionTree, AssetMetrics, AlertLog } from '@aurix/types';
import type { AlertEvaluationResult } from '../types/index.js';

class AlertEngine {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkInterval = 30000; // 30 seconds
  private activeAlerts: Map<string, Alert> = new Map();

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Load active alerts
    await this.loadActiveAlerts();

    // Start checking loop
    this.intervalId = setInterval(() => {
      this.checkAllAlerts().catch(console.error);
    }, this.checkInterval);

    console.log('Alert engine started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('Alert engine stopped');
  }

  private async loadActiveAlerts(): Promise<void> {
    try {
      const alerts = await firebaseService.getActiveAlerts();
      this.activeAlerts.clear();
      for (const alert of alerts) {
        this.activeAlerts.set(alert.id, alert);
      }
      console.log(`Loaded ${alerts.length} active alerts`);
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  }

  async reloadAlerts(): Promise<void> {
    await this.loadActiveAlerts();
  }

  private async checkAllAlerts(): Promise<void> {
    try {
      const allMetrics = await redisService.getAllMetrics();

      const checkPromises = Array.from(this.activeAlerts.values()).map(async (alert) => {
        try {
          const metrics = allMetrics[alert.symbol];
          if (!metrics) {
            console.warn(`No metrics available for ${alert.symbol}`);
            return;
          }
          await this.checkAlert(alert, metrics);
        } catch (error) {
          console.error(`Error checking alert ${alert.id}:`, error);
        }
      });

      await Promise.allSettled(checkPromises);
    } catch (error) {
      console.error('Error in checkAllAlerts:', error);
    }
  }

  private async checkAlert(alert: Alert, metrics: AssetMetrics | undefined): Promise<void> {
    if (!metrics) return;

    // Always fetch fresh alert data for cooldown check
    const freshAlert = await firebaseService.getAlert(alert.id);
    if (!freshAlert || !freshAlert.isActive) return;

    // Check cooldown using fresh data
    if (freshAlert.lastTriggered) {
      const cooldownMs = freshAlert.cooldownMinutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - freshAlert.lastTriggered.getTime();
      if (timeSinceLastTrigger < cooldownMs) {
        return;
      }
    }

    // Evaluate conditions
    const result = await this.evaluateConditions(freshAlert.conditions, metrics);

    if (result.triggered) {
      await this.triggerAlert(freshAlert, metrics, result.message);
    }
  }

  private async evaluateConditions(
    conditions: AlertConditionTree,
    metrics: AssetMetrics
  ): Promise<AlertEvaluationResult> {
    // Get current price for price conditions
    const currentPrice = await redisService.getPrice(metrics.symbol);
    
    const evaluate = (tree: AlertConditionTree): boolean => {
      if ('and' in tree) {
        return tree.and.every(child => evaluate(child));
      }
      if ('or' in tree) {
        return tree.or.some(child => evaluate(child));
      }

      const condition = tree;
      
      switch (condition.metric) {
        case 'price':
          // FIX: Actually evaluate price condition
          if (currentPrice === null) return false;
          return this.compareValue(currentPrice, condition.operator, Number(condition.value));
        case 'rsi':
        case 'momentum':
          return this.compareValue(metrics.momentumScore, condition.operator, Number(condition.value));
        case 'sentiment':
          return this.compareValue(metrics.sentimentScore, condition.operator, Number(condition.value));
        case 'trend':
          return this.compareValue(metrics.trendScore, condition.operator, Number(condition.value));
        case 'volumeAnomaly':
          return metrics.volumeAnomaly === condition.value;
        case 'whaleTransfer':
          return false; // Would need whale data integration
        default:
          return false;
      }
    };

    const triggered = evaluate(conditions);
    
    return {
      triggered,
      message: triggered ? `Alert conditions met for ${metrics.symbol}` : undefined,
    };
  }

  private compareValue(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case '>': return actual > expected;
      case '<': return actual < expected;
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '=': return actual === expected;
      case '!=': return actual !== expected;
      default: return false;
    }
  }

  private async triggerAlert(
    alert: Alert,
    metrics: AssetMetrics,
    message?: string
  ): Promise<void> {
    try {
      // Update alert
      const now = new Date();
      await firebaseService.updateAlert(alert.id, {
        lastTriggered: now,
        triggerCount: alert.triggerCount + 1,
      });

      // Create log entry
      const log: Omit<AlertLog, 'id'> = {
        alertId: alert.id,
        userId: alert.userId,
        symbol: alert.symbol,
        triggeredAt: now,
        metricsSnapshot: metrics,
        message: message || `${alert.name} triggered`,
      };
      await firebaseService.createAlertLog(log);

      // Log alert trigger (in-app only, no email)
      console.log(`🚨 Alert triggered: ${alert.name} for ${alert.symbol}`);
    } catch (error) {
      console.error('Error triggering alert:', error);
    }
  }

  async createAlert(alert: Omit<Alert, 'id'>): Promise<Alert> {
    // Check user alert limits
    const user = await firebaseService.getUser(alert.userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.plan === 'free') {
      const currentAlerts = await firebaseService.countActiveAlerts(alert.userId);
      if (currentAlerts >= 2) {
        throw new Error('Free plan limited to 2 alerts. Upgrade to Pro for unlimited alerts.');
      }
    }

    const created = await firebaseService.createAlert(alert);
    this.activeAlerts.set(created.id, created);
    return created;
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<void> {
    await firebaseService.updateAlert(alertId, updates);
    
    // Update local cache
    const existing = this.activeAlerts.get(alertId);
    if (existing) {
      const updated = { ...existing, ...updates };
      if (updated.isActive) {
        this.activeAlerts.set(alertId, updated);
      } else {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  async deleteAlert(alertId: string): Promise<void> {
    await firebaseService.deleteAlert(alertId);
    this.activeAlerts.delete(alertId);
  }

  async getUserAlerts(userId: string): Promise<Alert[]> {
    return firebaseService.getAlertsByUser(userId);
  }

  async getAlertLogs(userId: string, limit?: number): Promise<AlertLog[]> {
    return firebaseService.getAlertLogs(userId, limit);
  }
}

export const alertEngine = new AlertEngine();
