import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { api } from '@/lib/api';

interface User {
  userId: string;
  email: string;
  plan: 'free' | 'pro';
  aiUsageToday: number;
}

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initAuth: () => () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      firebaseUser: null,
      isLoading: true,
      isAuthenticated: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
      setLoading: (isLoading) => set({ isLoading }),
      clearError: () => set({ error: null }),

      login: async (email, password) => {
        try {
          const result = await signInWithEmailAndPassword(auth, email, password);
          const idToken = await result.user.getIdToken();
          api.setToken(idToken);
          
          const response = await api.login(idToken, email);
          set({ 
            user: response.data,
            firebaseUser: result.user,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          api.clearToken();
          const errorMessage = error instanceof Error ? error.message : 'Login failed';
          set({ error: errorMessage });
          throw error;
        }
      },

      register: async (email, password) => {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          const idToken = await result.user.getIdToken();
          api.setToken(idToken);
          
          const response = await api.login(idToken, email);
          set({ 
            user: response.data,
            firebaseUser: result.user,
            isAuthenticated: true,
            error: null,
          });
        } catch (error) {
          api.clearToken();
          const errorMessage = error instanceof Error ? error.message : 'Registration failed';
          set({ error: errorMessage });
          throw error;
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          api.clearToken();
          set({ 
            user: null, 
            firebaseUser: null, 
            isAuthenticated: false,
            error: null,
          });
        }
      },

      initAuth: () => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            try {
              const idToken = await firebaseUser.getIdToken();
              api.setToken(idToken);
              
              const response = await api.login(idToken, firebaseUser.email || '');
              set({ 
                user: response.data,
                firebaseUser,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
            } catch (error) {
              console.error('Auth init error:', error);
              api.clearToken();
              set({ 
                user: null,
                firebaseUser: null,
                isAuthenticated: false,
                isLoading: false,
                error: error instanceof Error ? error.message : 'Authentication failed',
              });
            }
          } else {
            api.clearToken();
            set({ 
              user: null, 
              firebaseUser: null, 
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
          }
        });

        return unsubscribe;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
