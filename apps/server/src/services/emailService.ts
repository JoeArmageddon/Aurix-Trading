import { Resend } from 'resend';
import { config } from '../config.js';
import type { Alert, AssetMetrics, AIReport, User } from '@aurix/types';
import { formatPrice, formatPercent } from '@aurix/utils';

let resend: Resend | null = null;

if (config.resendApiKey) {
  resend = new Resend(config.resendApiKey);
}

class EmailService {
  private fromEmail = 'alerts@aurix.trading';

  async sendAlertEmail(
    to: string,
    alert: Alert,
    metrics: AssetMetrics
  ): Promise<void> {
    if (!resend) {
      console.log(`[EMAIL MOCK] Alert email to ${to}: ${alert.name}`);
      return;
    }

    try {
      const subject = `🚨 Alert Triggered: ${alert.name}`;
      
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F14; color: #ffffff; padding: 20px; border-radius: 10px;">
          <h1 style="color: #14B8A6; margin-bottom: 20px;">Aurix Alert Triggered</h1>
          
          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #ffffff;">${alert.name}</h2>
            <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #14B8A6;">
              ${alert.symbol}
            </p>
          </div>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #9CA3AF;">Current Metrics</h3>
            <table style="width: 100%; color: #ffffff;">
              <tr>
                <td style="padding: 8px 0;">Trend Score:</td>
                <td style="text-align: right; font-weight: bold;">${metrics.trendScore}/100</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Momentum:</td>
                <td style="text-align: right; font-weight: bold;">${metrics.momentumScore}/100</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Sentiment:</td>
                <td style="text-align: right; font-weight: bold;">${metrics.sentimentScore > 0 ? '+' : ''}${metrics.sentimentScore}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;">Risk Level:</td>
                <td style="text-align: right; font-weight: bold; color: ${metrics.riskScore > 70 ? '#EF4444' : '#10B981'};">${metrics.riskScore}/100</td>
              </tr>
            </table>
          </div>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #9CA3AF;">AI Insight</h3>
            <p style="color: #ffffff; line-height: 1.6;">${metrics.aiInsight}</p>
          </div>

          <p style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px;">
            This alert was triggered at ${new Date().toLocaleString()}<br>
            <a href="https://aurix.trading/dashboard" style="color: #14B8A6;">View Dashboard</a>
          </p>
        </div>
      `;

      await resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      console.log(`Alert email sent to ${to}`);
    } catch (error) {
      console.error('Error sending alert email:', error);
    }
  }

  async sendDailyReport(to: string, report: AIReport): Promise<void> {
    if (!resend) {
      console.log(`[EMAIL MOCK] Daily report to ${to}`);
      return;
    }

    try {
      const subject = `📊 Aurix Daily Market Report - ${report.marketBias.toUpperCase()} Bias`;

      const topAssets = report.assetsToWatch.slice(0, 5).join(', ');
      const riskZones = report.riskZones.length > 0 
        ? report.riskZones.slice(0, 3).map(r => `• ${r}`).join('<br>')
        : 'No major risk zones identified';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F14; color: #ffffff; padding: 20px; border-radius: 10px;">
          <h1 style="color: #14B8A6; margin-bottom: 20px;">Daily Market Report</h1>
          
          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: ${report.marketBias === 'bullish' ? '#10B981' : report.marketBias === 'bearish' ? '#EF4444' : '#F59E0B'};">
              Market Bias: ${report.marketBias.toUpperCase()}
            </h2>
            <p style="color: #9CA3AF;">${report.timestamp.toLocaleDateString()}</p>
          </div>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #ffffff;">Summary</h3>
            <p style="color: #D1D5DB; line-height: 1.6;">${report.summary}</p>
          </div>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #14B8A6;">Assets to Watch</h3>
            <p style="color: #ffffff; font-weight: bold;">${topAssets}</p>
          </div>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="margin-top: 0; color: #F59E0B;">⚠️ Risk Zones</h3>
            <div style="color: #D1D5DB;">${riskZones}</div>
          </div>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #9CA3AF;">On-Chain Activity</h3>
            <p style="color: #D1D5DB;">${report.whaleSummary}</p>
          </div>

          <p style="text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px;">
            <a href="https://aurix.trading/reports" style="color: #14B8A6;">View Full Report</a>
          </p>
        </div>
      `;

      await resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      console.log(`Daily report sent to ${to}`);
    } catch (error) {
      console.error('Error sending daily report:', error);
    }
  }

  async sendWelcomeEmail(to: string, user: User): Promise<void> {
    if (!resend) {
      console.log(`[EMAIL MOCK] Welcome email to ${to}`);
      return;
    }

    try {
      const subject = 'Welcome to Aurix - Your AI Trading Co-Pilot';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0F14; color: #ffffff; padding: 20px; border-radius: 10px;">
          <h1 style="color: #14B8A6; margin-bottom: 20px;">Welcome to Aurix</h1>
          
          <p style="color: #D1D5DB; font-size: 16px; line-height: 1.6;">
            Hi there,
          </p>

          <p style="color: #D1D5DB; line-height: 1.6;">
            Welcome to Aurix — Your AI Trading Co-Pilot. We're excited to have you on board!
          </p>

          <div style="background: #1A1F26; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #ffffff;">Your ${user.plan === 'pro' ? 'Pro' : 'Free'} Plan Includes:</h3>
            <ul style="color: #D1D5DB; line-height: 1.8;">
              <li>Real-time crypto tracking (Top 10)</li>
              <li>Indian stocks (NIFTY 50)</li>
              <li>AI-powered market insights</li>
              ${user.plan === 'pro' ? `
              <li>Unlimited alerts</li>
              <li>Unlimited AI queries</li>
              <li>Daily reports</li>
              ` : `
              <li>2 active alerts</li>
              <li>5 AI queries per day</li>
              `}
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://aurix.trading/dashboard" 
               style="background: #14B8A6; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>

          <p style="color: #6B7280; font-size: 12px; text-align: center;">
            Need help? Reply to this email or visit our <a href="https://aurix.trading/help" style="color: #14B8A6;">Help Center</a>
          </p>
        </div>
      `;

      await resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      console.log(`Welcome email sent to ${to}`);
    } catch (error) {
      console.error('Error sending welcome email:', error);
    }
  }
}

export const emailService = new EmailService();
