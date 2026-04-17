// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';
import toast from 'react-hot-toast';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user: data.user,
            token: data.token,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          toast.success(`Welcome back, ${data.user.name}!`);
          return true;
        } catch (err) {
          set({ isLoading: false });
          toast.error(err.response?.data?.error || 'Login failed');
          return false;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        toast.success('Logged out successfully');
      },

      refreshAuth: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        try {
          const { data } = await api.post('/auth/refresh', { refreshToken });
          set({ token: data.token, refreshToken: data.refreshToken });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
          return true;
        } catch {
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
          return false;
        }
      },

      updateUser: (updates) => set(state => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'burooj-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
