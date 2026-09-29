import { prisma } from "@/lib/prisma";
import { resolveIntent } from "./intentResolver";
import { resolveEntities } from "./entityResolver";
import { resolveCapabilityContext } from "./graphResolver";
import { decideForRisk } from "./executionPolicy";
import type { JarvisPlan, JarvisRequest, PermissionBoundary } from "./types";

// Reuses the app's existing plain console logging convention (see
// src/services/video.service.ts) — no new logging system introduced.
function log(tag: string, data: Record<string, unknown> = {}) {
  console.log(`[jarvis] ${tag}`, data);
}

const NOT_IMPLEMENTED_PERMISSIONS = (coarseRoleCheck: "PASSED" | "FAILED"): PermissionBoundary => ({
  coarseRoleCheck,
  fineGrainedAuthorization: "NOT_IMPLEMENTED",
});

/**
 * Jarvis Core — DRY-RUN orchestration pipeline.
 *
 * REQUEST → NORMALIZE → UNDERSTAND → ENTITY RESOLUTION →
 * ORGANIZATIONAL RESOLUTION → CAPABILITY RESOLUTION → AGENT SELECTION →
 * TOOL RESOLUTION → RISK EVALUATION → ORCHESTRATION PLAN
 *
 * Read-only against both PostgreSQL and Neo4j. Never triggers n8n, never
 * writes business data, never sets executionAllowed to true. See
 * executionPolicy.ts for the single point that enforces this.
 */
export async function planJarvisRequest(request: JarvisRequest): Promise<JarvisPlan> {
  log("JARVIS_REQUEST_RECEIVED", { agencyId: request.agencyId, source: request.source });

  const steps: string[] = ["REQUEST_RECEIVED"];

  // NORMALIZE — trivial for this phase (trim); a real normalization step
  // (locale, unicode, etc.) would live here without changing the pipeline shape.
  const message = request.message.trim();
  if (!message) {
    return {
      status: "NEEDS_CLARIFICATION",
      reason: "EMPTY_MESSAGE",
      permissions: NOT_IMPLEMENTED_PERMISSIONS("FAILED"),
      steps: [...steps, "NORMALIZE_FAILED"],
    };
  }
  steps.push("NORMALIZED");

  // Coarse permission check — reuses existing User/agency scoping. The
  // fine-grained Neo4j HAS_ACCESS layer is intentionally not seeded (see
  // /opt/neo4j/README.md §9), so it's reported as NOT_IMPLEMENTED rather
  // than silently skipped or faked.
  const actor = await prisma.user.findUnique({ where: { id: request.actorId }, select: { id: true, agencyId: true, role: true } });
  const coarseRoleCheck = actor && (actor.agencyId === request.agencyId || actor.role === "SUPER_ADMIN") ? "PASSED" : "FAILED";
  if (coarseRoleCheck === "FAILED") {
    log("JARVIS_PERMISSION_CHECK_FAILED", { actorId: request.actorId, agencyId: request.agencyId });
    return {
      status: "NEEDS_CLARIFICATION",
      reason: "ACTOR_NOT_AUTHORIZED_FOR_AGENCY",
      permissions: NOT_IMPLEMENTED_PERMISSIONS("FAILED"),
      steps: [...steps, "PERMISSION_CHECK_FAILED"],
    };
  }
  steps.push("PERMISSION_CHECK_PASSED");

  // UNDERSTAND — deterministic keyword intent resolution (see intentResolver.ts).
  const intent = resolveIntent(message);
  if (!intent) {
    log("JARVIS_INTENT_UNRESOLVED", { message });
    return {
      status: "UNKNOWN_INTENT",
      reason: "NO_MATCHING_CAPABILITY_KEYWORDS",
      permissions: NOT_IMPLEMENTED_PERMISSIONS(coarseRoleCheck),
      steps: [...steps, "INTENT_UNRESOLVED"],
    };
  }
  log("JARVIS_INTENT_RESOLVED", { intent: intent.type, confidence: intent.confidence });
  steps.push(`INTENT_RESOLVED:${intent.type}`);

  // ENTITY RESOLUTION — Postgres, exact match only, never guesses.
  const entityResult = await resolveEntities(message, request.agencyId, request.metadata);
  if (entityResult.status === "NOT_FOUND") {
    log("JARVIS_ENTITY_UNRESOLVED", { candidate: entityResult.candidate });
    return {
      status: "NEEDS_CLARIFICATION",
      reason: "MODEL_NOT_FOUND",
      intent,
      permissions: NOT_IMPLEMENTED_PERMISSIONS(coarseRoleCheck),
      steps: [...steps, "ENTITY_NOT_FOUND"],
    };
  }
  if (entityResult.status === "AMBIGUOUS") {
    log("JARVIS_ENTITY_AMBIGUOUS", { candidate: entityResult.candidate, matchCount: entityResult.matchCount });
    return {
      status: "NEEDS_CLARIFICATION",
      reason: "AMBIGUOUS_MODEL",
      intent,
      permissions: NOT_IMPLEMENTED_PERMISSIONS(coarseRoleCheck),
      steps: [...steps, "ENTITY_AMBIGUOUS"],
    };
  }
  const entities = entityResult.status === "RESOLVED" ? entityResult.entities : [];
  if (entities.length > 0) {
    log("JARVIS_ENTITY_RESOLVED", { entities });
  }
  steps.push(entities.length > 0 ? `ENTITY_RESOLVED:${entities[0].name}` : "NO_ENTITY_REFERENCED");

  // ORGANIZATIONAL + CAPABILITY + AGENT + TOOL RESOLUTION — Neo4j, read-only.
  const graph = await resolveCapabilityContext(intent.type);
  if (!graph) {
    log("JARVIS_CAPABILITY_UNRESOLVED", { intent: intent.type });
    return {
      status: "NEEDS_CLARIFICATION",
      reason: "CAPABILITY_NOT_STAFFED",
      intent,
      entities,
      permissions: NOT_IMPLEMENTED_PERMISSIONS(coarseRoleCheck),
      steps: [...steps, "CAPABILITY_UNSTAFFED"],
    };
  }
  log("JARVIS_AGENT_SELECTED", { agent: graph.agent.key, department: graph.department.key });
  log("JARVIS_CAPABILITY_SELECTED", { capability: graph.capability.key, riskLevel: graph.capability.riskLevel });
  steps.push(`DEPARTMENT_RESOLVED:${graph.department.key}`, `AGENT_SELECTED:${graph.agent.key}`, `CAPABILITY_SELECTED:${graph.capability.key}`, `TOOLS_RESOLVED:${graph.tools.map((t) => t.key).join(",")}`);

  // RISK EVALUATION — executionAllowed is always false in this phase (see executionPolicy.ts).
  const decision = decideForRisk(graph.capability.riskLevel);
  steps.push(`RISK_EVALUATED:${graph.capability.riskLevel}`, "PLAN_CREATED");

  const plan: JarvisPlan = {
    status: "DRY_RUN",
    intent,
    entities,
    department: graph.department,
    agent: graph.agent,
    capability: graph.capability,
    tools: graph.tools,
    decision,
    permissions: NOT_IMPLEMENTED_PERMISSIONS(coarseRoleCheck),
    steps,
  };

  log("JARVIS_PLAN_CREATED", { status: plan.status, capability: graph.capability.key });
  return plan;
}
