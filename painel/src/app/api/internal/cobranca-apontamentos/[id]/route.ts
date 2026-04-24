import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.text();
    const res = await internalFetch(`/cobranca/apontamentos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return NextResponse.json(parseJson(text), { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const res = await internalFetch(`/cobranca/apontamentos/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const text = await res.text();
    return NextResponse.json(parseJson(text), { status: res.ok ? 200 : res.status });
  } catch (e) {
    return NextResponse.json({ detail: String(e) }, { status: 502 });
  }
}
