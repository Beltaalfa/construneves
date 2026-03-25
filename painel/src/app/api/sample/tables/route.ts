import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") || "30";
  try {
    const res = await internalFetch(`/sample/tables?limit=${encodeURIComponent(limit)}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
