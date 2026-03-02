import { create } from 'zustand';
import { api } from '@/lib/api';
import type { AssetMetrics, MarketPulse } from '@aurix/types';

interface MarketData {
  symbol: string;
  price: number;
  metrics: AssetMetrics | null;
  marketData: {
    price: number;
    change24h: number;
    changePercent24h: number;
    volume24h: number;
    high24h: number;
    low24h: number;
  } | null;
}

interface MarketState {
  cryptoData: MarketData[];
  stockData: MarketData[];
  marketPulse: MarketPulse | null;
  selectedAsset: string | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchCrypto: () => Promise<void>;
  fetchStocks: () => Promise<void>;
  fetchMarketPulse: () => Promise<void>;
  fetchAsset: (symbol: string) => Promise<MarketData | null>;
  setSelectedAsset: (symbol: string | null) => void;
  updatePrice: (symbol: string, price: number) => void;
  clearError: () => void;
}

export const useMarketStore = create<MarketState>((set, get) => ({
  cryptoData: [],
  stockData: [],
  marketPulse: null,
  selectedAsset: null,
  isLoading: false,
  error: null,

  fetchCrypto: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getCryptoList();
      if (response.success) {
        set({ cryptoData: response.data });
      } else {
        set({ error: response.error || 'Failed to fetch crypto data' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching crypto';
      console.error('Error fetching crypto:', error);
      set({ error: errorMessage });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchStocks: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getStocks();
      if (response.success) {
        set({ stockData: response.data });
      } else {
        set({ error: response.error || 'Failed to fetch stock data' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching stocks';
      console.error('Error fetching stocks:', error);
      set({ error: errorMessage });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMarketPulse: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.getMarketPulse();
      if (response.success) {
        set({ marketPulse: response.data });
      } else {
        set({ error: response.error || 'Failed to fetch market pulse' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error fetching market pulse';
      console.error('Error fetching market pulse:', error);
      set({ error: errorMessage });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAsset: async (symbol: string) => {
    try {
      const isCrypto = !symbol.includes('.NS');
      const response = isCrypto 
        ? await api.getCrypto(symbol)
        : await api.getStock(symbol);
      
      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching asset:', error);
      return null;
    }
  },

  setSelectedAsset: (symbol) => set({ selectedAsset: symbol }),

  updatePrice: (symbol, price) => {
    set((state) => {
      const isCrypto = !symbol.includes('.NS');
      if (isCrypto) {
        return {
          cryptoData: state.cryptoData.map(d => 
            d.symbol === symbol ? { ...d, price } : d
          ),
        };
      }
      return {
        stockData: state.stockData.map(d =>
          d.symbol === symbol ? { ...d, price } : d
        ),
      };
    });
  },

  clearError: () => set({ error: null }),
}));
