import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.toString();
    const path = q ? `/cobranca/apontamentos?${q}` : "/cobranca/apontamentos";
    const res = await internalFetch(path);
    const text = await res.text();
    return NextResponse.json(parseJson(text), { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const res = await internalFetch("/cobranca/apontamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return NextResponse.json(parseJson(text), { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}
