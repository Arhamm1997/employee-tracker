import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // send httpOnly refresh cookie on same-site requests
});

const getStoredToken = (storage: Storage, key: string) => {
  const value = storage.getItem(key);
  if (!value || value === 'undefined' || value === 'null') return null;
  return value;
};

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

const getCsrfToken = () => getCookie('csrf_token');

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken(localStorage, 'stafftrack_admin_token');
    const tempToken = getStoredToken(sessionStorage, 'temp_token');

    if (!config.headers) return config;

    // Prefer the real auth token (after login/2FA). Fallback to temp token.
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete (config.headers as any).Authorization;
      if (tempToken) {
        config.headers.Authorization = `Bearer ${tempToken}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors & refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response) {
      const { status, data } = error.response;

      // Attempt token refresh once when access token expires
      if (
        status === 401 &&
        !originalRequest?._retry &&
        originalRequest.url &&
        !originalRequest.url.endsWith('/auth/refresh') &&
        !originalRequest.url.endsWith('/admin/auth/login')
      ) {
        originalRequest._retry = true;
        try {
          const csrfToken = getCsrfToken();
          const refreshRes = await api.post(
            '/auth/refresh',
            null,
            {
              withCredentials: true,
              headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
            }
          );

          const newToken = refreshRes.data?.data?.accessToken;
          if (newToken) {
            localStorage.setItem('stafftrack_admin_token', newToken);
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return api(originalRequest);
          }
        } catch {
          // fall through to logout behavior
        }
      }

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('stafftrack_admin_token');
          sessionStorage.removeItem('temp_token');
          if (window.location.pathname !== '/admin/login' &&
              window.location.pathname !== '/admin/verify-2fa') {
            window.location.href = '/admin/login';
          }
          break;

        case 403:
          // Forbidden - permission denied
          toast.error('Permission denied');
          break;

        case 500:
          // Server error
          const errorMessage = data?.message || 'Internal server error';
          toast.error(errorMessage);
          break;

        default:
          // Other errors
          if (data?.message) {
            toast.error(data.message);
          }
      }
    } else if (error.request) {
      // Network error
      toast.error('Network error. Please check your connection.');
    }

    return Promise.reject(error);
  }
);

export default api;
