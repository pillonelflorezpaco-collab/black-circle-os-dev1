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
import { startOrchestration, resumeOrchestration, __testing } from "../orchestratorService";
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

/**
 * Drives a synthetic HIGH-risk orchestration to AWAITING_APPROVAL (real
 * Task + real PENDING Approval), then — only if `approve` is true — mutates
 * the Approval/Task rows directly to APPROVED/READY. This mutation
 * deliberately bypasses approveApproval() on purpose: it stands in for "a
 * human already approved this through the dashboard," which is the only
 * legitimate way Approval.status becomes APPROVED in production. The
 * orchestrator itself is never the one making this change — see
 * resumeOrchestration()'s doc comment.
 */
async function makeHighRiskOrchestration(agencyId: string, actorId: string, adminActor: { id: string; role: string; agencyId: string | null }, approveAndReady: boolean) {
  const orchestration = await __testing.getOrCreateOrchestration(makeRequest(agencyId, actorId, { requestId: `test-orch-resume-${Date.now()}-${Math.random().toString(36).slice(2)}` }));
  await prisma.orchestrationRecord.update({ where: { id: orchestration.id }, data: { state: "PLANNING" } });
  const result = await __testing.continueFromPlan(orchestration.id, makeRequest(agencyId, actorId), syntheticHighRiskPlan(), adminActor as never);

  if (approveAndReady) {
    await prisma.approval.update({ where: { id: result.orchestration.approvalId! }, data: { status: "APPROVED", decidedBy: { connect: { id: actorId } }, decidedAt: new Date() } });
    await prisma.task.update({ where: { id: result.orchestration.taskId! }, data: { status: "READY" } });
  }

  return { orchestrationId: result.orchestration.id, taskId: result.orchestration.taskId!, approvalId: result.orchestration.approvalId! };
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

    await test("resume: APPROVED + READY → execution is created (RESUMED)", async () => {
      const { orchestrationId, taskId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, true);
      cleanupOrchestrationIds.push(orchestrationId);
      cleanupTaskIds.push(taskId);

      const result = await resumeOrchestration(orchestrationId, adminActor);
      assert.equal(result.status, "RESUMED");
      if (result.status !== "RESUMED") return;
      assert.ok(result.orchestration.executionId, "expected an executionId to be attached");
      assert.equal(result.orchestration.state, "EXECUTING", "execution is AWAITING_CALLBACK immediately after dispatch, not yet terminal — EXECUTING is the accurate label");

      const execution = await prisma.execution.findUnique({ where: { id: result.orchestration.executionId! } });
      assert.equal(execution?.taskId, taskId);
    });

    await test("resume: PENDING approval → execution is NOT created, Approval remains PENDING (no auto-approval)", async () => {
      const { orchestrationId, approvalId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, false);
      cleanupOrchestrationIds.push(orchestrationId);

      const result = await resumeOrchestration(orchestrationId, adminActor);
      assert.equal(result.status, "APPROVAL_PENDING");
      if (result.status === "APPROVAL_PENDING") {
        assert.equal(result.orchestration.executionId, null);
        cleanupTaskIds.push(result.orchestration.taskId!);
      }

      const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
      assert.equal(approval?.status, "PENDING", "orchestrator must never approve an Approval itself");
    });

    await test("resume: APPROVED but Task not READY → execution is NOT created", async () => {
      const { orchestrationId, taskId, approvalId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, false);
      cleanupOrchestrationIds.push(orchestrationId);
      cleanupTaskIds.push(taskId);
      // Approve the Approval but deliberately do NOT move the Task to READY
      // (simulates an inconsistent/incomplete state) — resume must still refuse.
      await prisma.approval.update({ where: { id: approvalId }, data: { status: "APPROVED", decidedBy: { connect: { id: actorId } }, decidedAt: new Date() } });

      const result = await resumeOrchestration(orchestrationId, adminActor);
      assert.equal(result.status, "TASK_NOT_READY");
      if (result.status === "TASK_NOT_READY") assert.equal(result.orchestration.executionId, null);
    });

    await test("resume: OrchestrationRecord.state fraudulently says EXECUTING but real Approval is not APPROVED → still rejected", async () => {
      const { orchestrationId, approvalId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, false);
      cleanupOrchestrationIds.push(orchestrationId);
      // Directly corrupt the coordination row's state label — this must have
      // zero effect on the authorization decision, proving OrchestrationRecord
      // is not an authorization source.
      await prisma.orchestrationRecord.update({ where: { id: orchestrationId }, data: { state: "EXECUTING" } });

      const result = await resumeOrchestration(orchestrationId, adminActor);
      assert.equal(result.status, "APPROVAL_PENDING", "a fraudulent state label must not bypass the real Approval check");
      if (result.status === "APPROVAL_PENDING") {
        assert.equal(result.orchestration.executionId, null);
        cleanupTaskIds.push(result.orchestration.taskId!);
      }

      const approval = await prisma.approval.findUnique({ where: { id: approvalId } });
      assert.equal(approval?.status, "PENDING");
    });

    await test("resume: wrong agency is rejected (FORBIDDEN), no execution", async () => {
      const { orchestrationId, taskId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, true);
      cleanupOrchestrationIds.push(orchestrationId);
      cleanupTaskIds.push(taskId);

      const result = await resumeOrchestration(orchestrationId, { id: actorId, role: "OWNER", agencyId: otherAgency.id });
      assert.equal(result.status, "FORBIDDEN");

      const record = await prisma.orchestrationRecord.findUnique({ where: { id: orchestrationId } });
      assert.equal(record?.executionId, null, "a wrong-agency resume attempt must not create an execution");
    });

    if (assistant) {
      await test("resume: missing executerTaches permission → EXECUTION_FAILED, orchestration becomes FAILED (never COMPLETED)", async () => {
        const { orchestrationId, taskId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, true);
        cleanupOrchestrationIds.push(orchestrationId);
        cleanupTaskIds.push(taskId);

        const result = await resumeOrchestration(orchestrationId, { id: assistant.id, role: assistant.role, agencyId });
        assert.equal(result.status, "EXECUTION_FAILED");
        if (result.status === "EXECUTION_FAILED") {
          assert.equal(result.orchestration.state, "FAILED");
          assert.notEqual(result.orchestration.state, "COMPLETED");
        }

        const record = await prisma.orchestrationRecord.findUnique({ where: { id: orchestrationId } });
        assert.equal(record?.executionId, null, "the forbidden actor must not have created an execution");
      });
    }

    await test("resume: idempotent re-call after execution already exists → ALREADY_RESUMED, no duplicate Execution", async () => {
      const { orchestrationId, taskId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, true);
      cleanupOrchestrationIds.push(orchestrationId);
      cleanupTaskIds.push(taskId);

      const first = await resumeOrchestration(orchestrationId, adminActor);
      assert.equal(first.status, "RESUMED");
      const second = await resumeOrchestration(orchestrationId, adminActor);
      assert.equal(second.status, "ALREADY_RESUMED");
      if (first.status === "RESUMED" && second.status === "ALREADY_RESUMED") {
        assert.equal(first.orchestration.executionId, second.orchestration.executionId);
      }

      const count = await prisma.execution.count({ where: { taskId } });
      assert.equal(count, 1, "must not create a second Execution for the same Task/orchestration");
    });

    await test("resume: concurrent resume calls on the same orchestration create exactly one Execution", async () => {
      const { orchestrationId, taskId } = await makeHighRiskOrchestration(agencyId, actorId, adminActor, true);
      cleanupOrchestrationIds.push(orchestrationId);
      cleanupTaskIds.push(taskId);

      const [first, second] = await Promise.all([resumeOrchestration(orchestrationId, adminActor), resumeOrchestration(orchestrationId, adminActor)]);
      const executionIds = new Set(
        [first, second]
          .map((r) => ("orchestration" in r ? r.orchestration.executionId : null))
          .filter(Boolean),
      );
      assert.equal(executionIds.size, 1, "concurrent resumes must converge on exactly one executionId");

      const count = await prisma.execution.count({ where: { taskId } });
      assert.equal(count, 1);
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
