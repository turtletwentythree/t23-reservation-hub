import type { SendResult } from "./notifications/types";

/** POST helper that maps HTTP outcomes to a SendResult. 5xx/429/network errors are retryable. */
export async function postForResult(url: string, init: RequestInit, extractId: (json: unknown) => string | null): Promise<SendResult> {
  try {
    const res = await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(15_000) });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.ok) return { ok: true, providerMessageId: extractId(json) };
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 300)}`, retryable: res.status >= 500 || res.status === 429 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), retryable: true };
  }
}
