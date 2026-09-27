"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertCan, assertSameAgency } from "@/lib/permissions";
import { getEffectiveAgencyId } from "@/lib/agencyContext";
import { modelRepository } from "@/repositories/model.repository";

export async function regenerateAccessCode(modelId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  assertCan(session.user.role, "gererEquipe");

  const target = await modelRepository.findById(modelId);
  const agencyId = await getEffectiveAgencyId();
  assertSameAgency(agencyId, target?.agencyId);

  const code = randomBytes(4).toString("hex").toUpperCase();
  await modelRepository.update(modelId, { accessCode: code });
  revalidatePath("/models");
  return code;
}
