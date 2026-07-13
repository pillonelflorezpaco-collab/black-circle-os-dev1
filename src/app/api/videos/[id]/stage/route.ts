import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateVideoStage } from "@/services/video.service";

const bodySchema = z.object({
  stage: z.enum(["RAW", "A_EDITER", "EN_EDITION", "PRET_POUR_REVIEW", "VALIDE", "PROGRAMME", "PUBLIE"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const video = await updateVideoStage(id, parsed.data.stage);
    return NextResponse.json({ video });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
