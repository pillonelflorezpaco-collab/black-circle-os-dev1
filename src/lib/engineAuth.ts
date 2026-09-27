import { createHmac, randomBytes } from "crypto";
import { engineApiKeyRepository } from "@/repositories/engineApiKey.repository";

/**
 * Bearer-key auth for /api/engine/** — the contract future Engines and the
 * Agents layer call over, distinct from the dashboard's session-cookie auth.
 * Keys are peppered HMAC-SHA256 at rest (ENGINE_API_KEY_PEPPER), never stored
 * or logged in plaintext after creation.
 */

function hashKey(plaintext: string): string {
  const pepper = process.env.ENGINE_API_KEY_PEPPER;
  if (!pepper) throw new Error("ENGINE_API_KEY_PEPPER is not set.");
  return createHmac("sha256", pepper).update(plaintext).digest("hex");
}

/** Mints a new key. Returns the plaintext once — caller must display/store it now, only the hash is persisted. */
export async function createEngineApiKey(params: { label: string; scopes: string[]; agencyId?: string | null }) {
  const plaintext = `bce_${randomBytes(24).toString("hex")}`;
  const record = await engineApiKeyRepository.create({
    label: params.label,
    scopes: params.scopes,
    agencyId: params.agencyId ?? null,
    hashedKey: hashKey(plaintext),
  });
  return { plaintext, record };
}

/** Extracts and verifies the Bearer token from an incoming Request. Returns the key record or null. */
export async function verifyEngineApiKey(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const plaintext = header.slice("Bearer ".length).trim();
  if (!plaintext) return null;

  const hashed = hashKey(plaintext);
  const key = await engineApiKeyRepository.findActiveByHashedKey(hashed);
  if (!key) return null;

  await engineApiKeyRepository.touchLastUsed(key.id);
  return key;
}
