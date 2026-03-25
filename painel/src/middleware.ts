import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  cookieName,
  isLoginEnabled,
  verifySessionToken,
} from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth/login")) {
    return NextResponse.next();
  }

  if (!isLoginEnabled()) {
    return NextResponse.next();
  }

  const token = request.cookies.get(cookieName())?.value;
  const authed = await verifySessionToken(token);

  if (pathname.startsWith("/api/")) {
    if (!authed) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (!authed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
