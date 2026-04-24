import { SignJWT, jwtVerify } from "jose";

const LOCAL_COOKIE = "painel_session";

function isTruthy(raw: string | undefined): boolean {
  const v = (raw || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on" || v === "sim";
}

function getSecret() {
  return new TextEncoder().encode(
    (process.env.PAINEL_SESSION_SECRET || "change-me-in-production").trim(),
  );
}

export function isHubAuthEnabled(): boolean {
  return isTruthy(process.env.CONSTRUNEVES_AUTH_ENABLED ?? process.env.HUB_AUTH_ENABLED);
}

export function isLoginEnabled(): boolean {
  if (isHubAuthEnabled()) return true;
  return Boolean((process.env.PAINEL_PASSWORD || "").trim());
}

export function cookieName(): string {
  return LOCAL_COOKIE;
}

export function hubJwtCookieName(): string {
  return (
    process.env.CONSTRUNEVES_JWT_COOKIE_NAME?.trim() ||
    process.env.HUB_CONSTRUNEVES_COOKIE_NAME?.trim() ||
    "construneves_access_token"
  );
}

function hubJwtSecret(): Uint8Array | null {
  const secret = (
    process.env.HUB_CONSTRUNEVES_JWT_SECRET ??
    process.env.CONSTRUNEVES_JWT_SECRET ??
    process.env.HUB_APPLYFY_JWT_SECRET ??
    process.env.HUB_JWT_SECRET ??
    ""
  ).trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
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
  if (isHubAuthEnabled()) {
    const secret = hubJwtSecret();
    if (!secret?.length || !token) return false;
    try {
      await jwtVerify(token, secret, { algorithms: ["HS256"] });
      return true;
    } catch {
      return false;
    }
  }
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
