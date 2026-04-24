import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decodeJwt } from "jose";
import {
  cookieName,
  hubJwtCookieName,
  isHubAuthEnabled,
  isLoginEnabled,
  verifySessionToken,
} from "@/lib/auth";
import { hubJwtAllowsPath } from "@/lib/construneves-screens";

function forwardedProto(request: NextRequest): string {
  const raw = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (raw === "http" || raw === "https") return raw;
  return request.nextUrl.protocol.replace(":", "") || "https";
}

function forwardedHost(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const host = request.headers.get("host")?.trim();
  if (host) return host;
  return request.nextUrl.host;
}

function publicRequestUrl(request: NextRequest): string {
  const proto = forwardedProto(request);
  const host = forwardedHost(request);
  return `${proto}://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
}

function redirectToHubLogin(request: NextRequest): NextResponse {
  const base = (process.env.HUB_LOGIN_URL || "").trim();
  if (!base) {
    return new NextResponse("Construneves: defina HUB_LOGIN_URL no ambiente.", {
      status: 500,
    });
  }
  const login = new URL(base);
  const returnTo = publicRequestUrl(request);
  const param =
    (process.env.HUB_LOGIN_RETURN_PARAM || "callbackUrl").trim() ||
    "callbackUrl";
  login.searchParams.set(param, returnTo);
  return NextResponse.redirect(login);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hubMode = isHubAuthEnabled();

  /** PWA e favicon gerados pelo Next — têm de ser públicos sem sessão. */
  if (pathname === "/manifest.json") return NextResponse.next();
  if (
    pathname === "/icon" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon" ||
    pathname === "/apple-icon.png"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth/login") && !hubMode) {
    return NextResponse.next();
  }

  if (!isLoginEnabled()) {
    return NextResponse.next();
  }

  const token = request.cookies
    .get(hubMode ? hubJwtCookieName() : cookieName())
    ?.value;
  const authed = await verifySessionToken(token);

  if (pathname.startsWith("/api/")) {
    if (!authed) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    if (hubMode && token) {
      if (pathname.startsWith("/api/hub/construneves-screen-grants")) {
        try {
          const d = decodeJwt(token) as Record<string, unknown>;
          if (d.hub_role !== "admin") {
            return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        return NextResponse.next();
      }
      try {
        const d = decodeJwt(token) as Record<string, unknown>;
        if (!hubJwtAllowsPath(d, pathname, request.nextUrl.searchParams)) {
          return NextResponse.json({ error: "Sem permissão para este recurso" }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    if (hubMode && pathname.startsWith("/login")) {
      return authed ? NextResponse.redirect(new URL("/", request.url)) : redirectToHubLogin(request);
    }
    return NextResponse.next();
  }

  if (!authed) {
    if (hubMode) return redirectToHubLogin(request);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hubMode && token) {
    try {
      const d = decodeJwt(token) as Record<string, unknown>;
      if (!hubJwtAllowsPath(d, pathname, request.nextUrl.searchParams)) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    } catch {
      return redirectToHubLogin(request);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
