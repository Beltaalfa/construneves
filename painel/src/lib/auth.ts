import { SignJWT, jwtVerify } from "jose";

const COOKIE = "painel_session";

function getSecret() {
  return new TextEncoder().encode(
    (process.env.PAINEL_SESSION_SECRET || "change-me-in-production").trim(),
  );
}

export function isLoginEnabled(): boolean {
  return Boolean((process.env.PAINEL_PASSWORD || "").trim());
}

export function cookieName(): string {
  return COOKIE;
}

export async function signSession(): Promise<string> {
  return new SignJWT({ sub: "painel" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!isLoginEnabled()) return true;
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
