const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async login(idToken: string, email: string) {
    return this.fetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ idToken, email }),
    });
  }

  async register(email: string, password: string, displayName?: string) {
    return this.fetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
  }

  // Market
  async getCryptoList() {
    return this.fetch('/market/crypto');
  }

  async getCrypto(symbol: string) {
    return this.fetch(`/market/crypto/${symbol}`);
  }

  async getStocks() {
    return this.fetch('/market/stocks');
  }

  async getStock(symbol: string) {
    return this.fetch(`/market/stocks/${symbol}`);
  }

  async getMarketPulse() {
    return this.fetch('/market/pulse');
  }

  async getTopMovers() {
    return this.fetch('/market/movers');
  }

  async searchAssets(query: string) {
    return this.fetch(`/market/search?q=${encodeURIComponent(query)}`);
  }

  async getWhaleAlerts(symbol?: string, limit?: number) {
    const params = new URLSearchParams();
    if (symbol) params.append('symbol', symbol);
    if (limit) params.append('limit', limit.toString());
    return this.fetch(`/market/whales?${params.toString()}`);
  }

  // Alerts
  async getAlerts() {
    return this.fetch('/alerts');
  }

  async createAlert(data: unknown) {
    return this.fetch('/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAlert(id: string, data: unknown) {
    return this.fetch(`/alerts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAlert(id: string) {
    return this.fetch(`/alerts/${id}`, {
      method: 'DELETE',
    });
  }

  async getAlertLogs(limit?: number) {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch(`/alerts/logs${params}`);
  }

  // Portfolio
  async getPortfolio() {
    return this.fetch('/portfolio');
  }

  async addPosition(data: unknown) {
    return this.fetch('/portfolio', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePosition(id: string, data: unknown) {
    return this.fetch(`/portfolio/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePosition(id: string) {
    return this.fetch(`/portfolio/${id}`, {
      method: 'DELETE',
    });
  }

  // AI
  async analyzeAsset(symbol: string) {
    return this.fetch('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    });
  }

  async getAIReports(limit?: number) {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch(`/ai/reports${params}`);
  }

  async getLatestAIReport(period?: '4h' | 'daily') {
    const params = period ? `?period=${period}` : '';
    return this.fetch(`/ai/reports/latest${params}`);
  }

  // Watchlists
  async getWatchlists() {
    return this.fetch('/watchlists');
  }

  async createWatchlist(data: unknown) {
    return this.fetch('/watchlists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWatchlist(id: string) {
    return this.fetch(`/watchlists/${id}`);
  }

  async updateWatchlist(id: string, data: unknown) {
    return this.fetch(`/watchlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWatchlist(id: string) {
    return this.fetch(`/watchlists/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
