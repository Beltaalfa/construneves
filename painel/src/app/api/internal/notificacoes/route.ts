import { NextResponse } from "next/server";
import { internalFetch } from "@/lib/internal-api";

export async function GET() {
  try {
    const res = await internalFetch("/notificacoes/recipients");
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

export async function PUT(req: Request) {
  try {
    const body = await req.text();
    const res = await internalFetch("/notificacoes/recipients", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
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

type AcaoNotificacao =
  | ""
  | "teste-estoque"
  | "teste-cobranca"
  | "cobranca-atraso-teste"
  | "cobranca-atraso-executar";

/** Rotas internas painel-api (sem depender de pastas extra no App Router — evita 404 em deploys parciais). */
function pathPainelApiParaAcao(acao: AcaoNotificacao): string {
  switch (acao) {
    case "teste-cobranca":
      return "/notificacoes/test-cobranca";
    case "cobranca-atraso-teste":
      return "/notificacoes/cobranca-alerta-atraso-60d/teste";
    case "cobranca-atraso-executar":
      return "/notificacoes/cobranca-alerta-atraso-60d";
    case "teste-estoque":
    default:
      return "/notificacoes/test";
  }
}

export async function POST(req: Request) {
  try {
    let acao: AcaoNotificacao = "";
    try {
      const raw = await req.text();
      if (raw?.trim()) {
        const j = JSON.parse(raw) as { acao?: string };
        const a = String(j.acao || "").trim();
        if (
          a === "teste-estoque" ||
          a === "teste-cobranca" ||
          a === "cobranca-atraso-teste" ||
          a === "cobranca-atraso-executar"
        ) {
          acao = a;
        }
      }
    } catch {
      acao = "";
    }
    const path = pathPainelApiParaAcao(acao);
    const res = await internalFetch(path, {
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
