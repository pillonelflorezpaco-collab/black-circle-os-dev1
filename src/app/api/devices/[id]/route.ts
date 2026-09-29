import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertCan, assertSameAgency, ForbiddenError } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { deviceRepository } from "@/repositories/device.repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  try {
    assertCan(session.user.role, "voirAppareils");
    const device = await deviceRepository.findById(id);
    if (!device) {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    assertSameAgency(await getEffectiveAgencyId(), device.agencyId);
    return NextResponse.json({ device });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
