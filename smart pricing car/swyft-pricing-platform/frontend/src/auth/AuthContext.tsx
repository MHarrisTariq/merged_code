import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type AuthState = {
  token: string | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthState | null>(null);

function decodeExp(jwt: string): number | null {
  try {
    const body = jwt.split(".")[1];
    const json = JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

  const scheduleRefresh = useCallback((jwt: string) => {
    const exp = decodeExp(jwt);
    if (!exp) return;
    const ms = exp * 1000 - Date.now() - 30_000;
    if (ms <= 0) return;
    window.setTimeout(async () => {
      try {
        const r = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        });
        if (!r.ok) return;
        const j = await r.json();
        setToken(j.access_token);
        scheduleRefresh(j.access_token);
      } catch {
        /* ignore */
      }
    }, ms);
  }, []);

  const login = useCallback(
    async (password: string) => {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password }),
      });
      if (!r.ok) throw new Error("Login failed");
      const j = await r.json();
      setToken(j.access_token);
      scheduleRefresh(j.access_token);
    },
    [scheduleRefresh]
  );

  const logout = useCallback(() => setToken(null), []);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(path, { ...init, headers });
    },
    [token]
  );

  const value = useMemo<AuthState>(
    () => ({
      token,
      login,
      logout,
      apiFetch,
    }),
    [token, login, logout, apiFetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
