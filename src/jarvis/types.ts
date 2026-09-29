// Jarvis Core — DRY-RUN orchestration engine types.
// See docs/jarvis-core.md and /opt/neo4j/README.md for the architectural context.

export type JarvisSource = "internal" | "telegram" | "engine";

export type JarvisMode = "PLAN" | "CREATE_TASK";

export interface JarvisRequest {
  message: string;
  agencyId: string;
  actorId: string;
  source: JarvisSource;
  /** Defaults to "PLAN" — a request never persists a task unless explicitly asked to. */
  mode?: JarvisMode;
  metadata?: Record<string, unknown>;
}

export type IntentKey = "marketing_strategy" | "content_planning" | "content_analysis" | "social_media_management";

export interface ResolvedIntent {
  type: IntentKey;
  confidence: number;
}

// "post" added to close the social-media-execution dispatch gap: a Task
// needs to reference a specific Post for createExecutionForTask() to
// derive `postId` for the Blotato adapter (see executionService.ts and
// docs/social-media-execution.md). Resolved only via an explicit
// metadata.postId — never by free-text matching (a Post has no "name" the
// way a Model does, so guessing one from a message would violate
// entityResolver.ts's own exact-match-only, never-guess discipline).
export type EntityType = "model" | "post";

export interface ResolvedEntity {
  type: EntityType;
  id: string;
  name: string;
}

export interface ResolvedDepartment {
  key: string;
  name: string;
}

export interface ResolvedAgent {
  key: string;
  name: string;
  type: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ResolvedCapability {
  key: string;
  riskLevel: RiskLevel;
}

export interface ResolvedTool {
  key: string;
  type: string;
}

export interface JarvisDecision {
  action: "DELEGATE" | "CLARIFY" | "REJECT";
  executionAllowed: false; // always false in this phase — see policies/executionPolicy.ts
  approvalRequired: false; // approvals are not implemented in this phase — see §13 of the task
}

/**
 * The fine-grained (Neo4j HAS_ACCESS) permission layer is intentionally not
 * seeded yet (see /opt/neo4j/README.md §9). Every plan reports this boundary
 * explicitly rather than silently skipping the check.
 */
export interface PermissionBoundary {
  coarseRoleCheck: "PASSED" | "FAILED";
  fineGrainedAuthorization: "NOT_IMPLEMENTED";
}

export type JarvisPlanStatus = "DRY_RUN" | "NEEDS_CLARIFICATION" | "UNKNOWN_INTENT";

export interface JarvisPlan {
  status: JarvisPlanStatus;
  reason?: string;
  intent?: ResolvedIntent;
  entities?: ResolvedEntity[];
  department?: ResolvedDepartment;
  agent?: ResolvedAgent;
  capability?: ResolvedCapability;
  tools?: ResolvedTool[];
  decision?: JarvisDecision;
  permissions: PermissionBoundary;
  steps: string[];
}
