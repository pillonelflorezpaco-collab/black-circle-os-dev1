"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { clientRepository } from "@/repositories/client.repository";

export async function regenerateAccessCode(clientId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  assertCan(session.user.role, "gererEquipe");

  const code = randomBytes(4).toString("hex").toUpperCase();
  await clientRepository.update(clientId, { accessCode: code });
  revalidatePath("/clients");
  return code;
}
