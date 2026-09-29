// Jarvis Orchestrator v0.1a — see docs/orchestrator.md.
//
// The Orchestrator coordinates existing engines; it does not add new
// business logic. Every type here either re-exports an existing engine's
// type unchanged or describes the thin coordination record itself.

import type { OrchestrationState } from "@prisma/client";
import type { JarvisRequest, JarvisPlan } from "@/jarvis/types";

export type { OrchestrationState };

/**
 * Same shape as JarvisRequest, with requestId promoted to a first-class
 * optional field (previously only reachable via request.metadata.requestId
 * inside taskService.ts). Idempotency is now orchestration-scoped, not just
 * task-scoped — see docs/orchestrator.md "Idempotency model".
 */
export interface OrchestrationRequest extends JarvisRequest {
  requestId?: string;
}

/**
 * A thin coordination/index row — references into Task/Approval/Execution,
 * never a copy of their mutable state (status, risk, result, etc.). Those
 * tables remain the only source of truth for their own domain; this record
 * only answers "which Task/Approval/Execution did this request produce, and
 * how far did coordination get."
 */
export interface OrchestrationRecordView {
  id: string;
  agencyId: string;
  requestId: string | null;
  state: OrchestrationState;
  failureReason: string | null;
  taskId: string | null;
  approvalId: string | null;
  executionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The result of a single startOrchestration() call. `plan` is forwarded
 * verbatim from planJarvisRequest() — never re-derived or partially
 * re-interpreted here.
 */
export interface StartOrchestrationResult {
  orchestration: OrchestrationRecordView;
  plan: JarvisPlan | null;
}
