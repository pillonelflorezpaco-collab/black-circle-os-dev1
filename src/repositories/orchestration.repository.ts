import { prisma } from "@/lib/prisma";
import type { OrchestrationState, Prisma } from "@prisma/client";

// The only module allowed to persist OrchestrationRecord — mirrors the
// repository pattern used by task/approval/execution repositories. No other
// file should call prisma.orchestrationRecord.* directly.
export const orchestrationRepository = {
  create(data: Prisma.OrchestrationRecordCreateInput) {
    return prisma.orchestrationRecord.create({ data });
  },

  findById(id: string) {
    return prisma.orchestrationRecord.findUnique({ where: { id } });
  },

  findByRequestId(agencyId: string, requestId: string) {
    return prisma.orchestrationRecord.findUnique({ where: { agencyId_requestId: { agencyId, requestId } } });
  },

  updateState(id: string, state: Prisma.OrchestrationRecordUpdateInput["state"], failureReason?: string | null) {
    return prisma.orchestrationRecord.update({
      where: { id },
      data: { state, ...(failureReason !== undefined ? { failureReason } : {}) },
    });
  },

  /**
   * Atomic compare-and-swap: transitions REQUESTED → PLANNING only if the
   * row is still REQUESTED, in one statement. Needed because the
   * (agencyId, requestId) unique constraint alone only prevents a second
   * OrchestrationRecord row — it does not stop two concurrent callers that
   * both fetched the same still-REQUESTED row from both proceeding to
   * create a Task. Returns true only for whichever caller actually won the
   * claim; the loser must treat the row as already being processed. This is
   * still the same single database constraint/row being relied on, not a
   * second idempotency mechanism.
   */
  async claimForPlanning(id: string): Promise<boolean> {
    const result = await prisma.orchestrationRecord.updateMany({
      where: { id, state: "REQUESTED" },
      data: { state: "PLANNING" },
    });
    return result.count === 1;
  },

  attachTask(id: string, taskId: string) {
    return prisma.orchestrationRecord.update({ where: { id }, data: { taskId } });
  },

  attachApproval(id: string, approvalId: string) {
    return prisma.orchestrationRecord.update({ where: { id }, data: { approvalId } });
  },

  attachExecution(id: string, executionId: string) {
    return prisma.orchestrationRecord.update({ where: { id }, data: { executionId } });
  },

  /**
   * Command Center observability (v0.1d) — a bounded, newest-first,
   * agency-scoped read. Same shape as getRecentTasks/getPendingApprovals in
   * commandCenter.service.ts: no cursor pagination, no arbitrary filters,
   * just the one dimension (state) an operator would actually want to slice
   * by. `agencyId: null` intentionally returns cross-agency results — that
   * mirrors the existing Command Center convention for Super Admins acting
   * without a selected agency (see getEffectiveAgencyId()), not a bug.
   */
  findRecent(agencyId: string | null, opts?: { state?: OrchestrationState; take?: number }) {
    return prisma.orchestrationRecord.findMany({
      where: {
        ...(agencyId ? { agencyId } : {}),
        ...(opts?.state ? { state: opts.state } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts?.take ?? 8,
    });
  },
};
