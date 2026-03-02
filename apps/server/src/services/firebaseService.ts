import admin from 'firebase-admin';
import { config } from '../config.js';
import type {
  User,
  Alert,
  AlertLog,
  PortfolioItem,
  Watchlist,
  AIReport,
  SentimentSnapshot,
} from '@aurix/types';

class FirebaseService {
  private db: admin.firestore.Firestore | null = null;
  private auth: admin.auth.Auth | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (!config.firebaseProjectId || !config.firebaseClientEmail || !config.firebasePrivateKey) {
        console.warn('Firebase credentials not fully configured');
        return;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: config.firebaseProjectId,
          clientEmail: config.firebaseClientEmail,
          privateKey: config.firebasePrivateKey,
        }),
      });

      this.db = admin.firestore();
      this.auth = admin.auth();
      this.initialized = true;

      console.log('Firebase Admin initialized');
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
    }
  }

  // ==================== USERS ====================

  async getUser(userId: string): Promise<User | null> {
    if (!this.db) return null;
    const doc = await this.db.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as User;
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    if (!this.db) throw new Error('Firebase not initialized');
    const doc = await this.db.collection('users').add(user);
    return { id: doc.id, ...user };
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    if (!this.db) return;
    await this.db.collection('users').doc(userId).update(updates);
  }

  async resetAiUsageForAllUsers(): Promise<void> {
    if (!this.db) return;
    const snapshot = await this.db.collection('users').get();
    const batch = this.db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        aiUsageToday: 0,
        aiUsageResetAt: new Date(),
      });
    });
    
    await batch.commit();
  }

  // ==================== ALERTS ====================

  async getAlert(alertId: string): Promise<Alert | null> {
    if (!this.db) return null;
    const doc = await this.db.collection('alerts').doc(alertId).get();
    if (!doc.exists) return null;
    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate(),
      lastTriggered: data.lastTriggered?.toDate(),
    } as Alert;
  }

  async getAlertsByUser(userId: string): Promise<Alert[]> {
    if (!this.db) return [];
    const snapshot = await this.db
      .collection('alerts')
      .where('userId', '==', userId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        lastTriggered: data.lastTriggered?.toDate(),
      } as Alert;
    });
  }

  async getActiveAlerts(): Promise<Alert[]> {
    if (!this.db) return [];
    const snapshot = await this.db
      .collection('alerts')
      .where('isActive', '==', true)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        lastTriggered: data.lastTriggered?.toDate(),
      } as Alert;
    });
  }

  async createAlert(alert: Omit<Alert, 'id'>): Promise<Alert> {
    if (!this.db) throw new Error('Firebase not initialized');
    const doc = await this.db.collection('alerts').add({
      ...alert,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: doc.id, ...alert };
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<void> {
    if (!this.db) return;
    await this.db.collection('alerts').doc(alertId).update({
      ...updates,
      lastTriggered: updates.lastTriggered ? admin.firestore.Timestamp.fromDate(updates.lastTriggered) : undefined,
    });
  }

  async deleteAlert(alertId: string): Promise<void> {
    if (!this.db) return;
    await this.db.collection('alerts').doc(alertId).delete();
  }

  async countActiveAlerts(userId: string): Promise<number> {
    if (!this.db) return 0;
    const snapshot = await this.db
      .collection('alerts')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .count()
      .get();
    return snapshot.data().count;
  }

  // ==================== ALERT LOGS ====================

  async createAlertLog(log: Omit<AlertLog, 'id'>): Promise<AlertLog> {
    if (!this.db) throw new Error('Firebase not initialized');
    const doc = await this.db.collection('alertLogs').add({
      ...log,
      triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: doc.id, ...log };
  }

  async getAlertLogs(userId: string, limit = 50): Promise<AlertLog[]> {
    if (!this.db) return [];
    const snapshot = await this.db
      .collection('alertLogs')
      .where('userId', '==', userId)
      .orderBy('triggeredAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        triggeredAt: data.triggeredAt?.toDate(),
      } as AlertLog;
    });
  }

  // ==================== PORTFOLIO ====================

  async getPortfolioItems(userId: string): Promise<PortfolioItem[]> {
    if (!this.db) return [];
    const snapshot = await this.db
      .collection('portfolio')
      .where('userId', '==', userId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        addedAt: data.addedAt?.toDate(),
      } as PortfolioItem;
    });
  }

  async createPortfolioItem(item: Omit<PortfolioItem, 'id'>): Promise<PortfolioItem> {
    if (!this.db) throw new Error('Firebase not initialized');
    const doc = await this.db.collection('portfolio').add({
      ...item,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: doc.id, ...item };
  }

  async updatePortfolioItem(itemId: string, updates: Partial<PortfolioItem>): Promise<void> {
    if (!this.db) return;
    await this.db.collection('portfolio').doc(itemId).update(updates);
  }

  async deletePortfolioItem(itemId: string): Promise<void> {
    if (!this.db) return;
    await this.db.collection('portfolio').doc(itemId).delete();
  }

  async countPortfolioItems(userId: string): Promise<number> {
    if (!this.db) return 0;
    const snapshot = await this.db
      .collection('portfolio')
      .where('userId', '==', userId)
      .count()
      .get();
    return snapshot.data().count;
  }

  // ==================== WATCHLISTS ====================

  async getWatchlists(userId: string): Promise<Watchlist[]> {
    if (!this.db) return [];
    const snapshot = await this.db
      .collection('watchlists')
      .where('userId', '==', userId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      } as Watchlist;
    });
  }

  async createWatchlist(watchlist: Omit<Watchlist, 'id'>): Promise<Watchlist> {
    if (!this.db) throw new Error('Firebase not initialized');
    const now = admin.firestore.FieldValue.serverTimestamp();
    const doc = await this.db.collection('watchlists').add({
      ...watchlist,
      createdAt: now,
      updatedAt: now,
    });
    return { id: doc.id, ...watchlist };
  }

  async updateWatchlist(watchlistId: string, updates: Partial<Watchlist>): Promise<void> {
    if (!this.db) return;
    await this.db.collection('watchlists').doc(watchlistId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  async deleteWatchlist(watchlistId: string): Promise<void> {
    if (!this.db) return;
    await this.db.collection('watchlists').doc(watchlistId).delete();
  }

  // ==================== AI REPORTS ====================

  async createAIReport(report: Omit<AIReport, 'id'>): Promise<AIReport> {
    if (!this.db) throw new Error('Firebase not initialized');
    const doc = await this.db.collection('aiReports').add({
      ...report,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: doc.id, ...report };
  }

  async getLatestAIReport(period: '4h' | 'daily' = 'daily'): Promise<AIReport | null> {
    if (!this.db) return null;
    const snapshot = await this.db
      .collection('aiReports')
      .where('period', '==', period)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate(),
    } as AIReport;
  }

  async getAIReports(limit = 10): Promise<AIReport[]> {
    if (!this.db) return [];
    const snapshot = await this.db
      .collection('aiReports')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate(),
      } as AIReport;
    });
  }

  // ==================== SENTIMENT SNAPSHOTS ====================

  async createSentimentSnapshot(snapshot: Omit<SentimentSnapshot, 'id'>): Promise<SentimentSnapshot> {
    if (!this.db) throw new Error('Firebase not initialized');
    const doc = await this.db.collection('sentimentSnapshots').add({
      ...snapshot,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { id: doc.id, ...snapshot };
  }

  async getSentimentSnapshots(hours = 24): Promise<SentimentSnapshot[]> {
    if (!this.db) return [];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const snapshot = await this.db
      .collection('sentimentSnapshots')
      .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoff))
      .orderBy('timestamp', 'desc')
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate(),
      } as SentimentSnapshot;
    });
  }

  // ==================== AUTH ====================

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken | null> {
    if (!this.auth) return null;
    try {
      return await this.auth.verifyIdToken(token);
    } catch {
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<admin.auth.UserRecord | null> {
    if (!this.auth) return null;
    try {
      return await this.auth.getUserByEmail(email);
    } catch {
      return null;
    }
  }

  async setCustomClaims(userId: string, claims: Record<string, unknown>): Promise<void> {
    if (!this.auth) return;
    await this.auth.setCustomUserClaims(userId, claims);
  }
}

export const firebaseService = new FirebaseService();
