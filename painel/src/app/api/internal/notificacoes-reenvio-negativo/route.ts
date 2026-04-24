import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

/** Reenvia WhatsApp com todos os itens em estoque negativo (snapshot actual). */
export async function POST() {
  try {
    const res = await internalFetch("/notificacoes/reenviar-estoque-negativo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
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
