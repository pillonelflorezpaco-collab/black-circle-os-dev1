import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { approveApproval } from "@/jarvis/approvalService";
import { getEffectiveAgencyId } from "@/lib/agencyContext";

/**
 * Deliberately placed under /api/approvals/** (session auth), not
 * /api/engine/jarvis/approvals/** (EngineApiKey auth) as the task originally
 * suggested — see docs/approval-engine.md §8. Approving/rejecting requires a
 * concrete human User identity for `decidedBy`, which an agency-scoped
 * machine key doesn't carry; this mirrors the existing session-authed
 * pattern used for human dashboard actions (e.g. /api/videos/[id]/stage),
 * not the machine-to-machine /api/engine/** contract.
 *
 * Never executes anything — only flips Approval.status and Task.status
 * (PENDING → APPROVED, Task → READY). No n8n/Telegram/external call here.
 */
const bodySchema = z.object({ decisionNote: z.string().optional() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actor = { id: session.user.id, role: session.user.role, agencyId: await getEffectiveAgencyId() };
  const result = await approveApproval(id, actor, parsed.data.decisionNote);

  switch (result.status) {
    case "NOT_FOUND":
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    case "FORBIDDEN":
      return NextResponse.json({ error: result.reason }, { status: 403 });
    case "INVALID_STATE":
      return NextResponse.json({ error: result.reason }, { status: 409 });
    case "OK":
      return NextResponse.json({ approval: result.approval, execution: { allowed: false } });
  }
}
