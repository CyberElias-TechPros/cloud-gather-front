import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/api";

/**
 * Session state for the app.
 *
 * The session lives in an httpOnly cookie owned by the API, so this context is
 * only a cache of "who am I": it loads once on boot and is refreshed after any
 * mutation that changes the user (profile update, password change, sign-out).
 *
 * Admin status comes from the API's own role field — never from a
 * client-writable value.
 */

export type ProfileUpdates = { displayName?: string; avatarUrl?: string; timezone?: string; settings?: Record<string, string> };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName?: string) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<User | null>;
  updateProfile: (updates: ProfileUpdates) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);

  const refresh = useCallback(async (): Promise<User | null> => {
    try {
      const { user: next } = await api.auth.session();
      setUser(next);
      return next;
    } catch (error) {
      // A network blip must not sign anyone out silently; only a real 401 does.
      if (error instanceof ApiError && error.status === 401) setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Keep multiple tabs consistent: a sign-out in one tab signs out the others.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "cloudgather:auth") void refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: next } = await api.auth.login({ email, password });
    setUser(next);
    localStorage.setItem("cloudgather:auth", String(Date.now()));
    return next;
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { user: next } = await api.auth.register({ email, password, displayName });
    setUser(next);
    localStorage.setItem("cloudgather:auth", String(Date.now()));
    return next;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      localStorage.setItem("cloudgather:auth", String(Date.now()));
    }
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdates) => {
    const { user: next } = await api.auth.updateProfile(updates);
    setUser(next);
    return next;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      isAuthenticated: Boolean(user),
      signIn,
      signUp,
      signOut,
      refresh,
      updateProfile,
    }),
    [user, loading, signIn, signUp, signOut, refresh, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
