import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: RouteCtx) {
  const { path } = await ctx.params;
  const sub = (path ?? []).join("/");
  if (!sub) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }
  const { search } = new URL(req.url);
  try {
    const res = await internalFetch(`/dash/${sub}${search}`);
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}
