/**
 * Signed session for the client portal — separate from NextAuth (staff)
 * sessions since Client isn't a User. Uses Web Crypto (crypto.subtle) instead
 * of Node's `crypto` module because this must also run inside middleware.ts,
 * which executes in the Edge runtime.
 */
const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set — required to sign client-portal sessions.");
  }
  return `${secret}:portal`;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64url");
}

export async function signClientSession(clientId: string, maxAgeSeconds = 60 * 60 * 24 * 30): Promise<string> {
  const expires = Date.now() + maxAgeSeconds * 1000;
  const payload = `${clientId}.${expires}`;
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${toBase64Url(sig)}`;
}

export async function verifyClientSession(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [clientId, expiresStr, sigB64] = parts;
  const expires = Number(expiresStr);
  if (!clientId || !expires || Date.now() > expires) return null;

  const key = await getKey();
  const expectedSig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${clientId}.${expiresStr}`));
  if (toBase64Url(expectedSig) !== sigB64) return null;

  return clientId;
}
