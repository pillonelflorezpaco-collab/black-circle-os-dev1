import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertCan, ForbiddenError } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { eventRepository } from "@/repositories/event.repository";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    assertCan(session.user.role, "voirAppareils");
    const events = await eventRepository.findMany(await getEffectiveAgencyId());
    return NextResponse.json({ events });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
