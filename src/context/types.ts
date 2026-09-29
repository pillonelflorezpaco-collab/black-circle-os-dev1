// Jarvis Context Engine v0.1f — see docs/context-engine.md.
//
// This module defines the shape of a read-only ContextBundle only. It does
// not add a new domain model: every field here is a narrow projection of an
// entity that already exists and is already authoritative elsewhere (Task,
// Approval, Execution, Event, Agency, User, the Neo4j organizational graph).
// See docs/context-engine.md "Memory boundary" for why nothing here is
// itself a fact/preference/decision record.

import type { Role, TaskStatus, ApprovalStatus, ExecutionStatus, SystemEventType } from "@prisma/client";
import type { GraphResolution } from "@/jarvis/graphResolver";
import type { IntentKey } from "@/jarvis/types";

export type { GraphResolution as ContextOrganization };

/**
 * Same shape as the local `Actor` interface already defined independently
 * in approvalService.ts / executionService.ts / orchestratorService.ts (no
 * shared export exists to import from without modifying those files, which
 * is out of scope for v0.1f — see docs/context-engine.md). The Context
 * Engine never re-derives this from the database: the caller must already
 * have authenticated it, exactly as every other engine in this codebase
 * requires.
 */
export interface Actor {
  id: string;
  role: Role;
  agencyId: string | null;
}

/** The only supported entity type in v0.1f — see docs/context-engine.md "Entity boundary". */
export type ContextEntityRef = { type: "model"; id: string };

export interface ContextEntity {
  type: "model";
  id: string;
  name: string;
}

export interface ContextAgency {
  id: string;
  name: string;
}

/** Narrow projection of Task — never the full row (no objective text, no requestId, no parent/child links). */
export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  riskLevel: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Narrow projection of Approval — historical by nature; see docs/context-engine.md "Current vs historical". */
export interface ApprovalSummary {
  id: string;
  taskId: string;
  status: ApprovalStatus;
  riskLevel: string;
  createdAt: Date;
  decidedAt: Date | null;
}

/** Narrow projection of Execution — never `result`/`failureReason` (may carry business-sensitive detail beyond what context needs). */
export interface ExecutionSummary {
  id: string;
  taskId: string;
  status: ExecutionStatus;
  toolKey: string;
  createdAt: Date;
  finishedAt: Date | null;
}

/** Narrow projection of Event — deliberately excludes `metadata` (unrestricted JSON, not safe to return wholesale — see docs/context-engine.md). */
export interface EventSummary {
  id: string;
  type: SystemEventType;
  message: string | null;
  createdAt: Date;
}

export interface ContextBundle {
  agency: ContextAgency;
  actor: { id: string; role: Role; agencyId: string | null };
  entity?: ContextEntity;
  activeTasks: TaskSummary[];
  recentApprovals: ApprovalSummary[];
  recentExecutions: ExecutionSummary[];
  recentEvents: EventSummary[];
  organization?: GraphResolution;
  errors?: {
    organization?: string;
  };
}

export interface AssembleContextOptions {
  entity?: ContextEntityRef;
  capabilityKey?: IntentKey;
}
