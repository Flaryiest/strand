import { create } from 'zustand';
import {
  AuthStore,
  LoginCredentials,
  SignupCredentials
} from '@/types/auth.types';
import { baseUrl } from '@/utils/baseUrl';

export const useAuthStore = create<AuthStore>((set) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitializing: true,
  error: null,

  // Actions
  setLoading: (loading: boolean) => set({ isLoading: loading }),

  clearError: () => set({ error: null }),

  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        // After successful login, verify to get user data
        await useAuthStore.getState().verify();
        return { success: true };
      } else {
        const errorText = await response.text();
        set({
          error: errorText || 'Invalid email or password',
          isLoading: false
        });
        return {
          success: false,
          error: errorText || 'Invalid email or password'
        };
      }
    } catch (err) {
      const errorMessage = 'Network error. Please try again.';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  signup: async (credentials: SignupCredentials) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${baseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(credentials)
      });

      if (response.ok) {
        set({ isLoading: false });
        return { success: true };
      } else {
        const errorText = await response.text();
        set({
          error: errorText || 'Failed to create account',
          isLoading: false
        });
        return {
          success: false,
          error: errorText || 'Failed to create account'
        };
      }
    } catch (err) {
      const errorMessage = 'Network error. Please try again.';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  verify: async () => {
    const currentState = useAuthStore.getState();
    // Only set isLoading if this is not the initial load
    if (!currentState.isInitializing) {
      set({ isLoading: true });
    }

    try {
      const response = await fetch(`${baseUrl}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        set({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          isInitializing: false,
          error: null
        });
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          isInitializing: false
        });
      }
    } catch (err) {
      console.error('Verify error:', err);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false
      });
    }
  },

  googleLogin: async (code: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(`${baseUrl}/auth/google/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          code,
          redirect_uri: `${window.location.origin}/auth/google/callback`
        })
      });

      if (response.ok) {
        const data = await response.json();
        set({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        return { success: true };
      } else {
        const errorText = await response.text();
        set({
          error: errorText || 'Google authentication failed',
          isLoading: false
        });
        return {
          success: false,
          error: errorText || 'Google authentication failed'
        };
      }
    } catch (err) {
      const errorMessage = 'Network error. Please try again.';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'GET',
        credentials: 'include'
      });

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    } catch (err) {
      console.error('Logout error:', err);
      // Clear state anyway on logout
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  }
}));
