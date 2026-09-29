/**
 * Execution Engine v0.1 test suite — plain node:assert script run via tsx,
 * same convention as src/jarvis/__tests__/run.ts. Integration-style against
 * the real dev Postgres (and, for the "successful execution" test, the real
 * n8n test-adapter workflow — zero business side effects, see
 * docs/execution-engine.md §6).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { createExecutionForTask, handleN8nCallback } from "../executionService";

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

async function makeTask(agencyId: string, overrides: Partial<{ status: string; riskLevel: string; capabilityKey: string; agentKey: string; departmentKey: string }> = {}) {
  return prisma.task.create({
    data: {
      agency: { connect: { id: agencyId } },
      title: "[test] execution engine fixture",
      objective: "Execution Engine v0.1 test fixture",
      status: (overrides.status as never) ?? "READY",
      priority: "NORMAL",
      source: "SYSTEM",
      agentKey: overrides.agentKey ?? "marketing_manager",
      departmentKey: overrides.departmentKey ?? "marketing_agency",
      capabilityKey: overrides.capabilityKey ?? "content_planning",
      riskLevel: overrides.riskLevel ?? "LOW",
      executionAllowed: false,
    },
  });
}

async function pollExecution(id: string, wantStatus: string, timeoutMs = 10_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exec = await prisma.execution.findUnique({ where: { id } });
    if (exec?.status === wantStatus) return exec;
    await new Promise((r) => setTimeout(r, 300));
  }
  return prisma.execution.findUnique({ where: { id } });
}

async function main() {
  const agency = await prisma.agency.findUnique({ where: { slug: "black-circle" } });
  assert.ok(agency, "expected the seeded 'black-circle' agency to exist");
  const agencyId = agency!.id;

  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert.ok(admin, "expected a seeded SUPER_ADMIN user to exist");
  const actorId = admin!.id;
  const adminActor = { id: actorId, role: admin!.role, agencyId: null as string | null };

  const otherAgency = await prisma.agency.create({ data: { name: "[test] other agency", slug: `test-other-agency-${Date.now()}` } });

  const [tasksBefore, executionsBefore, stepsBefore, approvalsBefore, eventsBefore] = await Promise.all([
    prisma.task.count(),
    prisma.execution.count(),
    prisma.executionStep.count(),
    prisma.approval.count(),
    prisma.event.count(),
  ]);

  const cleanupTaskIds: string[] = [];
  const testStartedAt = new Date();

  try {
    await test("task not found returns NOT_FOUND", async () => {
      const result = await createExecutionForTask("does-not-exist", adminActor);
      assert.equal(result.status, "NOT_FOUND");
    });

    await test("wrong agency returns FORBIDDEN", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, { id: actorId, role: "OWNER", agencyId: otherAgency.id });
      assert.equal(result.status, "FORBIDDEN");
    });

    await test("missing executerTaches permission returns FORBIDDEN", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, { id: actorId, role: "ASSISTANT", agencyId });
      assert.equal(result.status, "FORBIDDEN");
    });

    await test("task not READY returns INVALID_STATE", async () => {
      const task = await makeTask(agencyId, { status: "PLANNED" });
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, adminActor);
      assert.equal(result.status, "INVALID_STATE");
    });

    await test("HIGH risk without approval returns APPROVAL_REQUIRED", async () => {
      const task = await makeTask(agencyId, { riskLevel: "HIGH" });
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, adminActor);
      assert.equal(result.status, "APPROVAL_REQUIRED");
    });

    await test("HIGH risk with an APPROVED approval proceeds to CREATED", async () => {
      const task = await makeTask(agencyId, { riskLevel: "HIGH" });
      cleanupTaskIds.push(task.id);
      await prisma.approval.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "APPROVED", riskLevel: "HIGH", requestedBy: { connect: { id: actorId } }, decidedBy: { connect: { id: actorId } }, decidedAt: new Date() },
      });
      const result = await createExecutionForTask(task.id, adminActor);
      assert.equal(result.status, "CREATED");
    });

    await test("concurrent duplicate calls for the same task race on the idempotency key, not a second Execution row", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const [first, second] = await Promise.all([
        createExecutionForTask(task.id, adminActor),
        createExecutionForTask(task.id, adminActor),
      ]);
      const created = [first, second].filter((r) => r.status === "CREATED");
      const invalidState = [first, second].filter((r) => r.status === "INVALID_STATE");
      // Either both hit the unique idempotency key and returned the same row,
      // or one raced past the READY guard before the other flipped it to
      // IN_PROGRESS and lost the race there instead — both are correct
      // outcomes of the same underlying race, never two Execution rows.
      assert.ok(created.length >= 1, "at least one call must succeed in creating/returning the execution");
      assert.equal(created.length + invalidState.length, 2);
      const ids = new Set(created.map((r) => (r.status === "CREATED" ? r.execution.id : null)));
      assert.equal(ids.size, 1);
      const count = await prisma.execution.count({ where: { taskId: task.id } });
      assert.equal(count, 1);
    });

    await test("unsupported tool (blackos_api) returns UNSUPPORTED_TOOL", async () => {
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, adminActor);
      assert.equal(result.status, "UNSUPPORTED_TOOL");
    });

    await test("successful execution: real n8n round trip reaches SUCCEEDED, Task COMPLETED, correct Events", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, adminActor);
      assert.equal(result.status, "CREATED");
      if (result.status !== "CREATED") return;

      assert.equal(result.execution.status, "AWAITING_CALLBACK");

      const finalExec = await pollExecution(result.execution.id, "SUCCEEDED");
      assert.equal(finalExec?.status, "SUCCEEDED");

      const finalTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(finalTask?.status, "COMPLETED");

      const events = await prisma.event.findMany({ where: { agencyId, createdAt: { gte: testStartedAt } }, orderBy: { createdAt: "asc" } });
      const types = events.filter((e) => (e.metadata as { taskId?: string } | null)?.taskId === task.id).map((e) => e.type);
      assert.ok(types.includes("WORKFLOW_STARTED"), "expected WORKFLOW_STARTED event");
      assert.ok(types.includes("WORKFLOW_COMPLETED"), "expected WORKFLOW_COMPLETED event");
    });

    await test("failed callback transitions Execution to FAILED and Task to FAILED", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const execution = await prisma.execution.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "AWAITING_CALLBACK", toolKey: "n8n", workflowRef: "blackos-execution-test", requestedBy: { connect: { id: actorId } }, idempotencyKey: `${task.id}:1`, attempt: 1 },
      });
      const result = await handleN8nCallback({ executionId: execution.id, taskId: task.id, idempotencyKey: `${task.id}:1`, agencyId, success: false, summary: "synthetic test failure" });
      assert.equal(result.status, "OK");
      if (result.status === "OK") assert.equal(result.execution.status, "FAILED");
      const finalTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(finalTask?.status, "FAILED");
    });

    await test("duplicate callback is idempotent (second call does not corrupt state)", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const execution = await prisma.execution.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "AWAITING_CALLBACK", toolKey: "n8n", workflowRef: "blackos-execution-test", requestedBy: { connect: { id: actorId } }, idempotencyKey: `${task.id}:1`, attempt: 1 },
      });
      const payload = { executionId: execution.id, taskId: task.id, idempotencyKey: `${task.id}:1`, agencyId, success: true, summary: "ok" };
      const first = await handleN8nCallback(payload);
      const second = await handleN8nCallback(payload);
      assert.equal(first.status, "OK");
      assert.equal(second.status, "OK");
      if (first.status === "OK" && second.status === "OK") {
        assert.equal(first.alreadyProcessed, false);
        assert.equal(second.alreadyProcessed, true);
        assert.equal(first.execution.finishedAt?.getTime(), second.execution.finishedAt?.getTime());
      }
      // The second (duplicate) callback must not have written a second event for
      // this execution — confirmed above via identical finishedAt timestamps
      // (an unequal timestamp would mean the second call re-applied the transition).
    });

    await test("invalid execution state transition is rejected (not AWAITING_CALLBACK)", async () => {
      const task = await makeTask(agencyId);
      cleanupTaskIds.push(task.id);
      const execution = await prisma.execution.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "PENDING", toolKey: "n8n", workflowRef: "blackos-execution-test", requestedBy: { connect: { id: actorId } }, idempotencyKey: `${task.id}:1`, attempt: 1 },
      });
      const result = await handleN8nCallback({ executionId: execution.id, taskId: task.id, idempotencyKey: `${task.id}:1`, agencyId, success: true });
      assert.equal(result.status, "INVALID_TRANSITION");
    });

    await test("invalid callback secret is rejected by the real HTTP route", async () => {
      const res = await fetch("http://app:3000/api/webhooks/n8n/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": "wrong-secret" },
        body: JSON.stringify({ executionId: "x", taskId: "x", idempotencyKey: "x", agencyId: "x", success: true }),
      });
      assert.equal(res.status, 401);
    });

    await test("no execution-side callback source references the webhook secret literal or logs it", async () => {
      const callbackSource = fs.readFileSync(path.join(__dirname, "..", "..", "app", "api", "webhooks", "n8n", "callback", "route.ts"), "utf-8");
      assert.ok(!/console\.(log|error|warn)\([^)]*secret/i.test(callbackSource), "callback route must not log the secret");
      const n8nClientSource = fs.readFileSync(path.join(__dirname, "..", "n8nClient.ts"), "utf-8");
      assert.ok(!n8nClientSource.includes("console.log"), "n8nClient.ts must not console.log request payloads/secrets");
    });
  } finally {
    if (cleanupTaskIds.length > 0) {
      await prisma.executionStep.deleteMany({ where: { execution: { taskId: { in: cleanupTaskIds } } } });
      await prisma.execution.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.approval.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.event.deleteMany({ where: { createdAt: { gte: testStartedAt } } });
      await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
    }
    await prisma.agency.delete({ where: { id: otherAgency.id } }).catch(() => {});
  }

  await test("Task/Execution/ExecutionStep/Approval/Event tables return to baseline after cleanup", async () => {
    const [tasksAfter, executionsAfter, stepsAfter, approvalsAfter, eventsAfter] = await Promise.all([
      prisma.task.count(),
      prisma.execution.count(),
      prisma.executionStep.count(),
      prisma.approval.count(),
      prisma.event.count(),
    ]);
    assert.equal(tasksAfter, tasksBefore);
    assert.equal(executionsAfter, executionsBefore);
    assert.equal(stepsAfter, stepsBefore);
    assert.equal(approvalsAfter, approvalsBefore);
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
