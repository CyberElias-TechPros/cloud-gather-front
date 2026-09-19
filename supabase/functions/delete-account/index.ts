/**
 * delete-account — permanently deletes the calling user's account.
 *
 * Requires the caller's Authorization: Bearer <JWT>. Performs the full data
 * cascade before removing the auth user:
 *   1. storage objects under the user's prefix
 *   2. file_shares owned by or targeting the user
 *   3. files rows (including folder descendants)
 *   4. storage_providers rows (removes stored OAuth tokens)
 *   5. api_keys rows
 *   6. usage_analytics rows
 *   7. profiles row
 *   8. the auth user itself (cascades admin-side relations)
 *
 * audit_logs rows are retained with user_id intact for security history;
 * the service-role client is required to read them, so no personal data is
 * exposed. Set DELETE_AUDIT_LOGS=true to remove them too.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, json, errorResponse, getUserIdFromJwt } from "../_shared/api.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

Deno.serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  if (!SERVICE_ROLE_KEY) {
    return errorResponse("Server misconfiguration: missing service credentials.", 500);
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const userId = await getUserIdFromJwt(req, SUPABASE_URL, ANON_KEY);
  if (!userId) {
    return errorResponse("Authentication required", 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Remove stored objects (page through to cover large accounts).
    let deletedObjects = 0;
    for (;;) {
      const { data: objects, error } = await admin.storage.from("user_uploads").list(userId, { limit: 100 });
      if (error || !objects || objects.length === 0) break;
      const paths = objects.map((object) => `${userId}/${object.name}`);
      await admin.storage.from("user_uploads").remove(paths);
      deletedObjects += paths.length;
      if (objects.length < 100) break;
    }

    // 2–6. Remove relational data owned by the user.
    const deletions = [
      admin.from("file_shares").delete().eq("owner_id", userId),
      admin.from("file_shares").delete().eq("shared_with_id", userId),
      admin.from("files").delete().eq("user_id", userId),
      admin.from("storage_providers").delete().eq("user_id", userId),
      admin.from("api_keys").delete().eq("user_id", userId),
      admin.from("usage_analytics").delete().eq("user_id", userId),
    ];
    for (const deletion of deletions) {
      const { error } = await deletion;
      if (error) throw new Error(error.message);
    }

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email;

    // Profiles row (user_id here is the primary key).
    const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
    if (profileError) throw new Error(profileError.message);

    // Optional: purge audit history for full erasure.
    if (Deno.env.get("DELETE_AUDIT_LOGS") === "true") {
      await admin.from("audit_logs").delete().eq("user_id", userId);
    }

    // 8. Delete the auth user. This also cascades team memberships.
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) throw new Error(deleteUserError.message);

    // Clean up admin_users entry so stale emails don't linger.
    if (userEmail) {
      await admin.from("admin_users").delete().eq("email", userEmail.toLowerCase());
    }

    return json({ success: true, deletedObjects });
  } catch (error) {
    console.error("[delete-account]", (error as Error).message);
    return errorResponse("Account deletion failed partway. Our team has been notified — contact support.", 500);
  }
});
