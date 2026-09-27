import { NextRequest, NextResponse } from "next/server";
import { verifyEngineApiKey } from "@/lib/engineAuth";

/**
 * Throwaway Phase 0 verification route — proves the /api/engine/** Bearer
 * auth contract works end-to-end. Remove once Phase 1 adds real routes
 * (posts/accounts/analytics) that exercise the same auth path.
 */
export async function GET(req: NextRequest) {
  const key = await verifyEngineApiKey(req);
  if (!key) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, keyLabel: key.label });
}
