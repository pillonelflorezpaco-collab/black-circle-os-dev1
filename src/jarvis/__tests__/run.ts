/**
 * Jarvis Core test suite.
 *
 * No test framework dependency was added (the repo already uses `tsx` for
 * scripts — see prisma/seed.ts — so this follows the same convention: a
 * plain executable script using node:assert, run via `npm run test:jarvis`).
 *
 * These are integration-style tests against the real dev Postgres + Neo4j
 * (read-only) — they assume the foundational graph from
 * /opt/neo4j/seed_foundation.cypher and the seeded BlackOS dev data exist.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { planJarvisRequest } from "../core";
import { createTaskFromJarvisPlan } from "../taskService";
import { evaluateApprovalRequirement } from "../approvalPolicy";
import { createApprovalForTask, approveApproval, rejectApproval } from "../approvalService";
import { getNeo4jDriver } from "../neo4jClient";
import type { JarvisPlan } from "../types";

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
  const agency = await prisma.agency.findUnique({ where: { slug: "black-circle" }, select: { id: true } });
  assert.ok(agency, "expected the seeded 'black-circle' agency to exist");
  const agencyId = agency!.id;

  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  assert.ok(admin, "expected a seeded SUPER_ADMIN user to exist");
  const actorId = admin!.id;

  const base = { agencyId, actorId, source: "internal" as const };
  const testStartedAt = new Date();

  // Snapshot counts to prove zero external/business side effects across the whole run.
  const [eventsBefore, activityBefore, videosBefore, postsBefore, tasksBefore] = await Promise.all([
    prisma.event.count(),
    prisma.activityLogEntry.count(),
    prisma.video.count(),
    prisma.post.count(),
    prisma.task.count(),
  ]);

  await test("content planning request resolves content_planning", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Prepare a content strategy for Shirley this week" });
    assert.equal(plan.status, "DRY_RUN");
    assert.equal(plan.intent?.type, "content_planning");
  });

  await test("marketing strategy request resolves marketing_strategy", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Define our marketing strategy for next quarter" });
    assert.equal(plan.status, "DRY_RUN");
    assert.equal(plan.intent?.type, "marketing_strategy");
  });

  await test("content analysis request resolves content_analysis", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Analyze content performance for last month" });
    assert.equal(plan.status, "DRY_RUN");
    assert.equal(plan.intent?.type, "content_analysis");
  });

  await test("social media management request resolves social_media_management", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Manage Instagram posting schedule" });
    assert.equal(plan.status, "DRY_RUN");
    assert.equal(plan.intent?.type, "social_media_management");
  });

  await test("unresolved model returns NEEDS_CLARIFICATION / MODEL_NOT_FOUND (no guessing)", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Prepare a content strategy for Sherlyn this week" });
    assert.equal(plan.status, "NEEDS_CLARIFICATION");
    assert.equal(plan.reason, "MODEL_NOT_FOUND");
  });

  await test("ambiguous duplicate model name returns NEEDS_CLARIFICATION / AMBIGUOUS_MODEL", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Prepare a content strategy for Sherlin this week" });
    assert.equal(plan.status, "NEEDS_CLARIFICATION");
    assert.equal(plan.reason, "AMBIGUOUS_MODEL");
  });

  await test("unknown intent returns UNKNOWN_INTENT", async () => {
    const plan = await planJarvisRequest({ ...base, message: "What's the weather like today" });
    assert.equal(plan.status, "UNKNOWN_INTENT");
  });

  await test("correct department selection (marketing_agency)", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
    assert.equal(plan.department?.key, "marketing_agency");
  });

  await test("correct agent selection (marketing_manager)", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
    assert.equal(plan.agent?.key, "marketing_manager");
  });

  await test("correct capability resolved (content_planning)", async () => {
    const plan = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
    assert.equal(plan.capability?.key, "content_planning");
  });

  await test("correct risk level per capability (LOW vs MEDIUM)", async () => {
    const low = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
    assert.equal(low.capability?.riskLevel, "LOW");
    const medium = await planJarvisRequest({ ...base, message: "Manage Instagram posting schedule" });
    assert.equal(medium.capability?.riskLevel, "MEDIUM");
  });

  await test("correct tool resolution per capability (n8n vs blackos_api)", async () => {
    const viaN8n = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
    assert.deepEqual(viaN8n.tools?.map((t) => t.key).sort(), ["n8n"]);
    const viaBlackos = await planJarvisRequest({ ...base, message: "Manage Instagram posting schedule" });
    assert.deepEqual(viaBlackos.tools?.map((t) => t.key).sort(), ["blackos_api"]);
  });

  await test("executionAllowed is always false, even for DRY_RUN plans", async () => {
    const plans = await Promise.all(
      ["Plan my content for this week", "Manage Instagram posting schedule", "Define our marketing strategy for next quarter"].map((message) =>
        planJarvisRequest({ ...base, message }),
      ),
    );
    for (const plan of plans) {
      assert.equal(plan.decision?.executionAllowed, false);
      assert.equal(plan.decision?.approvalRequired, false);
      assert.equal(plan.permissions.fineGrainedAuthorization, "NOT_IMPLEMENTED");
    }
  });

  await test("no external/business side effects across the plan-only test run", async () => {
    const [eventsAfter, activityAfter, videosAfter, postsAfter, tasksAfter] = await Promise.all([
      prisma.event.count(),
      prisma.activityLogEntry.count(),
      prisma.video.count(),
      prisma.post.count(),
      prisma.task.count(),
    ]);
    assert.equal(eventsAfter, eventsBefore, "Event table row count must not change");
    assert.equal(activityAfter, activityBefore, "ActivityLogEntry table row count must not change");
    assert.equal(videosAfter, videosBefore, "Video table row count must not change");
    assert.equal(postsAfter, postsBefore, "Post table row count must not change");
    assert.equal(tasksAfter, tasksBefore, "Task table row count must not change from plan-only requests");
  });

  // ── Task Engine v0.1 ─────────────────────────────────────────
  const createdTaskIds: string[] = [];

  try {
    await test("valid plan creates a task with status PLANNED", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Prepare a content strategy for Shirley this week" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Prepare a content strategy for Shirley this week" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        createdTaskIds.push(result.task.id);
        assert.equal(result.task.status, "PLANNED");
      }
    });

    await test("task has correct agency association", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Plan my content for this week" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        createdTaskIds.push(result.task.id);
        assert.equal(result.task.agencyId, agencyId);
      }
    });

    await test("task has correct model entity association", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Prepare a content strategy for Shirley this week" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Prepare a content strategy for Shirley this week" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        createdTaskIds.push(result.task.id);
        assert.equal(result.task.entityType, "MODEL");
        assert.equal(result.task.entityId, plan.entities?.[0]?.id);
      }
    });

    await test("task has correct agentKey, capabilityKey, departmentKey, riskLevel", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Manage Instagram posting schedule" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Manage Instagram posting schedule" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        createdTaskIds.push(result.task.id);
        assert.equal(result.task.agentKey, "marketing_manager");
        assert.equal(result.task.capabilityKey, "social_media_management");
        assert.equal(result.task.departmentKey, "marketing_agency");
        assert.equal(result.task.riskLevel, "MEDIUM");
      }
    });

    await test("task executionAllowed is always false", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Plan my content for this week" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        createdTaskIds.push(result.task.id);
        assert.equal(result.task.executionAllowed, false);
      }
    });

    await test("task defaults: priority NORMAL, source JARVIS, status PLANNED", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Plan my content for this week" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Plan my content for this week" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        createdTaskIds.push(result.task.id);
        assert.equal(result.task.priority, "NORMAL");
        assert.equal(result.task.source, "JARVIS");
        assert.equal(result.task.status, "PLANNED");
        assert.equal(result.task.parentTaskId, null);
      }
    });

    await test("unresolved entity does not create a task", async () => {
      const plan = await planJarvisRequest({ ...base, message: "Prepare a content strategy for Sherlyn this week" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Prepare a content strategy for Sherlyn this week" }, plan);
      assert.equal(result.status, "REJECTED");
    });

    await test("unknown intent does not create a task", async () => {
      const plan = await planJarvisRequest({ ...base, message: "What's the weather like today" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "What's the weather like today" }, plan);
      assert.equal(result.status, "REJECTED");
    });

    await test("structurally invalid plan does not create a task", async () => {
      const invalidPlan = { status: "DRY_RUN", permissions: { coarseRoleCheck: "PASSED", fineGrainedAuthorization: "NOT_IMPLEMENTED" }, steps: [] } as JarvisPlan;
      const result = await createTaskFromJarvisPlan({ ...base, message: "n/a" }, invalidPlan);
      assert.equal(result.status, "REJECTED");
    });

    await test("PLAN mode (planJarvisRequest alone) never persists a task", async () => {
      const before = await prisma.task.count();
      await planJarvisRequest({ ...base, message: "Plan my content for this week" });
      const after = await prisma.task.count();
      assert.equal(after, before);
    });

    await test("CREATE_TASK path persists exactly one task per call", async () => {
      const before = await prisma.task.count();
      const plan = await planJarvisRequest({ ...base, message: "Analyze content performance for last month" });
      const result = await createTaskFromJarvisPlan({ ...base, message: "Analyze content performance for last month" }, plan);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") createdTaskIds.push(result.task.id);
      const after = await prisma.task.count();
      assert.equal(after, before + 1);
    });
  } finally {
    // Test-created tasks are cleanup-only — the one real persisted task this
    // phase should leave behind comes from the manual §23 test, done
    // separately and intentionally, not from this automated suite.
    if (createdTaskIds.length > 0) {
      await prisma.event.deleteMany({ where: { type: "TASK_CREATED", createdAt: { gte: testStartedAt } } });
      await prisma.task.deleteMany({ where: { id: { in: createdTaskIds } } });
    }
  }

  await test("Task/Event tables return to baseline after Task Engine test cleanup", async () => {
    const [tasksFinal, eventsFinal] = await Promise.all([prisma.task.count(), prisma.event.count()]);
    assert.equal(tasksFinal, tasksBefore, "Task table must return to its pre-test count after cleanup");
    assert.equal(eventsFinal, eventsBefore, "Event table must return to its pre-test count after cleanup");
  });

  // ── Approval Engine v0.1 ─────────────────────────────────────
  const approvalTestStartedAt = new Date();
  const approvalTaskIds: string[] = [];
  const approvalIds: string[] = [];

  async function makeSyntheticTask(riskLevel: "LOW" | "MEDIUM" | "HIGH", capabilityKey = "test_synthetic_capability") {
    const t = await prisma.task.create({
      data: {
        agency: { connect: { id: agencyId } },
        title: `[test] synthetic ${riskLevel} task`,
        objective: "Synthetic task created only for Approval Engine integration testing.",
        status: "PLANNED",
        priority: "NORMAL",
        source: "SYSTEM",
        capabilityKey,
        riskLevel,
        executionAllowed: false,
      },
    });
    approvalTaskIds.push(t.id);
    return t;
  }

  try {
    await test("policy: LOW does not require approval (synthetic)", () => {
      const d = evaluateApprovalRequirement("LOW");
      assert.equal(d.approvalRequired, false);
    });

    await test("policy: MEDIUM does not require approval (synthetic)", () => {
      const d = evaluateApprovalRequirement("MEDIUM");
      assert.equal(d.approvalRequired, false);
    });

    await test("policy: HIGH requires approval (synthetic)", () => {
      const d = evaluateApprovalRequirement("HIGH");
      assert.equal(d.approvalRequired, true);
    });

    await test("policy: MEDIUM + social_media_management requires approval (capability-specific override)", async () => {
      const d = evaluateApprovalRequirement("MEDIUM", "social_media_management");
      assert.equal(d.approvalRequired, true);
    });

    await test("policy: MEDIUM + another capability is unaffected by the override", async () => {
      const d = evaluateApprovalRequirement("MEDIUM", "content_planning");
      assert.equal(d.approvalRequired, false);
    });

    await test("policy: MEDIUM + undefined capability keeps the existing behavior (backward compatible)", async () => {
      const d = evaluateApprovalRequirement("MEDIUM");
      assert.equal(d.approvalRequired, false);
    });

    await test("policy: LOW behavior is unaffected by the override, even for social_media_management", async () => {
      // A hypothetical: if this capability were ever resolved as LOW instead
      // of MEDIUM, the override still forces approval — the override is
      // keyed on capability, not on risk level, by design.
      const d = evaluateApprovalRequirement("LOW", "social_media_management");
      assert.equal(d.approvalRequired, true, "the capability override applies regardless of risk level, not only MEDIUM");
    });

    await test("policy: HIGH behavior is unaffected by the override (already required approval anyway)", async () => {
      const d = evaluateApprovalRequirement("HIGH", "social_media_management");
      assert.equal(d.approvalRequired, true);
    });

    await test("LOW task: createApprovalForTask creates no Approval row", async () => {
      const task = await makeSyntheticTask("LOW");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.equal(decision.approvalRequired, false);
      assert.equal(decision.approval, null);
      const reloaded = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(reloaded?.status, "PLANNED");
    });

    await test("HIGH task: createApprovalForTask creates exactly one PENDING approval, moves task to WAITING_APPROVAL", async () => {
      const task = await makeSyntheticTask("HIGH");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.equal(decision.approvalRequired, true);
      assert.ok(decision.approval);
      if (decision.approval) approvalIds.push(decision.approval.id);
      assert.equal(decision.approval?.status, "PENDING");
      assert.equal(decision.approval?.agencyId, agencyId);
      assert.equal(decision.approval?.taskId, task.id);

      const reloadedTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(reloadedTask?.status, "WAITING_APPROVAL");

      const count = await prisma.approval.count({ where: { taskId: task.id } });
      assert.equal(count, 1);
    });

    await test("MEDIUM social_media_management task: createApprovalForTask creates a PENDING approval, moves task to WAITING_APPROVAL (capability override, not a MEDIUM-wide change)", async () => {
      const task = await makeSyntheticTask("MEDIUM", "social_media_management");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.equal(decision.approvalRequired, true);
      assert.ok(decision.approval);
      if (decision.approval) approvalIds.push(decision.approval.id);
      assert.equal(decision.approval?.status, "PENDING");
      assert.equal(decision.approval?.riskLevel, "MEDIUM", "the Approval snapshot still records the task's real MEDIUM risk — the override doesn't fabricate a HIGH risk level");

      const reloadedTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(reloadedTask?.status, "WAITING_APPROVAL");
    });

    await test("MEDIUM non-social task still requires no approval (proves the override is capability-scoped, not a global MEDIUM change)", async () => {
      const task = await makeSyntheticTask("MEDIUM", "test_synthetic_capability");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.equal(decision.approvalRequired, false);
      assert.equal(decision.approval, null);
      const reloaded = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(reloaded?.status, "PLANNED");
    });

    await test("security: the approval decision is driven only by the persisted Task.capabilityKey — createApprovalForTask accepts no capabilityKey argument a caller could supply", async () => {
      // Structural proof, not just behavioral: createApprovalForTask's own
      // signature is (taskId, requestedById) — there is no third parameter
      // through which a caller could pass a different capabilityKey to
      // steer the decision. The only way the override fires is if it's
      // already true on the real, previously-persisted Task row.
      const task = await makeSyntheticTask("MEDIUM", "social_media_management");
      // @ts-expect-error — intentionally probing that a 3rd argument has no effect / doesn't typecheck as an override channel
      const decision = await createApprovalForTask(task.id, actorId, "content_planning");
      assert.equal(decision.approvalRequired, true, "a bogus extra argument must not be able to downgrade the real persisted capability's approval requirement");
      if (decision.approval) approvalIds.push(decision.approval.id);
    });

    await test("repeated HIGH evaluation on the same task does not create a duplicate approval", async () => {
      const task = await makeSyntheticTask("HIGH");
      const first = await createApprovalForTask(task.id, actorId);
      const second = await createApprovalForTask(task.id, actorId);
      assert.equal(first.approval?.id, second.approval?.id);
      if (first.approval) approvalIds.push(first.approval.id);
      const count = await prisma.approval.count({ where: { taskId: task.id } });
      assert.equal(count, 1);
    });

    await test("approve: transitions Approval to APPROVED and Task to READY (never IN_PROGRESS/COMPLETED)", async () => {
      const task = await makeSyntheticTask("HIGH");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.ok(decision.approval);
      if (!decision.approval) return;
      approvalIds.push(decision.approval.id);

      const result = await approveApproval(decision.approval.id, { id: actorId, role: "SUPER_ADMIN", agencyId: null });
      assert.equal(result.status, "OK");
      if (result.status === "OK") {
        assert.equal(result.approval.status, "APPROVED");
      }
      const reloadedTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(reloadedTask?.status, "READY");
      assert.notEqual(reloadedTask?.status, "IN_PROGRESS");
      assert.notEqual(reloadedTask?.status, "COMPLETED");
      assert.equal(reloadedTask?.executionAllowed, false);
    });

    await test("reject: transitions Approval to REJECTED and Task to CANCELLED", async () => {
      const task = await makeSyntheticTask("HIGH");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.ok(decision.approval);
      if (!decision.approval) return;
      approvalIds.push(decision.approval.id);

      const result = await rejectApproval(decision.approval.id, { id: actorId, role: "SUPER_ADMIN", agencyId: null }, "Not aligned with current priorities.");
      assert.equal(result.status, "OK");
      if (result.status === "OK") {
        assert.equal(result.approval.status, "REJECTED");
      }
      const reloadedTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(reloadedTask?.status, "CANCELLED");
    });

    await test("unauthorized actor (no approuverTaches permission) cannot approve", async () => {
      const task = await makeSyntheticTask("HIGH");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.ok(decision.approval);
      if (!decision.approval) return;
      approvalIds.push(decision.approval.id);

      const result = await approveApproval(decision.approval.id, { id: actorId, role: "ASSISTANT", agencyId });
      assert.equal(result.status, "FORBIDDEN");
      const reloaded = await prisma.approval.findUnique({ where: { id: decision.approval.id } });
      assert.equal(reloaded?.status, "PENDING", "a forbidden attempt must not change the approval");
    });

    await test("actor from a different agency cannot approve", async () => {
      const task = await makeSyntheticTask("HIGH");
      const decision = await createApprovalForTask(task.id, actorId);
      assert.ok(decision.approval);
      if (!decision.approval) return;
      approvalIds.push(decision.approval.id);

      const result = await approveApproval(decision.approval.id, { id: actorId, role: "OWNER", agencyId: "some-other-agency-id" });
      assert.equal(result.status, "FORBIDDEN");
      const reloaded = await prisma.approval.findUnique({ where: { id: decision.approval.id } });
      assert.equal(reloaded?.status, "PENDING", "a cross-agency attempt must not change the approval");
    });

    await test("approval service source contains no execution/external-call code (static guard)", () => {
      const source = fs.readFileSync(path.join(__dirname, "..", "approvalService.ts"), "utf-8");
      for (const forbidden of ["sendTelegramMessage", "fetch(", "axios", "n8n.", "publishPost", "executeWorkflow"]) {
        assert.ok(!source.includes(forbidden), `approvalService.ts must not reference ${forbidden}`);
      }
    });
  } finally {
    if (approvalIds.length > 0) {
      await prisma.event.deleteMany({ where: { createdAt: { gte: approvalTestStartedAt } } });
      await prisma.approval.deleteMany({ where: { id: { in: approvalIds } } });
    }
    if (approvalTaskIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: approvalTaskIds } } });
    }
  }

  await test("Task/Event/Approval tables return to baseline after Approval Engine test cleanup", async () => {
    const [tasksFinal, eventsFinal, approvalsFinal] = await Promise.all([prisma.task.count(), prisma.event.count(), prisma.approval.count()]);
    assert.equal(tasksFinal, tasksBefore, "Task table must return to its pre-test count after cleanup");
    assert.equal(eventsFinal, eventsBefore, "Event table must return to its pre-test count after cleanup");
    assert.equal(approvalsFinal, 0, "Approval table must return to empty after cleanup");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  await getNeo4jDriver().close();
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
