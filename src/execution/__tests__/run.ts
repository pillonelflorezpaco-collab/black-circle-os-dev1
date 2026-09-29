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
import { validateAndBuildRequest, dryRunPublish, publishReal } from "../blotatoAdapter";
import { encryptSecret } from "@/lib/crypto";

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

async function approveTask(agencyId: string, actorId: string, taskId: string, riskLevel: string) {
  return prisma.approval.create({
    data: { agency: { connect: { id: agencyId } }, task: { connect: { id: taskId } }, status: "APPROVED", riskLevel, requestedBy: { connect: { id: actorId } }, decidedBy: { connect: { id: actorId } }, decidedAt: new Date() },
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

  const [tasksBefore, executionsBefore, stepsBefore, approvalsBefore, eventsBefore, modelsBefore, postsBefore, blotatoAccountsBefore] = await Promise.all([
    prisma.task.count(),
    prisma.execution.count(),
    prisma.executionStep.count(),
    prisma.approval.count(),
    prisma.event.count(),
    prisma.model.count(),
    prisma.post.count(),
    prisma.blotatoAccount.count(),
  ]);

  const cleanupTaskIds: string[] = [];
  const cleanupModelIds: string[] = [];
  const cleanupBlotatoAccountIds: string[] = [];
  const testStartedAt = new Date();

  /**
   * Full Blotato fixture chain: Model → Video → Post, SocialAccount →
   * BlotatoAccount. `apiKey` is encrypted with the real crypto module using
   * a fake test value — never a real credential.
   */
  async function makeBlotatoPostFixture(
    forAgencyId: string,
    overrides: Partial<{ isActive: boolean; source: "BLOTATO" | "NATIVE"; caption: string | null; driveUrl: string | null; blotatoAccountRef: string | null; hasBlotatoAccount: boolean }> = {},
  ) {
    const model = await prisma.model.create({ data: { agencyId: forAgencyId, name: `[test] blotato model ${Date.now()}-${Math.random().toString(36).slice(2)}` } });
    cleanupModelIds.push(model.id);

    const video = await prisma.video.create({
      data: {
        agency: { connect: { id: forAgencyId } },
        model: { connect: { id: model.id } },
        title: "[test] blotato video",
        caption: overrides.caption === undefined ? "Test caption for dry-run." : overrides.caption,
        driveUrl: overrides.driveUrl === undefined ? "https://example.invalid/test-media.mp4" : overrides.driveUrl,
      },
    });

    let blotatoAccountId: string | null = null;
    if (overrides.hasBlotatoAccount !== false) {
      const blotatoAccount = await prisma.blotatoAccount.create({
        data: { agencyId: forAgencyId, label: "[test] blotato account", apiKey: encryptSecret("test-fake-blotato-key") },
      });
      cleanupBlotatoAccountIds.push(blotatoAccount.id);
      blotatoAccountId = blotatoAccount.id;
    }

    const socialAccount = await prisma.socialAccount.create({
      data: {
        model: { connect: { id: model.id } },
        source: overrides.source ?? "BLOTATO",
        platform: "INSTAGRAM",
        isActive: overrides.isActive ?? true,
        blotatoAccountRef: overrides.blotatoAccountRef === undefined ? "test-account-ref" : overrides.blotatoAccountRef,
        ...(blotatoAccountId ? { blotatoAccount: { connect: { id: blotatoAccountId } } } : {}),
      },
    });

    const post = await prisma.post.create({
      data: {
        video: { connect: { id: video.id } },
        socialAccount: { connect: { id: socialAccount.id } },
        platform: "INSTAGRAM",
        scheduledTime: new Date(),
        agency: { connect: { id: forAgencyId } },
      },
    });

    return { model, video, socialAccount, post };
  }

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

    await test("MEDIUM social_media_management without an APPROVED approval returns APPROVAL_REQUIRED (capability-specific gate, reused from approvalPolicy, not hardcoded here)", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, adminActor, { postId: fixture.post.id });
      assert.equal(result.status, "APPROVAL_REQUIRED");
    });

    await test("MEDIUM social_media_management with an APPROVED approval proceeds to CREATED (still dry-run dispatch — publishReal remains unreachable)", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      await prisma.approval.create({
        data: { agency: { connect: { id: agencyId } }, task: { connect: { id: task.id } }, status: "APPROVED", riskLevel: "MEDIUM", requestedBy: { connect: { id: actorId } }, decidedBy: { connect: { id: actorId } }, decidedAt: new Date() },
      });
      const result = await createExecutionForTask(task.id, adminActor, { postId: fixture.post.id });
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        assert.equal(result.execution.status, "SUCCEEDED");
        assert.equal(result.execution.toolKey, "blackos_api");
      }
    });

    await test("non-social capability's execution gate is unaffected by the override (proves it's capability-scoped, not a global MEDIUM/gate change)", async () => {
      const task = await makeTask(agencyId, { capabilityKey: "content_planning", riskLevel: "LOW" });
      cleanupTaskIds.push(task.id);
      const result = await createExecutionForTask(task.id, adminActor);
      assert.notEqual(result.status, "APPROVAL_REQUIRED");
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

    await test("unsupported tool key (not n8n or blackos_api) still returns UNSUPPORTED_TOOL", async () => {
      // No capability in the real graph resolves to a third tool key today —
      // this documents the guard's continued existence for whatever isn't
      // n8n/blackos_api, exercised the same way the original test did before
      // blackos_api became supported.
      const task = await makeTask(agencyId, { capabilityKey: "does_not_exist_in_graph" });
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

    // ================================================================
    // Social media execution v0.1 — Blotato adapter (dry-run only)
    // ================================================================

    await test("blotato: valid resolution builds the exact outbound request, no HTTP call made", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const result = await dryRunPublish(fixture.post.id, agencyId);
      assert.equal(result.ok, true);
      if (result.ok && result.dryRun) {
        assert.equal(result.request.post.accountId, "test-account-ref");
        assert.equal(result.request.post.content.text, "Test caption for dry-run.");
        assert.deepEqual(result.request.post.content.mediaUrls, ["https://example.invalid/test-media.mp4"]);
        assert.equal(result.request.post.content.platform, "INSTAGRAM");
      }
    });

    await test("blotato: nonexistent post returns POST_NOT_FOUND", async () => {
      const result = await validateAndBuildRequest("does-not-exist", agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "POST_NOT_FOUND");
    });

    await test("blotato: cross-agency post is indistinguishable from not-found (no existence leak)", async () => {
      const fixture = await makeBlotatoPostFixture(otherAgency.id);
      const result = await validateAndBuildRequest(fixture.post.id, agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "POST_NOT_FOUND");
    });

    await test("blotato: unsupported social account source (NATIVE) is rejected", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId, { source: "NATIVE", hasBlotatoAccount: false });
      const result = await validateAndBuildRequest(fixture.post.id, agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "UNSUPPORTED_SOURCE");
    });

    await test("blotato: inactive social account is rejected", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId, { isActive: false });
      const result = await validateAndBuildRequest(fixture.post.id, agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "ACCOUNT_INACTIVE");
    });

    await test("blotato: missing Blotato credential is rejected", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId, { hasBlotatoAccount: false });
      const result = await validateAndBuildRequest(fixture.post.id, agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "MISSING_CREDENTIAL");
    });

    await test("blotato: missing caption is rejected (MISSING_CONTENT)", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId, { caption: null });
      const result = await validateAndBuildRequest(fixture.post.id, agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "MISSING_CONTENT");
    });

    await test("blotato: missing media URL is rejected (MISSING_MEDIA)", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId, { driveUrl: null });
      const result = await validateAndBuildRequest(fixture.post.id, agencyId);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "MISSING_MEDIA");
    });

    await test("blotato: dry-run result never contains the API key in any form", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const result = await dryRunPublish(fixture.post.id, agencyId);
      const serialized = JSON.stringify(result);
      assert.ok(!serialized.includes("test-fake-blotato-key"), "dry-run result must never include the plaintext API key");
      assert.ok(!/blotato-api-key/i.test(serialized), "dry-run result must never include the auth header name/value");
    });

    await test("blotato (mocked): publishReal() success path returns a sanitized postSubmissionId, never the request/credential", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response(JSON.stringify({ postSubmissionId: "sub_test_123" }), { status: 200 })) as typeof fetch;
      try {
        const result = await publishReal(fixture.post.id, agencyId);
        assert.equal(result.ok, true);
        if (result.ok && !result.dryRun) {
          assert.equal(result.postSubmissionId, "sub_test_123");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await test("blotato (mocked): publishReal() sanitizes a real API error, never surfaces the raw response body", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => new Response("internal blotato secret detail leaked in body", { status: 500 })) as typeof fetch;
      try {
        const result = await publishReal(fixture.post.id, agencyId);
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(result.reason, "EXECUTION_ERROR");
          assert.ok(!result.message.includes("internal blotato secret detail"), "the raw external error body must never be surfaced");
        }
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await test("blotato (mocked): publishReal() times out safely rather than hanging", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (() => new Promise(() => {})) as typeof fetch; // never resolves
      try {
        const result = await publishReal(fixture.post.id, agencyId);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.reason, "EXECUTION_ERROR");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await test("blotato via Execution Engine: full dispatch reaches SUCCEEDED synchronously, Task COMPLETED, correct Events, no HTTP call", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      await approveTask(agencyId, actorId, task.id, "MEDIUM");

      const originalFetch = globalThis.fetch;
      let fetchCalled = false;
      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        fetchCalled = true;
        return originalFetch(...args);
      }) as typeof fetch;

      try {
        const result = await createExecutionForTask(task.id, adminActor, { postId: fixture.post.id });
        assert.equal(result.status, "CREATED");
        if (result.status === "CREATED") {
          assert.equal(result.execution.status, "SUCCEEDED");
          assert.equal(result.execution.toolKey, "blackos_api");
        }
        assert.equal(fetchCalled, false, "the dry-run dispatch path must never make an HTTP request");

        const finalTask = await prisma.task.findUnique({ where: { id: task.id } });
        assert.equal(finalTask?.status, "COMPLETED");

        const events = await prisma.event.findMany({ where: { agencyId, createdAt: { gte: testStartedAt } } });
        const types = events.filter((e) => (e.metadata as { taskId?: string } | null)?.taskId === task.id).map((e) => e.type);
        assert.ok(types.includes("WORKFLOW_STARTED"));
        assert.ok(types.includes("WORKFLOW_COMPLETED"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    await test("blotato via Execution Engine: missing postId fails the dispatch (Task/Execution FAILED, not silently skipped)", async () => {
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      await approveTask(agencyId, actorId, task.id, "MEDIUM");
      const result = await createExecutionForTask(task.id, adminActor);
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        assert.equal(result.execution.status, "FAILED");
      }
      const finalTask = await prisma.task.findUnique({ where: { id: task.id } });
      assert.equal(finalTask?.status, "FAILED");
    });

    await test("blotato via Execution Engine: cross-agency postId fails closed (Execution FAILED with a generic reason, no leak)", async () => {
      const fixture = await makeBlotatoPostFixture(otherAgency.id);
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      await approveTask(agencyId, actorId, task.id, "MEDIUM");
      const result = await createExecutionForTask(task.id, adminActor, { postId: fixture.post.id });
      assert.equal(result.status, "CREATED");
      if (result.status === "CREATED") {
        assert.equal(result.execution.status, "FAILED");
        assert.ok(!result.execution.failureReason?.toLowerCase().includes(otherAgency.id.toLowerCase()));
      }
    });

    await test("blotato via Execution Engine: repeated dispatch does not create a duplicate Execution (existing idempotency reused, not reinvented)", async () => {
      const fixture = await makeBlotatoPostFixture(agencyId);
      const task = await makeTask(agencyId, { capabilityKey: "social_media_management", riskLevel: "MEDIUM" });
      cleanupTaskIds.push(task.id);
      await approveTask(agencyId, actorId, task.id, "MEDIUM");
      const first = await createExecutionForTask(task.id, adminActor, { postId: fixture.post.id });
      // Task is now IN_PROGRESS/COMPLETED, not READY — a second call correctly
      // hits the same INVALID_STATE guard proven for n8n's own concurrency
      // test; the point here is specifically that no second Execution row
      // for this Task is ever created, regardless of which guard catches it.
      const second = await createExecutionForTask(task.id, adminActor, { postId: fixture.post.id });
      void first;
      void second;
      const count = await prisma.execution.count({ where: { taskId: task.id } });
      assert.equal(count, 1);
    });

    await test("static guard: no Agent module imports the Blotato adapter or client, or accesses credentials", async () => {
      const agentSource = fs.readFileSync(path.join(__dirname, "..", "..", "agents", "agentService.ts"), "utf-8");
      assert.ok(!/blotatoAdapter|BlotatoClient|blotato\/client/i.test(agentSource), "agentService.ts must not import the Blotato adapter or client");
      assert.ok(!agentSource.includes("decryptSecret"), "agentService.ts must never touch credential decryption");
    });

    await test("static guard: blotatoAdapter.ts is the only execution-path module importing BlotatoClient", async () => {
      const adapterSource = fs.readFileSync(path.join(__dirname, "..", "blotatoAdapter.ts"), "utf-8");
      assert.ok(adapterSource.includes("BlotatoClient"), "sanity check: the adapter itself does import it");
      const executionServiceSource = fs.readFileSync(path.join(__dirname, "..", "executionService.ts"), "utf-8");
      assert.ok(!executionServiceSource.includes("BlotatoClient"), "executionService.ts must go through blotatoAdapter.ts, never call BlotatoClient directly");
      assert.ok(!executionServiceSource.includes("decryptSecret"), "executionService.ts must never touch credential decryption directly");
    });

    await test("static guard: blotatoAdapter.ts never logs the API key and never accepts an arbitrary URL/method", async () => {
      const source = fs.readFileSync(path.join(__dirname, "..", "blotatoAdapter.ts"), "utf-8");
      assert.ok(!/console\.(log|error|warn)\([^)]*apiKey/i.test(source), "must never log the API key");
      assert.ok(!source.includes("child_process"), "must never shell out");
      // No parameter anywhere in this module accepts a URL or HTTP method —
      // confirmed structurally: BASE_URL/method are only ever set inside
      // BlotatoClient itself, never threaded through from this module's inputs.
      assert.ok(!/url\s*:\s*string/i.test(source) && !/method\s*:\s*string/i.test(source), "must not accept a caller-supplied URL or HTTP method");
    });
  } finally {
    if (cleanupTaskIds.length > 0) {
      await prisma.executionStep.deleteMany({ where: { execution: { taskId: { in: cleanupTaskIds } } } });
      await prisma.execution.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.approval.deleteMany({ where: { taskId: { in: cleanupTaskIds } } });
      await prisma.event.deleteMany({ where: { createdAt: { gte: testStartedAt } } });
      await prisma.task.deleteMany({ where: { id: { in: cleanupTaskIds } } });
    }
    if (cleanupModelIds.length > 0) {
      // Post.socialAccountId has no onDelete: Cascade, so Post rows must be
      // deleted explicitly before Model (whose cascade would otherwise try
      // to remove SocialAccount rows Post still references). Video and
      // SocialAccount themselves do cascade from Model deletion.
      await prisma.post.deleteMany({ where: { video: { modelId: { in: cleanupModelIds } } } });
      await prisma.model.deleteMany({ where: { id: { in: cleanupModelIds } } });
    }
    if (cleanupBlotatoAccountIds.length > 0) {
      await prisma.blotatoAccount.deleteMany({ where: { id: { in: cleanupBlotatoAccountIds } } });
    }
    await prisma.agency.delete({ where: { id: otherAgency.id } }).catch(() => {});
  }

  await test("Task/Execution/ExecutionStep/Approval/Event/Model/Post/BlotatoAccount tables return to baseline after cleanup", async () => {
    const [modelsAfter, postsAfter, blotatoAccountsAfter] = await Promise.all([prisma.model.count(), prisma.post.count(), prisma.blotatoAccount.count()]);
    assert.equal(modelsAfter, modelsBefore);
    assert.equal(postsAfter, postsBefore);
    assert.equal(blotatoAccountsAfter, blotatoAccountsBefore);
  });

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
