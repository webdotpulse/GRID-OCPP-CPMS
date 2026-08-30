import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle data unwrapping and 401 Unauthorized
api.interceptors.response.use(
  (response) => {
    // The backend wraps responses in { success: true, data: { ... } }
    // We unwrap it here so frontend components can use response.data directly.
    if (response.data && response.data.success && response.data.data !== undefined) {
      const pagination = response.data.pagination;
      const stats = response.data.stats;
      const unwrappedData = response.data.data;
      if (pagination) {
        (response as any).pagination = pagination;
        if (unwrappedData && typeof unwrappedData === 'object') {
          (unwrappedData as any).pagination = pagination;
        }
      }
      if (stats) {
        (response as any).stats = stats;
        if (unwrappedData && typeof unwrappedData === 'object') {
          (unwrappedData as any).stats = stats;
        }
      }
      if (response.data.total !== undefined) {
        (response as any).total = response.data.total;
        if (unwrappedData && typeof unwrappedData === 'object') {
          (unwrappedData as any).total = response.data.total;
        }
      }
      response.data = unwrappedData;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
