/**
 * Outgoing webhooks: signed, retried, and observable.
 *
 * Signature header: `X-CloudGather-Signature: t=<unix>,v1=<hex hmac sha256 of "t.body">`
 */
import type { Env } from "../env";
import { all, first, run } from "./db";
import { decryptString, hmacSha256Hex, randomToken } from "./crypto";
import { id, now, parseJson } from "./util";

export const WEBHOOK_EVENTS = [
  "file.created",
  "file.updated",
  "file.moved",
  "file.deleted",
  "file.restored",
  "folder.created",
  "share.created",
  "share.revoked",
  "link.created",
  "link.accessed",
  "link.revoked",
  "provider.connected",
  "provider.disconnected",
  "provider.error",
  "storage.warning",
  "billing.updated",
  "user.updated",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const newWebhookSecret = () => `whsec_${randomToken(24)}`;

/** Secrets are stored encrypted when ENCRYPTION_KEY is present. */
export async function readSecret(env: Env, stored: string): Promise<string> {
  if (!stored.startsWith("v1.")) return stored;
  try {
    return await decryptString(env, stored);
  } catch {
    return stored;
  }
}

export async function signPayload(secret: string, payload: string, timestamp: number): Promise<string> {
  const signature = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return `t=${timestamp},v1=${signature}`;
}

interface EndpointRow {
  id: string;
  url: string;
  secret: string;
  events: string;
}

/** Queues (and immediately attempts) delivery of an event to a user's endpoints. */
export async function dispatch(env: Env, userId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  let endpoints: EndpointRow[] = [];
  try {
    endpoints = await all<EndpointRow>(
      env,
      "SELECT id, url, secret, events FROM webhook_endpoints WHERE user_id = ? AND disabled_at IS NULL",
      userId,
    );
  } catch {
    return;
  }
  const subscribed = endpoints.filter((endpoint) => {
    const events = parseJson<string[]>(endpoint.events, ["*"]);
    return events.includes("*") || events.includes(event);
  });
  if (!subscribed.length) return;

  const eventId = `evt_${id()}`;
  const payload = JSON.stringify({ id: eventId, type: event, created_at: now(), data });

  for (const endpoint of subscribed) {
    const deliveryId = id();
    await run(
      env,
      `INSERT INTO webhook_deliveries(id, endpoint_id, event_id, event_type, payload, status, attempts, next_attempt_at)
       VALUES(?, ?, ?, ?, ?, 'pending', 0, datetime('now'))`,
      deliveryId,
      endpoint.id,
      eventId,
      event,
      payload,
    ).catch(() => undefined);
    await attempt(env, deliveryId, endpoint, payload);
  }
}

async function attempt(env: Env, deliveryId: string, endpoint: EndpointRow, payload: string): Promise<boolean> {
  const secret = await readSecret(env, endpoint.secret);
  const timestamp = Math.floor(Date.now() / 1000);
  let status = 0;
  let responseBody = "";
  let ok = false;
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "CloudGather-Webhooks/1.0",
        "x-cloudgather-signature": await signPayload(secret, payload, timestamp),
        "x-cloudgather-delivery": deliveryId,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    status = response.status;
    responseBody = (await response.text()).slice(0, 500);
    ok = response.ok;
  } catch (error) {
    responseBody = String(error).slice(0, 500);
  }

  const row = await first<{ attempts: number }>(env, "SELECT attempts FROM webhook_deliveries WHERE id = ?", deliveryId);
  const attempts = Number(row?.attempts ?? 0) + 1;
  const backoffMinutes = Math.min(60 * 6, 2 ** attempts);
  await run(
    env,
    `UPDATE webhook_deliveries
        SET status = ?, attempts = ?, response_status = ?, response_body = ?, delivered_at = ?,
            next_attempt_at = CASE WHEN ? THEN NULL ELSE datetime('now', ?) END
      WHERE id = ?`,
    ok ? "delivered" : attempts >= 6 ? "failed" : "pending",
    attempts,
    status,
    responseBody,
    ok ? now() : null,
    ok ? 1 : 0,
    `+${backoffMinutes} minutes`,
    deliveryId,
  ).catch(() => undefined);

  if (!ok && attempts >= 6) {
    await run(env, "UPDATE webhook_endpoints SET failure_count = failure_count + 1 WHERE id = ?", endpoint.id).catch(() => undefined);
  } else if (ok) {
    await run(env, "UPDATE webhook_endpoints SET failure_count = 0, last_success_at = datetime('now') WHERE id = ?", endpoint.id).catch(
      () => undefined,
    );
  }
  return ok;
}

/** Retries due deliveries — called by the scheduled handler. */
export async function retryPending(env: Env, limit = 25): Promise<{ retried: number; delivered: number }> {
  const rows = await all<{ id: string; payload: string; endpoint_id: string; url: string; secret: string; events: string }>(
    env,
    `SELECT d.id, d.payload, d.endpoint_id, e.url, e.secret, e.events
       FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
      WHERE d.status = 'pending' AND d.attempts > 0 AND d.attempts < 6
        AND (d.next_attempt_at IS NULL OR datetime(d.next_attempt_at) <= datetime('now'))
        AND e.disabled_at IS NULL
      ORDER BY d.created_at LIMIT ?`,
    limit,
  );
  let delivered = 0;
  for (const row of rows) {
    const ok = await attempt(env, row.id, { id: row.endpoint_id, url: row.url, secret: row.secret, events: row.events }, row.payload);
    if (ok) delivered += 1;
  }
  return { retried: rows.length, delivered };
}

/** Sends a synthetic event so users can verify an endpoint from the UI. */
export async function sendTestEvent(env: Env, endpointId: string, userId: string): Promise<{ ok: boolean; status: number; body: string }> {
  const endpoint = await first<EndpointRow>(
    env,
    "SELECT id, url, secret, events FROM webhook_endpoints WHERE id = ? AND user_id = ?",
    endpointId,
    userId,
  );
  if (!endpoint) return { ok: false, status: 404, body: "Endpoint not found." };
  const payload = JSON.stringify({
    id: `evt_test_${id()}`,
    type: "ping",
    created_at: now(),
    data: { message: "This is a CloudGather test event." },
  });
  const secret = await readSecret(env, endpoint.secret);
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "CloudGather-Webhooks/1.0",
        "x-cloudgather-signature": await signPayload(secret, payload, timestamp),
        "x-cloudgather-delivery": "test",
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: response.ok, status: response.status, body: (await response.text()).slice(0, 300) };
  } catch (error) {
    return { ok: false, status: 0, body: String(error).slice(0, 300) };
  }
}
