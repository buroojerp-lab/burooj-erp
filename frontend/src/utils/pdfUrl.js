// src/utils/pdfUrl.js
// Builds authenticated PDF/file download URLs by appending the JWT as a query param.
// Required because plain <a href> and window.open() cannot set Authorization headers.

import { useAuthStore } from '../store/authStore';

const API_BASE = process.env.REACT_APP_API_URL || '/api/v1';

export const pdfUrl = (path) => {
  const token = useAuthStore.getState().token;
  return `${API_BASE}${path}?token=${token}`;
};
