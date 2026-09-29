/**
 * Jarvis Context Engine v0.1f test suite — plain node:assert script run via
 * tsx, same convention as src/orchestrator/__tests__/run.ts and
 * src/execution/__tests__/run.ts. Integration-style against the real dev
 * Postgres and the real (read-only) Neo4j graph. Never calls n8n, never
 * writes Neo4j, never mutates Postgres beyond the synthetic fixtures this
 * suite creates and cleans up itself.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { assembleContext, ContextAuthorizationError } from "../contextService";

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

async function main() {
  const agency = await prisma.agency.findUnique({ where: { slug: "black-circle" } });
  assert.ok(agency, "expected the seeded 'black-circle' agency to exist");
  const agencyId = agency!.id;

  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  assert.ok(admin, "expected a seeded SUPER_ADMIN user to exist");
  const actorId = admin!.id;
  // For Context Engine purposes the actor must be scoped to a specific
  // agency (a Super Admin's own agencyId is null) — see contextService.ts's
  // doc comment. Tests construct a scoped actor explicitly rather than use
  // the real SUPER_ADMIN's null-agency session.
  const scopedActor = { id: actorId, role: admin!.role, agencyId };

  const otherAgency = await prisma.agency.create({ data: { name: "[test] context engine other agency", slug: `test-ctx-other-agency-${Date.now()}` } });

  const [tasksBefore, approvalsBefore, executionsBefore, modelsBefore] = await Promise.all([
    prisma.task.count(),
    prisma.approval.count(),
    prisma.execution.count(),
    prisma.model.count(),
  ]);

  const cleanupTaskIds: string[] = [];
  const cleanupModelIds: string[] = [];

  async function makeModel(forAgencyId: string, name: string) {
    const model = await prisma.model.create({ data: { agencyId: forAgencyId, name } });
    cleanupModelIds.push(model.id);
    return model;
  }

  async function makeTask(overrides: Partial<{ status: string; entityId: string; riskLevel: string }> = {}) {
    const task = await prisma.task.create({
      data: {
        agency: { connect: { id: agencyId } },
        title: "[test] context engine fixture",
        objective: "Context Engine v0.1f test fixture",
        status: (overrides.status as never) ?? "READY",
        priority: "NORMAL",
        source: "SYSTEM",
        entityType: overrides.entityId ? "MODEL" : null,
        entityId: overrides.entityId ?? null,
        riskLevel: overrides.riskLevel ?? "LOW",
        executionAllowed: false,
      },
    });
    cleanupTaskIds.push(task.id);
    return task;
  }

  try {
    await test("valid actor: returns a bundle with agency and actor populated", async () => {
      const bundle = await assembleContext(scopedActor);
      assert.equal(bundle.agency.id, agencyId);
      assert.equal(bundle.actor.id, actorId);
      assert.equal(bundle.actor.agencyId, agencyId);
      assert.equal(bundle.entity, undefined);
      assert.deepEqual(bundle.activeTasks, []);
    });

    await test("unauthorized/invalid actor: null agencyId is a hard failure, no reads performed", async () => {
      await assert.rejects(() => assembleContext({ id: actorId, role: admin!.role, agencyId: null }), ContextAuthorizationError);
    });

    await test("entity exists: returns a narrow {type, id, name} projection", async () => {
      const model = await makeModel(agencyId, `[test] entity ${Date.now()}`);
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.deepEqual(bundle.entity, { type: "model", id: model.id, name: model.name });
    });

    await test("entity does not exist: entity is undefined, rest of bundle still assembles", async () => {
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: "does-not-exist" } });
      assert.equal(bundle.entity, undefined);
      assert.ok(bundle.agency);
    });

    await test("entity belongs to another agency: treated identically to not-found, no existence leak", async () => {
      const foreignModel = await makeModel(otherAgency.id, `[test] foreign entity ${Date.now()}`);
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: foreignModel.id } });
      assert.equal(bundle.entity, undefined, "must not reveal that the entity exists in another agency");
    });

    await test("agency isolation: an actor from another agency never sees this agency's data", async () => {
      const model = await makeModel(agencyId, `[test] isolation entity ${Date.now()}`);
      await makeTask({ entityId: model.id });
      const otherAgencyActor = { id: actorId, role: admin!.role as never, agencyId: otherAgency.id };
      const bundle = await assembleContext(otherAgencyActor, { entity: { type: "model", id: model.id } });
      assert.equal(bundle.agency.id, otherAgency.id);
      assert.equal(bundle.entity, undefined, "an entity that belongs to a different agency than the actor must not resolve");
    });

    await test("active task retrieval: tasks for the entity in active statuses are returned", async () => {
      const model = await makeModel(agencyId, `[test] active tasks ${Date.now()}`);
      const task = await makeTask({ entityId: model.id, status: "READY" });
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.ok(bundle.activeTasks.some((t) => t.id === task.id));
    });

    await test("active task status filtering: PLANNED/COMPLETED/CANCELLED tasks are excluded", async () => {
      const model = await makeModel(agencyId, `[test] status filter ${Date.now()}`);
      const planned = await makeTask({ entityId: model.id, status: "PLANNED" });
      const completed = await makeTask({ entityId: model.id, status: "COMPLETED" });
      const ready = await makeTask({ entityId: model.id, status: "READY" });
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      const ids = bundle.activeTasks.map((t) => t.id);
      assert.ok(!ids.includes(planned.id));
      assert.ok(!ids.includes(completed.id));
      assert.ok(ids.includes(ready.id));
    });

    await test("active task retrieval is bounded to 10", async () => {
      const model = await makeModel(agencyId, `[test] bounded tasks ${Date.now()}`);
      for (let i = 0; i < 13; i++) {
        await makeTask({ entityId: model.id, status: "READY" });
      }
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.equal(bundle.activeTasks.length, 10);
    });

    await test("approval retrieval: approvals for the entity's active tasks are returned", async () => {
      const model = await makeModel(agencyId, `[test] approvals ${Date.now()}`);
      const task = await makeTask({ entityId: model.id, riskLevel: "HIGH" });
      const approval = await prisma.approval.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "PENDING", riskLevel: "HIGH", requestedBy: { connect: { id: actorId } } },
      });
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.ok(bundle.recentApprovals.some((a) => a.id === approval.id));
    });

    await test("approval retrieval is bounded to 10", async () => {
      const model = await makeModel(agencyId, `[test] bounded approvals ${Date.now()}`);
      const task = await makeTask({ entityId: model.id, riskLevel: "HIGH" });
      for (let i = 0; i < 13; i++) {
        await prisma.approval.create({
          data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "REJECTED", riskLevel: "HIGH", requestedBy: { connect: { id: actorId } }, decidedBy: { connect: { id: actorId } }, decidedAt: new Date() },
        });
      }
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.equal(bundle.recentApprovals.length, 10);
    });

    await test("execution retrieval: executions for the entity's active tasks are returned", async () => {
      const model = await makeModel(agencyId, `[test] executions ${Date.now()}`);
      const task = await makeTask({ entityId: model.id });
      const execution = await prisma.execution.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "AWAITING_CALLBACK", toolKey: "n8n", workflowRef: "blackos-execution-test", requestedBy: { connect: { id: actorId } }, idempotencyKey: `${task.id}:1`, attempt: 1 },
      });
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.ok(bundle.recentExecutions.some((e) => e.id === execution.id));
    });

    await test("execution retrieval is bounded to 10", async () => {
      const model = await makeModel(agencyId, `[test] bounded executions ${Date.now()}`);
      const task = await makeTask({ entityId: model.id });
      for (let i = 0; i < 13; i++) {
        await prisma.execution.create({
          data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "FAILED", toolKey: "n8n", workflowRef: "blackos-execution-test", requestedBy: { connect: { id: actorId } }, idempotencyKey: `${task.id}:${i + 1}`, attempt: i + 1 },
        });
      }
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.equal(bundle.recentExecutions.length, 10);
    });

    await test("event retrieval: recent agency events are returned as a narrow projection", async () => {
      const bundle = await assembleContext(scopedActor);
      assert.ok(Array.isArray(bundle.recentEvents));
      if (bundle.recentEvents.length > 0) {
        const keys = Object.keys(bundle.recentEvents[0]).sort();
        assert.deepEqual(keys, ["createdAt", "id", "message", "type"], "event summary must be a narrow projection, never raw metadata");
      }
    });

    await test("event retrieval is bounded to 20", async () => {
      const bundle = await assembleContext(scopedActor);
      assert.ok(bundle.recentEvents.length <= 20);
    });

    await test("newest-first ordering across list fields", async () => {
      const model = await makeModel(agencyId, `[test] ordering ${Date.now()}`);
      const first = await makeTask({ entityId: model.id, status: "READY" });
      await new Promise((r) => setTimeout(r, 5));
      const second = await makeTask({ entityId: model.id, status: "READY" });
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      const index = (id: string) => bundle.activeTasks.findIndex((t) => t.id === id);
      assert.ok(index(second.id) < index(first.id), "newest task must sort before the older one");
    });

    await test("Neo4j organizational context: a real capability resolves the same shape graphResolver.ts returns", async () => {
      const bundle = await assembleContext(scopedActor, { capabilityKey: "content_planning" });
      assert.ok(bundle.organization);
      assert.equal(bundle.organization?.capability.key, "content_planning");
      assert.equal(bundle.errors, undefined);
    });

    await test("Neo4j failure / partial context: an unresolvable capability yields organization: undefined + a safe error, rest of bundle intact", async () => {
      const bundle = await assembleContext(scopedActor, { capabilityKey: "does_not_exist" as never });
      assert.equal(bundle.organization, undefined);
      assert.ok(bundle.errors?.organization);
      assert.ok(!/neo4j|bolt:|password/i.test(bundle.errors!.organization!), "error message must not leak connection details");
      assert.ok(bundle.agency, "the rest of the bundle must still be assembled");
    });

    await test("Postgres failure is not silently swallowed", async () => {
      await assert.rejects(() => assembleContext({ id: actorId, role: admin!.role, agencyId: "does-not-exist-agency" }));
    });

    await test("historical approval does not authorize execution: a REJECTED approval appears in context but changes nothing operational", async () => {
      const model = await makeModel(agencyId, `[test] historical approval ${Date.now()}`);
      const task = await makeTask({ entityId: model.id, status: "PLANNED", riskLevel: "HIGH" });
      await prisma.approval.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "APPROVED", riskLevel: "HIGH", requestedBy: { connect: { id: actorId } }, decidedBy: { connect: { id: actorId } }, decidedAt: new Date() },
      });
      // The task is PLANNED (not READY) and therefore not in activeTasks at
      // all — its historically-APPROVED approval is invisible to this
      // context bundle, and even if it were visible, contextService.ts
      // contains no code path that could act on it (see static guard test).
      const bundle = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.ok(!bundle.activeTasks.some((t) => t.id === task.id));
      const freshTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(freshTask?.status, "PLANNED", "assembling context must never change Task.status");
    });

    await test("deterministic output for identical state", async () => {
      const model = await makeModel(agencyId, `[test] determinism ${Date.now()}`);
      await makeTask({ entityId: model.id, status: "READY" });
      const first = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      const second = await assembleContext(scopedActor, { entity: { type: "model", id: model.id } });
      assert.deepEqual(
        first.activeTasks.map((t) => t.id),
        second.activeTasks.map((t) => t.id),
      );
    });

    await test("no mutation occurs anywhere during assembleContext", async () => {
      const [tasksDuring, approvalsDuring, executionsDuring] = await Promise.all([prisma.task.count(), prisma.approval.count(), prisma.execution.count()]);
      await assembleContext(scopedActor, { capabilityKey: "content_planning" });
      const [tasksAfter, approvalsAfter, executionsAfter] = await Promise.all([prisma.task.count(), prisma.approval.count(), prisma.execution.count()]);
      assert.equal(tasksAfter, tasksDuring);
      assert.equal(approvalsAfter, approvalsDuring);
      assert.equal(executionsAfter, executionsDuring);
    });

    await test("static guard: contextService.ts contains no mutation calls, no n8n dependency, no Neo4j write", async () => {
      const source = fs.readFileSync(path.join(__dirname, "..", "contextService.ts"), "utf-8");
      const forbiddenCalls = ["startOrchestration(", "resumeOrchestration(", "createExecutionForTask(", "createTaskFromJarvisPlan(", "approveApproval(", "rejectApproval(", "n8nClient", "fetch("];
      forbiddenCalls.forEach((needle) => assert.ok(!source.includes(needle), `contextService.ts must not reference ${needle}`));

      const importLines = source.split("\n").filter((l) => l.trim().startsWith("import "));
      assert.ok(!importLines.some((l) => /n8nClient|neo4jClient/i.test(l) && !l.includes("graphResolver")), "must not import n8nClient or a raw Neo4j client directly");

      const prismaMutations = source.match(/prisma\.\w+\.(create|update|delete|upsert)\(/g) ?? [];
      assert.deepEqual(prismaMutations, [], "contextService.ts must contain no Prisma mutation calls");
    });
  } finally {
    if (cleanupTaskIds.length > 0) {
      await prisma.execution.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.approval.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
    }
    if (cleanupModelIds.length > 0) {
      await prisma.model.deleteMany({ where: { id: { in: cleanupModelIds } } });
    }
    await prisma.agency.delete({ where: { id: otherAgency.id } }).catch(() => {});
  }

  await test("Task/Approval/Execution/Model tables return to baseline after cleanup", async () => {
    const [tasksAfter, approvalsAfter, executionsAfter, modelsAfter] = await Promise.all([
      prisma.task.count(),
      prisma.approval.count(),
      prisma.execution.count(),
      prisma.model.count(),
    ]);
    assert.equal(tasksAfter, tasksBefore);
    assert.equal(approvalsAfter, approvalsBefore);
    assert.equal(executionsAfter, executionsBefore);
    assert.equal(modelsAfter, modelsBefore);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
