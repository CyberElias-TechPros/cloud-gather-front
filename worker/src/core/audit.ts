/** Append-only audit trail. Never throws — logging must not break a request. */
import type { Ctx } from "./context";
import type { Env } from "../env";
import { run } from "./db";
import { id } from "./util";

export interface AuditInput {
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  actorId?: string | null;
  severity?: "info" | "warning" | "critical";
}

export async function audit(ctx: Ctx, input: AuditInput): Promise<void> {
  if (ctx.settings && ctx.settings.audit_logging_enabled === false) return;
  try {
    await run(
      ctx.env,
      `INSERT INTO audit_logs(id, user_id, actor_email, action, resource_type, resource_id, details, request_id, ip_address, user_agent, severity)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id(),
      input.actorId ?? ctx.user?.id ?? null,
      ctx.user?.email ?? null,
      input.action,
      input.resourceType ?? null,
      input.resourceId ?? null,
      JSON.stringify(input.details ?? {}),
      ctx.requestId,
      ctx.ip,
      ctx.userAgent,
      input.severity ?? "info",
    );
  } catch (error) {
    console.error(JSON.stringify({ level: "warn", message: "audit write failed", action: input.action, error: String(error) }));
  }
}

/** Fire-and-forget variant for hot paths. */
export function auditAsync(ctx: Ctx, input: AuditInput): void {
  ctx.waitUntil(audit(ctx, input));
}

/** Audit entry written outside a request (cron jobs, webhooks). */
export async function systemAudit(env: Env, action: string, details: Record<string, unknown> = {}): Promise<void> {
  try {
    await run(
      env,
      `INSERT INTO audit_logs(id, user_id, action, resource_type, details, severity)
       VALUES(?, NULL, ?, 'system', ?, 'info')`,
      id(),
      action,
      JSON.stringify(details),
    );
  } catch {
    /* ignore */
  }
}
