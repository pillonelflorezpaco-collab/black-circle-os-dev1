/**
 * The ONLY BlackOS module allowed to make an outbound HTTP call to n8n.
 * Nothing else in the application should ever `fetch()` an n8n URL directly
 * — see docs/execution-engine.md ("Execution Engine → n8n boundary").
 *
 * V0.1 test adapter only: triggers the zero-side-effect
 * "BlackOS Execution Engine - Test Adapter V0.1" workflow. There is no
 * generic workflow registry yet (see §6 of the Execution Engine V0.1 task) —
 * this module hardcodes the one known-safe test workflow path on purpose.
 */

const N8N_BASE_URL = process.env.N8N_INTERNAL_URL ?? "http://automation-stack-n8n-1:5678";
const TRIGGER_TIMEOUT_MS = 10_000;

export type TriggerResult = { ok: true } | { ok: false; error: string };

export interface TestWorkflowPayload {
  executionId: string;
  taskId: string;
  idempotencyKey: string;
  agencyId: string;
  capabilityKey: string | null;
}

/**
 * Fires the V0.1 test workflow and waits only for n8n's immediate
 * acknowledgement (HTTP 200 on the trigger call) — the actual result arrives
 * later, asynchronously, via POST /api/webhooks/n8n/callback. This function
 * never logs the payload's contents beyond what's needed for debugging, and
 * never logs any secret (there is none in this payload).
 */
export async function triggerTestWorkflow(payload: TestWorkflowPayload): Promise<TriggerResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRIGGER_TIMEOUT_MS);

  try {
    const res = await fetch(`${N8N_BASE_URL}/webhook/blackos-execution-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { ok: false, error: `n8n trigger returned HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "n8n trigger timed out" : err instanceof Error ? err.message : "Unknown n8n trigger error";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
