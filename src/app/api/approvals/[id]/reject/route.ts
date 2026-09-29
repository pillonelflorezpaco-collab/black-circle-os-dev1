import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rejectApproval } from "@/jarvis/approvalService";
import { getEffectiveAgencyId } from "@/lib/agencyContext";

// See src/app/api/approvals/[id]/approve/route.ts for why this is
// session-authed rather than under /api/engine/**.
const bodySchema = z.object({ reason: z.string().min(1) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const actor = { id: session.user.id, role: session.user.role, agencyId: await getEffectiveAgencyId() };
  const result = await rejectApproval(id, actor, parsed.data.reason);

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
