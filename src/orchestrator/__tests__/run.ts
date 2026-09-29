/**
 * Jarvis Orchestrator v0.1a test suite — plain node:assert script run via
 * tsx, same convention as src/jarvis/__tests__/run.ts and
 * src/execution/__tests__/run.ts. Integration-style against the real dev
 * Postgres. Never calls n8n (no test here reaches Task.status === READY
 * without human approval, so createExecutionForTask is never actually
 * dispatched — see docs/orchestrator.md "Known limitation").
 */
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { startOrchestration, __testing } from "../orchestratorService";
import type { OrchestrationRequest } from "../types";
import type { JarvisPlan } from "@/jarvis/types";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ok — ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL — ${name}`);
    console.error(err instanceof Error ? err.message : err);
    failed++;
  }
}

function syntheticHighRiskPlan(): JarvisPlan {
  // Mirrors exactly what planJarvisRequest would produce for a real DRY_RUN
  // plan — the only difference is riskLevel: "HIGH", which does not exist
  // in the real seeded Neo4j graph today (confirmed by direct query: all
  // four real capabilities are LOW or MEDIUM). Used only via __testing to
  // exercise the AWAITING_APPROVAL path — see orchestratorService.ts.
  return {
    status: "DRY_RUN",
    intent: { type: "content_planning", confidence: 0.6 },
    entities: [],
    department: { key: "marketing_agency", name: "Marketing Agency" },
    agent: { key: "marketing_manager", name: "Marketing Manager", type: "AI" },
    capability: { key: "content_planning", riskLevel: "HIGH" },
    tools: [{ key: "n8n", type: "WORKFLOW" }],
    decision: { action: "DELEGATE", executionAllowed: false, approvalRequired: false },
    permissions: { coarseRoleCheck: "PASSED", fineGrainedAuthorization: "NOT_IMPLEMENTED" },
    steps: ["SYNTHETIC_HIGH_RISK_PLAN"],
  };
}

function makeRequest(agencyId: string, actorId: string, overrides: Partial<OrchestrationRequest> = {}): OrchestrationRequest {
  return {
    message: "plan my content",
    agencyId,
    actorId,
    source: "internal",
    mode: "PLAN",
    ...overrides,
  };
}

async function main() {
  const agency = await prisma.agency.findUnique({ where: { slug: "black-circle" } });
  assert.ok(agency, "expected the seeded 'black-circle' agency to exist");
  const agencyId = agency!.id;

  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert.ok(admin, "expected a seeded SUPER_ADMIN user to exist");
  const actorId = admin!.id;
  const adminActor = { id: actorId, role: admin!.role, agencyId: null as string | null };

  const assistant = await prisma.user.findFirst({ where: { role: "ASSISTANT", agencyId } });

  const otherAgency = await prisma.agency.create({ data: { name: "[test] orchestrator other agency", slug: `test-orch-other-agency-${Date.now()}` } });

  const [ordersBefore, tasksBefore, approvalsBefore, executionsBefore, eventsBefore] = await Promise.all([
    prisma.orchestrationRecord.count(),
    prisma.task.count(),
    prisma.approval.count(),
    prisma.execution.count(),
    prisma.event.count(),
  ]);

  const cleanupOrchestrationIds: string[] = [];
  const cleanupTaskIds: string[] = [];
  const testStartedAt = new Date();

  try {
    await test("successful orchestration (LOW risk, no approval) reaches TASK_CREATED", async () => {
      const requestId = `test-orch-${Date.now()}-a`;
      const result = await startOrchestration(makeRequest(agencyId, actorId, { requestId }), adminActor);
      cleanupOrchestrationIds.push(result.orchestration.id);
      if (result.orchestration.taskId) cleanupTaskIds.push(result.orchestration.taskId);

      assert.equal(result.orchestration.state, "TASK_CREATED");
      assert.ok(result.orchestration.taskId, "expected a taskId to be attached");
      assert.equal(result.orchestration.approvalId, null, "LOW risk must not create an Approval");
      assert.equal(result.orchestration.executionId, null, "must not execute without Task.status === READY");

      const task = await prisma.task.findUnique({ where: { id: result.orchestration.taskId! } });
      assert.equal(task?.status, "PLANNED", "Task Engine leaves a non-approval-required task PLANNED — orchestrator must not invent a READY transition");
    });

    await test("high-risk orchestration (synthetic plan) reaches AWAITING_APPROVAL, never auto-approves, never executes", async () => {
      const orchestration = await __testing.getOrCreateOrchestration(makeRequest(agencyId, actorId, { requestId: `test-orch-${Date.now()}-b` }));
      cleanupOrchestrationIds.push(orchestration.id);
      await prisma.orchestrationRecord.update({ where: { id: orchestration.id }, data: { state: "PLANNING" } });

      const plan = syntheticHighRiskPlan();
      const request = makeRequest(agencyId, actorId);
      const result = await __testing.continueFromPlan(orchestration.id, request, plan, adminActor);
      if (result.orchestration.taskId) cleanupTaskIds.push(result.orchestration.taskId);

      assert.equal(result.orchestration.state, "AWAITING_APPROVAL");
      assert.ok(result.orchestration.approvalId, "expected an Approval to be attached");
      assert.equal(result.orchestration.executionId, null, "must not execute while approval is pending");

      const approval = await prisma.approval.findUnique({ where: { id: result.orchestration.approvalId! } });
      assert.equal(approval?.status, "PENDING", "orchestrator must never set Approval.status to APPROVED itself");

      const task = await prisma.task.findUnique({ where: { id: result.orchestration.taskId! } });
      assert.equal(task?.status, "WAITING_APPROVAL");
    });

    await test("clarification path: unresolvable message reaches NEEDS_CLARIFICATION, no Task created", async () => {
      const requestId = `test-orch-${Date.now()}-c`;
      const result = await startOrchestration(makeRequest(agencyId, actorId, { message: "what's the weather like today", requestId }), adminActor);
      cleanupOrchestrationIds.push(result.orchestration.id);

      assert.equal(result.orchestration.state, "NEEDS_CLARIFICATION");
      assert.equal(result.orchestration.taskId, null);
      assert.equal(result.orchestration.failureReason, "NO_MATCHING_CAPABILITY_KEYWORDS");
    });

    await test("requestId idempotency: second call with the same requestId reuses the same OrchestrationRecord", async () => {
      const requestId = `test-orch-${Date.now()}-d`;
      const first = await startOrchestration(makeRequest(agencyId, actorId, { requestId }), adminActor);
      cleanupOrchestrationIds.push(first.orchestration.id);
      if (first.orchestration.taskId) cleanupTaskIds.push(first.orchestration.taskId);

      const second = await startOrchestration(makeRequest(agencyId, actorId, { requestId }), adminActor);
      assert.equal(second.orchestration.id, first.orchestration.id);
      assert.equal(second.orchestration.taskId, first.orchestration.taskId);

      const count = await prisma.orchestrationRecord.count({ where: { agencyId, requestId } });
      assert.equal(count, 1);
      const taskCount = await prisma.task.count({ where: { id: first.orchestration.taskId! } });
      assert.equal(taskCount, 1, "must not create a second Task for the same requestId");
    });

    await test("concurrent duplicate requestId does not create two OrchestrationRecord rows or two Tasks", async () => {
      const requestId = `test-orch-${Date.now()}-e`;
      const [first, second] = await Promise.all([
        startOrchestration(makeRequest(agencyId, actorId, { requestId }), adminActor),
        startOrchestration(makeRequest(agencyId, actorId, { requestId }), adminActor),
      ]);
      cleanupOrchestrationIds.push(first.orchestration.id);
      const taskIds = new Set([first.orchestration.taskId, second.orchestration.taskId].filter(Boolean));
      taskIds.forEach((id) => cleanupTaskIds.push(id as string));

      assert.equal(first.orchestration.id, second.orchestration.id);
      const recordCount = await prisma.orchestrationRecord.count({ where: { agencyId, requestId } });
      assert.equal(recordCount, 1);
      assert.equal(taskIds.size, 1, "concurrent duplicate requests must not create two Task rows");
    });

    await test("wrong agency: actor from a different agency yields NEEDS_CLARIFICATION, no Task created", async () => {
      const otherAgencyUser = await prisma.user.create({
        data: { email: `test-orch-other-${Date.now()}@example.com`, name: "Other Agency User", role: "OWNER", agency: { connect: { id: otherAgency.id } } },
      });
      try {
        const requestId = `test-orch-${Date.now()}-f`;
        const result = await startOrchestration(makeRequest(agencyId, otherAgencyUser.id, { requestId }), { id: otherAgencyUser.id, role: "OWNER", agencyId: otherAgency.id });
        cleanupOrchestrationIds.push(result.orchestration.id);
        assert.equal(result.orchestration.state, "NEEDS_CLARIFICATION");
        assert.equal(result.orchestration.failureReason, "ACTOR_NOT_AUTHORIZED_FOR_AGENCY");
        assert.equal(result.orchestration.taskId, null);
      } finally {
        await prisma.user.delete({ where: { id: otherAgencyUser.id } }).catch(() => {});
      }
    });

    await test("permission denial: nonexistent actorId yields NEEDS_CLARIFICATION, no Task created", async () => {
      const requestId = `test-orch-${Date.now()}-g`;
      const result = await startOrchestration(makeRequest(agencyId, "does-not-exist", { requestId }), { id: "does-not-exist", role: "ASSISTANT", agencyId });
      cleanupOrchestrationIds.push(result.orchestration.id);
      assert.equal(result.orchestration.state, "NEEDS_CLARIFICATION");
      assert.equal(result.orchestration.failureReason, "ACTOR_NOT_AUTHORIZED_FOR_AGENCY");
      assert.equal(result.orchestration.taskId, null);
    });

    await test("repository persistence: create/findById/findByRequestId/attach* all round-trip correctly", async () => {
      const requestId = `test-orch-${Date.now()}-h`;
      const result = await startOrchestration(makeRequest(agencyId, actorId, { requestId }), adminActor);
      cleanupOrchestrationIds.push(result.orchestration.id);
      if (result.orchestration.taskId) cleanupTaskIds.push(result.orchestration.taskId);

      const byId = await prisma.orchestrationRecord.findUnique({ where: { id: result.orchestration.id } });
      assert.ok(byId);
      const byRequestId = await prisma.orchestrationRecord.findUnique({ where: { agencyId_requestId: { agencyId, requestId } } });
      assert.equal(byRequestId?.id, result.orchestration.id);
      assert.equal(byId?.taskId, result.orchestration.taskId);
    });

    await test("OrchestrationRecord never duplicates mutable Task/Approval/Execution state (foreign keys only)", async () => {
      const orchestration = await __testing.getOrCreateOrchestration(makeRequest(agencyId, actorId, { requestId: `test-orch-${Date.now()}-i` }));
      cleanupOrchestrationIds.push(orchestration.id);
      await prisma.orchestrationRecord.update({ where: { id: orchestration.id }, data: { state: "PLANNING" } });

      const plan = syntheticHighRiskPlan();
      const result = await __testing.continueFromPlan(orchestration.id, makeRequest(agencyId, actorId), plan, adminActor);
      if (result.orchestration.taskId) cleanupTaskIds.push(result.orchestration.taskId);

      const raw = await prisma.orchestrationRecord.findUnique({ where: { id: orchestration.id } });
      const keys = Object.keys(raw ?? {});
      // The record must only ever carry foreign keys + its own coordination
      // fields — never a copy of Task.status/riskLevel/title or
      // Approval.status/riskLevel or Execution.status/result.
      const forbiddenFields = ["taskStatus", "taskRiskLevel", "taskTitle", "approvalStatus", "approvalRiskLevel", "executionStatus", "executionResult"];
      forbiddenFields.forEach((f) => assert.ok(!keys.includes(f), `OrchestrationRecord must not have field ${f}`));
    });

    if (assistant) {
      await test("permission-scoped actor without executerTaches still reaches TASK_CREATED (orchestrator does not gate on execute permission before a Task exists)", async () => {
        const requestId = `test-orch-${Date.now()}-j`;
        const result = await startOrchestration(makeRequest(agencyId, assistant.id, { requestId }), { id: assistant.id, role: assistant.role, agencyId });
        cleanupOrchestrationIds.push(result.orchestration.id);
        if (result.orchestration.taskId) cleanupTaskIds.push(result.orchestration.taskId);
        assert.equal(result.orchestration.state, "TASK_CREATED");
      });
    }
  } finally {
    if (cleanupTaskIds.length > 0) {
      await prisma.executionStep.deleteMany({ where: { execution: { taskId: { in: cleanupTaskIds } } } });
      await prisma.execution.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.approval.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
    }
    if (cleanupOrchestrationIds.length > 0) {
      await prisma.orchestrationRecord.deleteMany({ where: { id: { in: cleanupOrchestrationIds } } });
    }
    // taskService/approvalService (existing, already-tested engines) write
    // Event rows referencing the Tasks/Approvals deleted above via plain
    // metadata JSON, not a Prisma relation — same cleanup approach as
    // src/execution/__tests__/run.ts.
    await prisma.event.deleteMany({ where: { createdAt: { gte: testStartedAt } } });
    await prisma.agency.delete({ where: { id: otherAgency.id } }).catch(() => {});
  }

  await test("Task/Approval/Execution/OrchestrationRecord/Event tables return to baseline after cleanup", async () => {
    const [ordersAfter, tasksAfter, approvalsAfter, executionsAfter, eventsAfter] = await Promise.all([
      prisma.orchestrationRecord.count(),
      prisma.task.count(),
      prisma.approval.count(),
      prisma.execution.count(),
      prisma.event.count(),
    ]);
    assert.equal(ordersAfter, ordersBefore);
    assert.equal(tasksAfter, tasksBefore);
    assert.equal(approvalsAfter, approvalsBefore);
    assert.equal(executionsAfter, executionsBefore);
    assert.equal(eventsAfter, eventsBefore);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
