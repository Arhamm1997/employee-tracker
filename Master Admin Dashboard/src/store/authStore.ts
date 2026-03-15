import { create } from 'zustand';
import { Admin } from '../types';

interface AuthState {
  admin: Admin | null;
  token: string | null;
  login: (token: string, admin: Admin) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const normalizeToken = (token: string | null): string | null => {
  if (!token) return null;
  if (token === 'undefined' || token === 'null') return null;
  return token;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  admin: null,
  token: normalizeToken(localStorage.getItem('stafftrack_admin_token')),
  
  login: (token: string, admin: Admin) => {
    const safeToken = normalizeToken(token);
    if (!safeToken) return;

    localStorage.setItem('stafftrack_admin_token', safeToken);
    sessionStorage.removeItem('temp_token');
    set({ token: safeToken, admin });
  },
  
  logout: () => {
    localStorage.removeItem('stafftrack_admin_token');
    sessionStorage.removeItem('temp_token');
    set({ token: null, admin: null });
    window.location.href = '/admin/login';
  },
  
  isAuthenticated: () => {
    const state = get();
    return !!state.token;
  },
}));
