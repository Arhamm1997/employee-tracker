import { createContext, useContext } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "viewer";
  twoFactorEnabled?: boolean;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ requires2FA: true; tempToken: string } | { requires2FA: false }>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
