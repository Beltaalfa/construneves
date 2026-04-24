import { NextResponse } from "next/server";
import {
  cookieName,
  isHubAuthEnabled,
  isLoginEnabled,
  signSession,
} from "@/lib/auth";

export async function POST(req: Request) {
  if (!isLoginEnabled()) {
    return NextResponse.json(
      { error: "Login não configurado" },
      { status: 400 },
    );
  }
  if (isHubAuthEnabled()) {
    return NextResponse.json(
      { error: "Login local desativado: use o HUB." },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const password = String((body as { password?: string }).password || "");
  const expected = (process.env.PAINEL_PASSWORD || "").trim();
  if (!expected || password !== expected) {
    return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName(), await signSession(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
