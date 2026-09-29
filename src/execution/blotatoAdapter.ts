import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { BlotatoClient } from "@/lib/blotato/client";
import type { BlotatoCreatePostRequest } from "@/lib/blotato/types";

/**
 * The ONLY module allowed to call the Blotato API from the Execution Engine
 * path — mirrors n8nClient.ts's "sole caller" discipline exactly. Never
 * imported by the Agent, Context Engine, or Orchestrator.
 *
 * V0.1 boundary (see docs/execution-engine.md and docs/social-media-execution.md):
 * only dryRunPublish() is wired into executionService.ts's dispatch. publishReal()
 * exists, is unit-tested against a mocked Blotato response, and is never called
 * from any production code path in this phase — wiring it in requires a
 * separate, explicit human authorization decision, which this phase does not
 * make. See the "Real publish boundary" section of that doc for exactly
 * what's missing.
 */

const REQUEST_TIMEOUT_MS = 10_000;

export type BlotatoValidationFailureReason = "POST_NOT_FOUND" | "UNSUPPORTED_SOURCE" | "ACCOUNT_INACTIVE" | "MISSING_CREDENTIAL" | "MISSING_CONTENT" | "MISSING_MEDIA";

export type BlotatoValidationResult =
  | { ok: true; request: BlotatoCreatePostRequest; postId: string; socialAccountId: string; blotatoAccountId: string }
  | { ok: false; reason: BlotatoValidationFailureReason; message: string };

export type BlotatoPublishResult =
  | { ok: true; dryRun: true; request: BlotatoCreatePostRequest }
  | { ok: true; dryRun: false; postSubmissionId: string }
  | { ok: false; reason: BlotatoValidationFailureReason | "EXECUTION_ERROR"; message: string };

/**
 * Resolves and validates the exact request that WOULD be sent to Blotato —
 * never sends it. Fails closed: a Post that doesn't exist and a Post that
 * belongs to another agency return the identical POST_NOT_FOUND reason, so
 * a caller can never distinguish "doesn't exist" from "exists elsewhere"
 * (same leak-proofing discipline as Context Engine's entity resolution).
 *
 * Cross-agency ownership is checked at three independent points
 * (Post.agencyId, SocialAccount→Model.agencyId, BlotatoAccount.agencyId) —
 * defense in depth, not because any one of them is expected to disagree.
 */
export async function validateAndBuildRequest(postId: string, agencyId: string): Promise<BlotatoValidationResult> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      video: { select: { caption: true, driveUrl: true } },
      socialAccount: {
        include: {
          model: { select: { agencyId: true } },
          blotatoAccount: { select: { id: true, apiKey: true, agencyId: true } },
        },
      },
    },
  });

  if (!post || post.agencyId !== agencyId || post.socialAccount.model.agencyId !== agencyId) {
    return { ok: false, reason: "POST_NOT_FOUND", message: "No matching post for this agency." };
  }

  const socialAccount = post.socialAccount;

  if (socialAccount.source !== "BLOTATO") {
    return { ok: false, reason: "UNSUPPORTED_SOURCE", message: `Social account source "${socialAccount.source}" is not supported in v0.1 — only BLOTATO is.` };
  }
  if (!socialAccount.isActive) {
    return { ok: false, reason: "ACCOUNT_INACTIVE", message: "The target social account is not active." };
  }
  if (!socialAccount.blotatoAccount || socialAccount.blotatoAccount.agencyId !== agencyId || !socialAccount.blotatoAccountRef) {
    return { ok: false, reason: "MISSING_CREDENTIAL", message: "No usable Blotato credential is configured for this account." };
  }
  if (!post.video.caption) {
    return { ok: false, reason: "MISSING_CONTENT", message: "The post's video has no caption to publish." };
  }
  if (!post.video.driveUrl) {
    return { ok: false, reason: "MISSING_MEDIA", message: "The post's video has no media URL to publish." };
  }

  // Note: `target` is deliberately minimal (targetType only) — this v0.1
  // adapter does not model Blotato's richer per-platform target shape
  // (pageId/boardId/privacyStatus/etc.). A real second platform needing
  // those fields is a concrete reason to extend this, not a reason to add
  // them speculatively now.
  const request: BlotatoCreatePostRequest = {
    post: {
      accountId: socialAccount.blotatoAccountRef,
      content: {
        text: post.video.caption,
        mediaUrls: [post.video.driveUrl],
        platform: socialAccount.platform,
      },
      target: { targetType: "POST" },
    },
    scheduledTime: post.scheduledTime.toISOString(),
  };

  return { ok: true, request, postId: post.id, socialAccountId: socialAccount.id, blotatoAccountId: socialAccount.blotatoAccount.id };
}

/**
 * The only path wired into executionService.ts in v0.1. Validates the full
 * request and returns it — the API key is never read, decrypted, or
 * touched, and no HTTP request to Blotato is ever made.
 */
export async function dryRunPublish(postId: string, agencyId: string): Promise<BlotatoPublishResult> {
  const validation = await validateAndBuildRequest(postId, agencyId);
  if (!validation.ok) return validation;
  return { ok: true, dryRun: true, request: validation.request };
}

/**
 * NOT called by executionService.ts in this phase — see the module doc
 * comment above. Implemented and unit-tested (with a mocked Blotato
 * response) so the real path is reviewable, without enabling it.
 */
export async function publishReal(postId: string, agencyId: string): Promise<BlotatoPublishResult> {
  const validation = await validateAndBuildRequest(postId, agencyId);
  if (!validation.ok) return validation;

  const blotatoAccount = await prisma.blotatoAccount.findUnique({ where: { id: validation.blotatoAccountId }, select: { apiKey: true } });
  if (!blotatoAccount) {
    return { ok: false, reason: "MISSING_CREDENTIAL", message: "No usable Blotato credential is configured for this account." };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(blotatoAccount.apiKey);
  } catch {
    // Never surface the raw decryption error (could hint at key material) — sanitized only.
    return { ok: false, reason: "MISSING_CREDENTIAL", message: "The stored Blotato credential could not be read." };
  }

  const client = new BlotatoClient(apiKey);

  try {
    const response = await withTimeout(client.createPost(validation.request), REQUEST_TIMEOUT_MS);
    return { ok: true, dryRun: false, postSubmissionId: response.postSubmissionId };
  } catch {
    // Never surface the raw error — it may include response bodies from
    // Blotato that this module cannot guarantee are safe to return upstream.
    return { ok: false, reason: "EXECUTION_ERROR", message: "The Blotato publish request failed." };
  }
}

/**
 * Best-effort timeout: the underlying fetch() inside BlotatoClient is not
 * actually aborted (BlotatoClient has no AbortSignal support and this
 * module deliberately does not modify it — narrow scope) — this only
 * ensures the caller is never left waiting indefinitely. Documented
 * honestly as a partial mitigation, not a true cancellation.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Blotato request timed out.")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
