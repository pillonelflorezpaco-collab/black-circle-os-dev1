"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { signModelSession } from "@/lib/modelSession";

const PORTAL_COOKIE = "bc_portal_session";

export async function authenticatePortal(_prevState: string | undefined, formData: FormData): Promise<string | undefined> {
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) return "Code requis.";

  const model = await prisma.model.findUnique({ where: { accessCode: code } });
  if (!model) return "Code invalide.";

  const token = await signModelSession(model.id);
  const store = await cookies();
  store.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/portail");
}
