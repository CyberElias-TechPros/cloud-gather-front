import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, sessionStore, SIGNED_OUT_EVENT } from "@/lib/api";

export type Provider = "google" | "github" | "azure" | "microsoft";

export interface AppUser {
  id: string;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string;
  status?: string;
  plan?: string;
  settings?: unknown;
  email_verified?: boolean;
  email_verified_at?: string | null;
  two_factor_enabled?: boolean;
  onboarded?: boolean;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}

export interface AppSession {
  access_token: string;
  expires_at?: string;
  user: AppUser;
}

export interface UserProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  settings?: unknown;
}

export type ProfileUpdates = Partial<Pick<UserProfile, "display_name" | "avatar_url" | "settings">> & {
  locale?: string;
  timezone?: string | null;
  marketing_opt_in?: boolean;
};

/** Returned when the account has two-factor authentication switched on. */
export interface MfaChallenge {
  challenge: string;
  methods: string[];
}

interface AuthResult {
  error: Error | null;
  data: { user: AppUser | null; session: AppSession | null };
  mfa?: MfaChallenge | null;
}

interface AuthContextType {
  user: AppUser | null;
  session: AppSession | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName?: string, marketingOptIn?: boolean) => Promise<AuthResult>;
  verifyMfa: (challenge: string, code: string, type?: "totp" | "recovery_code") => Promise<AuthResult>;
  signInWithProvider: (provider: Provider, redirectTo?: string) => Promise<{ error: Error | null }>;
  adoptSession: (token: string, expiresAt?: string) => Promise<AppUser | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  confirmPasswordReset: (token: string, password: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string, currentPassword?: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
  refresh: () => Promise<AppUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within an AuthProvider");
  return value;
}

/** Social provider ids the API knows about ("azure" is the legacy alias). */
const providerId = (provider: Provider) => (provider === "azure" ? "microsoft" : provider);

const normalize = (user: AppUser): AppUser => ({
  ...user,
  user_metadata: { name: user.display_name, avatar_url: user.avatar_url },
});

type SessionPayload = { token: string; expires_at?: string; user: AppUser };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((payload: SessionPayload) => {
    sessionStore.set(payload.token);
    const next = normalize(payload.user);
    setUser(next);
    setSession({ access_token: payload.token, expires_at: payload.expires_at, user: next });
    return next;
  }, []);

  const clear = useCallback(() => {
    sessionStore.clear();
    setUser(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = sessionStore.get();
    if (!token) {
      clear();
      return null;
    }
    try {
      const { user: fresh } = await api<{ user: AppUser }>("/auth/me");
      const next = normalize(fresh);
      setUser(next);
      setSession({ access_token: token, user: next });
      return next;
    } catch {
      clear();
      return null;
    }
  }, [clear]);

  /* Restore the session on boot. */
  useEffect(() => {
    let active = true;
    (async () => {
      if (!sessionStore.get()) {
        if (active) setLoading(false);
        return;
      }
      await refresh();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  /* The API client tells us when the server rejected our credentials. */
  useEffect(() => {
    const onSignedOut = () => {
      setUser(null);
      setSession(null);
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const signIn = useCallback<AuthContextType["signIn"]>(
    async (email, password) => {
      try {
        const data = await api<SessionPayload & { mfa_required?: boolean; challenge?: string; methods?: string[] }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        if (data.mfa_required && data.challenge) {
          return { error: null, data: { user: null, session: null }, mfa: { challenge: data.challenge, methods: data.methods || ["totp"] } };
        }
        const next = apply(data);
        return { error: null, data: { user: next, session: { access_token: data.token, expires_at: data.expires_at, user: next } }, mfa: null };
      } catch (error) {
        return { error: error as Error, data: { user: null, session: null } };
      }
    },
    [apply],
  );

  const verifyMfa = useCallback<AuthContextType["verifyMfa"]>(
    async (challenge, code, type = "totp") => {
      try {
        const data = await api<SessionPayload>("/auth/mfa/verify", {
          method: "POST",
          body: JSON.stringify({ challenge, code, type }),
        });
        const next = apply(data);
        return { error: null, data: { user: next, session: { access_token: data.token, expires_at: data.expires_at, user: next } } };
      } catch (error) {
        return { error: error as Error, data: { user: null, session: null } };
      }
    },
    [apply],
  );

  const signUp = useCallback<AuthContextType["signUp"]>(
    async (email, password, displayName, marketingOptIn) => {
      try {
        const data = await api<SessionPayload>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            displayName,
            marketingOptIn: Boolean(marketingOptIn),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        const next = apply(data);
        return { error: null, data: { user: next, session: { access_token: data.token, expires_at: data.expires_at, user: next } } };
      } catch (error) {
        return { error: error as Error, data: { user: null, session: null } };
      }
    },
    [apply],
  );

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* the local session is cleared regardless */
    } finally {
      clear();
    }
  }, [clear]);

  const signInWithProvider = useCallback<AuthContextType["signInWithProvider"]>(async (provider, redirectTo) => {
    try {
      const target = redirectTo || `${window.location.origin}/dashboard`;
      const data = await api<{ url: string }>(`/auth/oauth/${providerId(provider)}?redirect=${encodeURIComponent(target)}`);
      window.location.assign(data.url);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  /** Completes a social sign-in: the callback redirects back with ?token=…. */
  const adoptSession = useCallback<AuthContextType["adoptSession"]>(
    async (token, expiresAt) => {
      try {
        const data = await api<SessionPayload>("/auth/oauth/session", { method: "POST", body: JSON.stringify({ token }) });
        return apply({ ...data, expires_at: data.expires_at || expiresAt });
      } catch {
        return null;
      }
    },
    [apply],
  );

  const resetPassword = useCallback(async (email: string) => {
    try {
      await api("/auth/password/reset", { method: "POST", body: JSON.stringify({ email }) });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const confirmPasswordReset = useCallback(async (token: string, password: string) => {
    try {
      await api("/auth/password/confirm", { method: "POST", body: JSON.stringify({ token, password }) });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const updatePassword = useCallback(async (password: string, currentPassword?: string) => {
    try {
      await api("/auth/password", { method: "PATCH", body: JSON.stringify({ password, currentPassword }) });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const updateProfile = useCallback(async (updates: ProfileUpdates) => {
    const { user: updated } = await api<{ user: AppUser }>("/profile", { method: "PATCH", body: JSON.stringify(updates) });
    const next = normalize(updated);
    setUser(next);
    setSession((current) => (current ? { ...current, user: next } : current));
  }, []);

  const profile = user
    ? { id: user.id, display_name: user.display_name, avatar_url: user.avatar_url, role: user.role, settings: user.settings }
    : null;

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      isAdmin: user?.role === "admin",
      signIn,
      signUp,
      verifyMfa,
      signInWithProvider,
      adoptSession,
      signOut,
      resetPassword,
      confirmPasswordReset,
      updatePassword,
      updateProfile,
      refresh,
    }),
    [
      user,
      session,
      profile,
      loading,
      signIn,
      signUp,
      verifyMfa,
      signInWithProvider,
      adoptSession,
      signOut,
      resetPassword,
      confirmPasswordReset,
      updatePassword,
      updateProfile,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
