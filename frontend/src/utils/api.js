// src/utils/api.js
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach token + active project tower_id
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Inject tower_id on all GET requests so every list endpoint is project-scoped
    const project = useProjectStore.getState().project;
    if (project?.id && config.method === 'get') {
      config.params = { ...config.params, tower_id: project.id };
    }

    return config;
  },
  (err) => Promise.reject(err)
);

// Response interceptor — handle 401 and refresh
let refreshing = false;
let queue = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      refreshing = true;

      try {
        const ok = await useAuthStore.getState().refreshAuth();
        if (ok) {
          queue.forEach(({ resolve }) => resolve());
          queue = [];
          return api(original);
        }
      } catch {
        queue.forEach(({ reject }) => reject(err));
        queue = [];
        useAuthStore.getState().logout();
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
