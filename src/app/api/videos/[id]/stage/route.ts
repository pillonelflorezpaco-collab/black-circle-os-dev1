import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateVideoStage } from "@/services/video.service";
import { auth } from "@/lib/auth";
import { assertCan, assertSameAgency, ForbiddenError } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { videoRepository } from "@/repositories/video.repository";

const bodySchema = z.object({
  stage: z.enum(["RAW", "A_EDITER", "EN_EDITION", "PRET_POUR_REVIEW", "VALIDE", "PROGRAMME", "PUBLIE"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    assertCan(session.user.role, "editerPipeline");
    const existing = await videoRepository.findById(id);
    assertSameAgency(await getEffectiveAgencyId(), existing?.agencyId);
    const video = await updateVideoStage(id, parsed.data.stage, session.user.id);
    return NextResponse.json({ video });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
