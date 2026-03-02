'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { initAuth, isLoading, isAuthenticated, user, firebaseUser } = useAuthStore();

  useEffect(() => {
    const unsubscribe = initAuth();
    return () => unsubscribe();
  }, [initAuth]);

  return {
    isLoading,
    isAuthenticated,
    user,
    firebaseUser,
    login: useAuthStore((state) => state.login),
    register: useAuthStore((state) => state.register),
    logout: useAuthStore((state) => state.logout),
  };
}
