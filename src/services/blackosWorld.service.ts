import { prisma } from "@/lib/prisma";
import { getOrganizationGraph } from "@/services/organization.service";
import { listAgentDefinitions } from "@/agents/agentService";
import type { AgentDefinition } from "@/agents/types";
import type { OrganizationGraphData } from "@/types/organization";

/**
 * Read-only aggregation for the BlackOS World view (/command-center/world).
 * Reuses existing services exactly as-is — organization.service.ts for the
 * real Neo4j graph, agentService.ts's registry for the real code-defined
 * Agent(s), and direct bounded Prisma reads for Task/Approval/Execution/
 * Event, the same convention as commandCenter.service.ts. No new engine, no
 * new persistence, no mutation anywhere in this file.
 *
 * IMPORTANT DISTINCTION preserved throughout: a Neo4j `Agent` node (e.g.
 * "marketing_manager") is an organizational graph node — it is NOT the same
 * thing as a code-defined software Agent from src/agents/agentService.ts
 * (today, exactly one: "operations_task_planner"). Task.agentKey references
 * the former, never the latter; nothing in this system currently links a
 * Task back to which software Agent (if any) proposed it, and this service
 * does not pretend otherwise.
 */

const SOFTWARE_AGENT_DECISION_TYPES = ["NO_ACTION", "NEEDS_CLARIFICATION", "PROPOSE_TASK"] as const;

export interface WorldSoftwareAgent extends AgentDefinition {
  decisionTypes: readonly string[];
}

export interface WorldDepartment {
  key: string;
  name: string;
  status: string;
  graphAgentCount: number;
  graphAgentKeys: string[];
  capabilities: { key: string; name: string; riskLevel: string }[];
  recentTaskCount: number;
}

export interface WorldTask {
  id: string;
  title: string;
  status: string;
  riskLevel: string | null;
  agentKey: string | null;
  capabilityKey: string | null;
  departmentKey: string | null;
  createdAt: Date;
  approval: { id: string; status: string } | null;
  execution: { id: string; status: string; toolKey: string } | null;
}

export interface WorldApprovalSummary {
  pending: number;
  approvedRecent: number;
  rejectedRecent: number;
}

export interface WorldExecution {
  id: string;
  taskId: string;
  taskTitle: string;
  status: string;
  toolKey: string;
  workflowRef: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  failureReason: string | null;
  resultSummary: string | null;
}

export interface WorldTool {
  key: string;
  name: string;
  type: string;
  currentlyUsedCount: number;
  note: string | null;
}

export interface WorldEvent {
  id: string;
  type: string;
  message: string | null;
  createdAt: Date;
}

export interface BlackosWorldSnapshot {
  organization: OrganizationGraphData;
  departments: WorldDepartment[];
  softwareAgents: WorldSoftwareAgent[];
  tasks: WorldTask[];
  approvals: WorldApprovalSummary;
  executions: WorldExecution[];
  tools: WorldTool[];
  events: WorldEvent[];
}

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const TASK_TAKE = 15;
const EXECUTION_TAKE = 15;
const EVENT_TAKE = 10;

