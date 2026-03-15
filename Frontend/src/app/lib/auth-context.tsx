import React, { useState, useEffect, useCallback } from "react";
import { apiLogin, apiGetMe, api2FAVerify } from "./api";
import { AuthContext } from "./auth-types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: "super_admin" | "viewer";
    twoFactorEnabled?: boolean;
  } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem("monitor_token");
    if (!savedToken || savedToken === "undefined" || savedToken === "null") {
      localStorage.removeItem("monitor_token");
      setLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      localStorage.removeItem("monitor_token");
      setToken(null);
      setUser(null);
      setLoading(false);
    }, 5000);

    setToken(savedToken);
    apiGetMe()
      .then(me => {
        clearTimeout(timeout);
        setUser(me);
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timeout);
        localStorage.removeItem("monitor_token");
        setToken(null);
        setUser(null);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const result = await apiLogin(email, password);

      if ("requires2FA" in result && result.requires2FA) {
        // 2FA required — return the tempToken to the caller (LoginPage handles step 2)
        return { requires2FA: true as const, tempToken: result.tempToken };
      }

      // Full login success
      const { token: newToken, user: newUser } = result;
      if (!newToken || newToken === "undefined" || newToken === "null") {
        throw new Error("Invalid token received from server");
      }

      localStorage.setItem("monitor_token", newToken);
      setToken(newToken);
      setUser(newUser);
      return { requires2FA: false as const };
    } finally {
      setLoading(false);
    }
  }, []);

  const verify2FA = useCallback(async (tempToken: string, code: string) => {
    setLoading(true);
    try {
      const { token: newToken, user: newUser } = await api2FAVerify(tempToken, code);
      if (!newToken || newToken === "undefined" || newToken === "null") {
        throw new Error("Invalid token received from server");
      }

      localStorage.setItem("monitor_token", newToken);
      setToken(newToken);
      setUser(newUser);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("monitor_token");
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await apiGetMe();
      setUser(me);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        login,
        verify2FA,
        logout,
        loading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
