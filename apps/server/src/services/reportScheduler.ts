import cron from 'node-cron';
import { aiEngine } from './aiEngine.js';
import { firebaseService } from './firebaseService.js';
import { emailService } from './emailService.js';
import type { User } from '@aurix/types';

class ReportScheduler {
  private tasks: cron.ScheduledTask[] = [];

  start(): void {
    // Daily report generation at 00:00 UTC
    const dailyReport = cron.schedule('0 0 * * *', async () => {
      console.log('Running daily report generation...');
      await this.generateDailyReport();
    });

    // 4-hour reports
    const fourHourReport = cron.schedule('0 */4 * * *', async () => {
      console.log('Running 4-hour report generation...');
      await this.generateFourHourReport();
    });

    // Reset AI usage counters daily at 00:00 UTC
    const resetCounters = cron.schedule('0 0 * * *', async () => {
      console.log('Resetting AI usage counters...');
      await this.resetAiCounters();
    });

    this.tasks.push(dailyReport, fourHourReport, resetCounters);

    console.log('Report scheduler started');
  }

  stop(): void {
    for (const task of this.tasks) {
      task.stop();
    }
    this.tasks = [];
    console.log('Report scheduler stopped');
  }

  private async generateDailyReport(): Promise<void> {
    try {
      // Generate the report
      const report = await aiEngine.generateDailyReport();

      // Send to all Pro users
      // Note: In production, you'd want to paginate this
      console.log('Daily report generated, would send to Pro users');
      
      // For now, just log - actual user querying would be implemented
      // with proper pagination for large user bases
    } catch (error) {
      console.error('Error generating daily report:', error);
    }
  }

  private async generateFourHourReport(): Promise<void> {
    try {
      // Generate 4-hour report (lighter version)
      // This could be a simplified report or just store metrics
      console.log('4-hour report tick');
    } catch (error) {
      console.error('Error generating 4-hour report:', error);
    }
  }

  private async resetAiCounters(): Promise<void> {
    try {
      await firebaseService.resetAiUsageForAllUsers();
      console.log('AI usage counters reset for all users');
    } catch (error) {
      console.error('Error resetting AI counters:', error);
    }
  }

  // Manual trigger methods for testing/admin
  async triggerDailyReport(): Promise<void> {
    await this.generateDailyReport();
  }

  async triggerResetCounters(): Promise<void> {
    await this.resetAiCounters();
  }
}

export const reportScheduler = new ReportScheduler();
