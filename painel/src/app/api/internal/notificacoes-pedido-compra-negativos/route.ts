import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

/** Adiciona itens negativos à ordem de compra aberta (tb_ped_compra_ordem_item). */
export async function POST() {
  try {
    const res = await internalFetch("/notificacoes/pedido-compra-negativos", {
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
