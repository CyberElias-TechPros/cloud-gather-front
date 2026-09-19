import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Supabase client. Values come from Vite env vars so each environment
 * (local / preview / production) can point at its own project.
 *
 * The publishable ("anon") key is safe for the browser — data access is
 * protected by row-level security on the server.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example)."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
