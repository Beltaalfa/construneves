import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

export async function GET() {
  try {
    const res = await internalFetch("/health");
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, firebird: false, error: String(e) },
      { status: 502 },
    );
  }
}
