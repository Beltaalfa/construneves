import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as {
      id_ped_compra_ordem?: number;
      id_identificador?: number;
    };
    const idPed = Number(body.id_ped_compra_ordem || 0);
    const idItem = Number(body.id_identificador || 0);
    if (!Number.isFinite(idPed) || idPed <= 0 || !Number.isFinite(idItem) || idItem <= 0) {
      return NextResponse.json(
        { detail: "id_ped_compra_ordem e id_identificador são obrigatórios." },
        { status: 400 },
      );
    }

    const qs = new URLSearchParams({
      id_ped_compra_ordem: String(idPed),
      id_identificador: String(idItem),
    });
    const res = await internalFetch(`/dash/estoque/pedidos-compra/item?${qs.toString()}`, {
      method: "DELETE",
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
