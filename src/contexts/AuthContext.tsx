import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session, Provider } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Fields a user may update on their own profile — never role/admin columns. */
export type ProfileUpdates = Partial<Pick<UserProfile, "display_name" | "avatar_url" | "settings">>;

export interface UserProfile {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  settings?: unknown;
}

interface AuthResult {
  error: Error | null;
  data: { user: User | null; session: Session | null };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, displayName?: string) => Promise<AuthResult>;
  signInWithProvider: (provider: Provider) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminState, setIsAdminState] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Avoid profile fetches overlapping: track the id we're fetching.
    let fetchingFor: string | null = null;

    const fetchUserProfile = async (userId: string) => {
      fetchingFor = userId;
      try {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
        if (!mounted) return;
        if (error) {
          // The handle_new_user trigger creates the row; a missing row means the
          // trigger hasn't run yet (or was removed) — retry once, then surface nothing.
          if (error.code === "PGRST116") {
            const retry = await supabase.from("profiles").select("*").eq("id", userId).single();
            if (!mounted) return;
            if (!retry.error && retry.data) setProfile(retry.data);
            return;
          }
          console.error("[auth] failed to load profile", error.message);
          return;
        }
        if (data) setProfile(data);
      } finally {
        if (fetchingFor === userId) fetchingFor = null;
      }
    };

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        void fetchUserProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: nextSession } }) => {
      if (!mounted) return;
      // onAuthStateChange usually fires first; only fall back to getSession.
      applySession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Admin status comes from the SECURITY DEFINER `is_admin_user()` RPC — the
  // single authoritative source (the `admin_users` table). It is never read
  // from the client-writable profile row.
  useEffect(() => {
    let mounted = true;
    if (!user) {
      setIsAdminState(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.rpc("is_admin_user");
        if (!mounted) return;
        if (error) {
          console.error("[auth] admin check failed", error.message);
          setIsAdminState(false);
          return;
        }
        setIsAdminState(Boolean(data));
      } catch {
        if (mounted) setIsAdminState(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? new Error(error.message) : null, data: { user: data.user, session: data.session } };
    } catch (err) {
      return { error: err as Error, data: { user: null, session: null } };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: displayName ? { data: { name: displayName } } : undefined,
      });
      return { error: error ? new Error(error.message) : null, data: { user: data.user, session: data.session } };
    } catch (err) {
      return { error: err as Error, data: { user: null, session: null } };
    }
  }, []);

  const signInWithProvider = useCallback(async (provider: Provider) => {
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: ProfileUpdates) => {
      if (!user) throw new Error("User not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update(updates as Database["public"]["Tables"]["profiles"]["Update"])
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      setProfile((prev) => (prev ? { ...prev, ...updates } : prev));
    },
    [user]
  );

  const isAdmin = isAdminState;

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      isAdmin,
      signIn,
      signUp,
      signInWithProvider,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
    }),
    [user, session, profile, loading, isAdmin, signIn, signUp, signInWithProvider, signOut, resetPassword, updatePassword, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
