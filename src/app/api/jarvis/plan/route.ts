import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { planJarvisRequest } from "@/jarvis/core";

/**
 * Session-authed PLAN-only proxy for the BlackOS Jarvis panel.
 *
 * The real Jarvis Core endpoint (/api/engine/jarvis/request) uses
 * EngineApiKey Bearer auth, meant for machine callers — a browser session
 * cannot safely hold that key (it would have to ship to the client). This
 * route lets an authenticated dashboard user reach the exact same
 * planJarvisRequest() function (imported, not modified — Jarvis Core is
 * untouched) using their own session identity instead.
 *
 * Hardcoded to PLAN: this route does not accept or forward a `mode` field,
 * so it can never create a Task or trigger the Approval Engine. No
 * execution of any kind — see src/jarvis/executionPolicy.ts.
 */
const bodySchema = z.object({ message: z.string().min(1) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const agencyId = await getEffectiveAgencyId();
  if (!agencyId) {
    return NextResponse.json({ error: "Aucune agence sélectionnée." }, { status: 400 });
  }

  try {
    const plan = await planJarvisRequest({
      message: parsed.data.message,
      agencyId,
      actorId: session.user.id,
      source: "internal",
    });
    return NextResponse.json({ plan });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