export async function getBlackosWorldSnapshot(agencyId: string | null): Promise<BlackosWorldSnapshot> {
  const agencyScope = agencyId ? { agencyId } : {};
  const since = new Date(Date.now() - RECENT_WINDOW_MS);

  const [organization, tasks, pendingApprovalCount, approvedRecentCount, rejectedRecentCount, executions, events] = await Promise.all([
    getOrganizationGraph(),
    prisma.task.findMany({
      where: agencyScope,
      orderBy: { createdAt: "desc" },
      take: TASK_TAKE,
      include: {
        approvals: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
        executions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, toolKey: true } },
      },
    }),
    prisma.approval.count({ where: { ...agencyScope, status: "PENDING" } }),
    prisma.approval.count({ where: { ...agencyScope, status: "APPROVED", decidedAt: { gte: since } } }),
    prisma.approval.count({ where: { ...agencyScope, status: "REJECTED", decidedAt: { gte: since } } }),
    prisma.execution.findMany({
      where: agencyScope,
      orderBy: { createdAt: "desc" },
      take: EXECUTION_TAKE,
      include: { task: { select: { title: true } } },
    }),
    prisma.event.findMany({ where: agencyScope, orderBy: { createdAt: "desc" }, take: EVENT_TAKE }),
  ]);

  const agentDeptByKey = new Map(organization.agents.map((a) => [a.key, a.departmentKey]));
  const capsByDept = new Map<string, { key: string; name: string; riskLevel: string }[]>();
  for (const cap of organization.capabilities) {
    const deptKey = cap.agentKey ? agentDeptByKey.get(cap.agentKey) : null;
    if (!deptKey) continue;
    const list = capsByDept.get(deptKey) ?? [];
    list.push({ key: cap.key, name: cap.name, riskLevel: cap.riskLevel });
    capsByDept.set(deptKey, list);
  }
  const graphAgentsByDept = new Map<string, string[]>();
  for (const agent of organization.agents) {
    if (!agent.departmentKey) continue;
    const list = graphAgentsByDept.get(agent.departmentKey) ?? [];
    list.push(agent.key);
    graphAgentsByDept.set(agent.departmentKey, list);
  }
  const taskCountByDept = new Map<string, number>();
  for (const task of tasks) {
    if (!task.departmentKey) continue;
    taskCountByDept.set(task.departmentKey, (taskCountByDept.get(task.departmentKey) ?? 0) + 1);
  }

  const departments: WorldDepartment[] = organization.departments.map((d) => ({
    key: d.key,
    name: d.name,
    status: d.status,
    graphAgentCount: d.agentCount,
    graphAgentKeys: graphAgentsByDept.get(d.key) ?? [],
    capabilities: capsByDept.get(d.key) ?? [],
    recentTaskCount: taskCountByDept.get(d.key) ?? 0,
  }));

  const softwareAgents: WorldSoftwareAgent[] = listAgentDefinitions().map((def) => ({ ...def, decisionTypes: SOFTWARE_AGENT_DECISION_TYPES }));

  const worldTasks: WorldTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    riskLevel: task.riskLevel,
    agentKey: task.agentKey,
    capabilityKey: task.capabilityKey,
    departmentKey: task.departmentKey,
    createdAt: task.createdAt,
    approval: task.approvals[0] ? { id: task.approvals[0].id, status: task.approvals[0].status } : null,
    execution: task.executions[0] ? { id: task.executions[0].id, status: task.executions[0].status, toolKey: task.executions[0].toolKey } : null,
  }));

  const usedCountByToolKey = new Map<string, number>();
  for (const exec of executions) {
    usedCountByToolKey.set(exec.toolKey, (usedCountByToolKey.get(exec.toolKey) ?? 0) + 1);
  }

  const tools: WorldTool[] = organization.tools.map((tool) => ({
    key: tool.key,
    name: tool.name,
    type: tool.type,
    currentlyUsedCount: usedCountByToolKey.get(tool.key) ?? 0,
    note: tool.key === "blackos_api" ? "Blotato (social media publishing): DRY RUN — real publishing disabled. dryRunPublish() is the only reachable path; publishReal() exists but has no caller." : null,
  }));

  const worldExecutions: WorldExecution[] = executions.map((exec) => {
    const result = exec.result as { summary?: string } | null;
    return {
      id: exec.id,
      taskId: exec.taskId,
      taskTitle: exec.task.title,
      status: exec.status,
      toolKey: exec.toolKey,
      workflowRef: exec.workflowRef,
      startedAt: exec.startedAt,
      finishedAt: exec.finishedAt,
      failureReason: exec.failureReason,
      resultSummary: result?.summary ?? null,
    };
  });

  return {
    organization,
    departments,
    softwareAgents,
    tasks: worldTasks,
    approvals: { pending: pendingApprovalCount, approvedRecent: approvedRecentCount, rejectedRecent: rejectedRecentCount },
    executions: worldExecutions,
    tools,
    events: events.map((e) => ({ id: e.id, type: e.type, message: e.message, createdAt: e.createdAt })),
  };
}
