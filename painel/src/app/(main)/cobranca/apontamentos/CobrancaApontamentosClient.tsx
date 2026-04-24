"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Row = {
  id?: string | number;
  ID?: string | number;
  created_at?: string;
  CREATED_AT?: string;
  id_cliente?: string | number;
  ID_CLIENTE?: string | number;
  cliente?: string;
  CLIENTE?: string;
  contato?: string;
  CONTATO?: string;
  telefone?: string;
  TELEFONE?: string;
  assunto?: string;
  ASSUNTO?: string;
  forma_contato?: string;
  FORMA_CONTATO?: string;
  funcionario?: string;
  FUNCIONARIO?: string;
  conteudo?: string;
  CONTEUDO?: string;
  efetuado?: boolean | number;
  EFETUADO?: boolean | number;
};

type Payload = { rows?: Row[]; count?: number; detail?: string };

function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function fmtDateOnly(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function dateSortKey(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function timeOnly(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function pick<T = unknown>(r: Row, upper: keyof Row, lower: keyof Row): T | undefined {
  const up = r[upper];
  if (up !== undefined && up !== null) return up as T;
  const lo = r[lower];
  if (lo !== undefined && lo !== null) return lo as T;
  return undefined;
}

export default function CobrancaApontamentosClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [idClienteFiltro, setIdClienteFiltro] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const [idCliente, setIdCliente] = useState("");
  const [cliente, setCliente] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [assunto, setAssunto] = useState("");
  const [formaContato, setFormaContato] = useState("WhatsApp");
  const [funcionario, setFuncionario] = useState("");
  const [conteudo, setConteudo] = useState("");

  /** Chaves: `c:{idCliente}` e `c:{idCliente}|d:{yyyy-mm-dd}` */
  const [expandedClients, setExpandedClients] = useState<Set<string>>(() => new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => new Set());

  function toggleClient(cid: string) {
    setExpandedClients((prev) => {
      const n = new Set(prev);
      const k = `c:${cid}`;
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  function toggleDate(cid: string, dkey: string) {
    setExpandedDates((prev) => {
      const n = new Set(prev);
      const k = `c:${cid}|d:${dkey}`;
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  async function load() {
    setLoading(true);
    setToast(null);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (idClienteFiltro.trim()) qs.set("id_cliente", idClienteFiltro.trim());
      if (somentePendentes) qs.set("somente_pendentes", "true");
      const url = qs.toString()
        ? `/api/internal/cobranca-apontamentos?${qs.toString()}`
        : "/api/internal/cobranca-apontamentos";
      const r = await fetch(url, { credentials: "same-origin" });
      const j = (await r.json()) as Payload;
      if (!r.ok) {
        setToast({ ok: false, text: j.detail || "Erro ao carregar apontamentos." });
        return;
      }
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch {
      setToast({ ok: false, text: "Erro de rede ao carregar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function salvarApontamento() {
    if (!idCliente.trim() || !conteudo.trim()) {
      setToast({ ok: false, text: "ID cliente e conteúdo são obrigatórios." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/cobranca-apontamentos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_cliente: idCliente,
          cliente,
          contato,
          telefone,
          assunto,
          forma_contato: formaContato,
          funcionario,
          conteudo,
          efetuado: false,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; detail?: string };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.detail || "Falha ao salvar apontamento." });
        return;
      }
      setConteudo("");
      setAssunto("");
      setToast({ ok: true, text: "Apontamento salvo." });
      await load();
    } catch {
      setToast({ ok: false, text: "Erro de rede ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function marcarEfetuado(id: string, efetuado: boolean) {
    try {
      const r = await fetch(`/api/internal/cobranca-apontamentos/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ efetuado }),
      });
      const j = (await r.json()) as { ok?: boolean; detail?: string };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.detail || "Falha ao atualizar status." });
        return;
      }
      setRows((prev) =>
        prev.map((x) =>
          String(pick(x, "ID", "id") ?? "") === id
            ? { ...x, EFETUADO: efetuado ? 1 : 0, efetuado }
            : x,
        ),
      );
    } catch {
      setToast({ ok: false, text: "Erro de rede ao atualizar status." });
    }
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir este apontamento?")) return;
    try {
      const r = await fetch(`/api/internal/cobranca-apontamentos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const j = (await r.json()) as { ok?: boolean; detail?: string };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.detail || "Falha ao excluir." });
        return;
      }
      setRows((prev) => prev.filter((x) => String(pick(x, "ID", "id") ?? "") !== id));
    } catch {
      setToast({ ok: false, text: "Erro de rede ao excluir." });
    }
  }

  const total = useMemo(() => rows.length, [rows]);
  const pendentes = useMemo(
    () => rows.filter((r) => Number(pick(r, "EFETUADO", "efetuado") || 0) === 0).length,
    [rows],
  );

  const matrix = useMemo(() => {
    type Bucket = { idCliente: string; nome: string; items: Row[] };
    const map = new Map<string, Bucket>();
    for (const r of rows) {
      const idCliente = String(pick(r, "ID_CLIENTE", "id_cliente") ?? "");
      const nome = String(pick(r, "CLIENTE", "cliente") ?? "").trim() || "(sem nome)";
      if (!map.has(idCliente)) {
        map.set(idCliente, { idCliente, nome, items: [] });
      }
      map.get(idCliente)!.items.push(r);
    }
    for (const b of map.values()) {
      b.items.sort((a, b) =>
        String(pick(b, "CREATED_AT", "created_at") ?? "").localeCompare(
          String(pick(a, "CREATED_AT", "created_at") ?? ""),
        ),
      );
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );
  }, [rows]);

  function groupByDate(items: Row[]): { dkey: string; label: string; rows: Row[] }[] {
    const m = new Map<string, Row[]>();
    for (const r of items) {
      const iso = String(pick(r, "CREATED_AT", "created_at") ?? "");
      const dkey = dateSortKey(iso) || "?";
      if (!m.has(dkey)) m.set(dkey, []);
      m.get(dkey)!.push(r);
    }
    const out = Array.from(m.entries()).map(([dkey, rs]) => ({
      dkey,
      label: fmtDateOnly(String(pick(rs[0], "CREATED_AT", "created_at") ?? "")),
      rows: rs.sort((a, b) =>
        String(pick(b, "CREATED_AT", "created_at") ?? "").localeCompare(
          String(pick(a, "CREATED_AT", "created_at") ?? ""),
        ),
      ),
    }));
    out.sort((a, b) => b.dkey.localeCompare(a.dkey));
    return out;
  }

  return (
    <div className="relative min-h-0 space-y-6 pb-12">
      <header className="relative overflow-hidden rounded-2xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-zinc-950 px-4 py-6 sm:px-8 sm:py-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-500/90">
          Cobrança
        </p>
        <h1 className="text-2xl font-semibold text-zinc-50 tracking-tight sm:text-3xl">
          Apontamentos de cobrança
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
          Contatos de cobrança gravados no MT. Matriz:{" "}
          <span className="text-zinc-300">cliente → data → texto</span> (expandir para ler tudo).
        </p>
      </header>

      {toast ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            toast.ok
              ? "border-emerald-500/25 bg-emerald-950/20 text-emerald-200"
              : "border-red-500/25 bg-red-950/30 text-red-300"
          }`}
        >
          {toast.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Total</p>
          <p className="text-2xl font-semibold text-zinc-100">{total}</p>
        </div>
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Pendentes</p>
          <p className="text-2xl font-semibold text-zinc-100">{pendentes}</p>
        </div>
        <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Efetuados</p>
          <p className="text-2xl font-semibold text-zinc-100">{Math.max(0, total - pendentes)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-zinc-200">Novo apontamento</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input value={idCliente} onChange={(e) => setIdCliente(e.target.value)} placeholder="ID cliente *" />
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente (opcional)" />
          <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="Contato" />
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Telefone" />
          <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto" />
          <Input
            value={formaContato}
            onChange={(e) => setFormaContato(e.target.value)}
            placeholder="Forma de contato"
          />
          <Input
            value={funcionario}
            onChange={(e) => setFuncionario(e.target.value)}
            placeholder="Funcionário"
          />
        </div>
        <textarea
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Conteúdo do contato (o que foi conversado) *"
          className="w-full min-h-[120px] rounded-lg border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <div className="flex justify-end">
          <Button loading={saving} onClick={() => void salvarApontamento()}>
            Salvar apontamento
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap gap-2 items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, contato, telefone, conteúdo..."
            className="w-full md:w-[420px]"
          />
          <Input
            value={idClienteFiltro}
            onChange={(e) => setIdClienteFiltro(e.target.value)}
            placeholder="Filtrar por ID cliente"
            className="w-full md:w-[220px]"
          />
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={somentePendentes}
              onChange={(e) => setSomentePendentes(e.target.checked)}
            />
            Somente pendentes
          </label>
          <Button variant="secondary" onClick={() => void load()} loading={loading}>
            Filtrar
          </Button>
        </div>
        <div className="overflow-auto max-h-[min(70vh,700px)] px-3 py-3 space-y-2">
          {!rows.length ? (
            <p className="py-8 text-sm text-zinc-500 text-center">Nenhum apontamento encontrado.</p>
          ) : (
            matrix.map((bucket) => {
              const cid = bucket.idCliente;
              const cOpen = expandedClients.has(`c:${cid}`);
              const dates = groupByDate(bucket.items);
              return (
                <div
                  key={cid || `anon-${bucket.nome}`}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/40 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleClient(cid)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
                  >
                    <span className="text-zinc-500 w-5 shrink-0 font-mono text-xs">{cOpen ? "▼" : "▶"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100 truncate">
                        {bucket.nome}
                        {cid ? (
                          <span className="text-zinc-500 font-normal"> · ID {cid}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {bucket.items.length} apontamento{bucket.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                  {cOpen ? (
                    <div className="border-t border-zinc-800/80 pl-6 pr-3 pb-3 space-y-2">
                      {dates.map((day) => {
                        const dOpen = expandedDates.has(`c:${cid}|d:${day.dkey}`);
                        return (
                          <div key={day.dkey} className="rounded-lg border border-zinc-800/80 bg-zinc-900/25">
                            <button
                              type="button"
                              onClick={() => toggleDate(cid, day.dkey)}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800/30 transition-colors"
                            >
                              <span className="text-zinc-500 w-5 shrink-0 font-mono text-xs">
                                {dOpen ? "▼" : "▶"}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm text-zinc-200">{day.label}</p>
                                <p className="text-xs text-zinc-500">
                                  {day.rows.length} contato{day.rows.length === 1 ? "" : "s"}
                                </p>
                              </div>
                            </button>
                            {dOpen ? (
                              <div className="border-t border-zinc-800/60 px-3 py-2 space-y-2">
                                {day.rows.map((r, idx) => {
                                  const id = String(pick(r, "ID", "id") ?? "");
                                  const ef = Number(pick(r, "EFETUADO", "efetuado") || 0) > 0;
                                  const created = String(pick(r, "CREATED_AT", "created_at") ?? "");
                                  return (
                                    <div
                                      key={id || `${cid}-${day.dkey}-${idx}`}
                                      className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                                    >
                                      <div className="flex flex-wrap items-center gap-2 gap-y-1 text-xs text-zinc-400">
                                        <span className="text-zinc-300 font-medium">{timeOnly(created)}</span>
                                        <span>·</span>
                                        <span>{String(pick(r, "FORMA_CONTATO", "forma_contato") ?? "—")}</span>
                                        <span>·</span>
                                        <span className="truncate max-w-[200px]">
                                          {String(pick(r, "FUNCIONARIO", "funcionario") ?? "—")}
                                        </span>
                                        <span>·</span>
                                        <span className="truncate max-w-[220px]">
                                          {String(pick(r, "ASSUNTO", "assunto") ?? "—")}
                                        </span>
                                        <span className="ml-auto shrink-0">
                                          {ef ? (
                                            <span className="text-emerald-400/90">Efetuado</span>
                                          ) : (
                                            <span className="text-amber-400/90">Pendente</span>
                                          )}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-xs text-zinc-500">
                                        Contato: {String(pick(r, "CONTATO", "contato") ?? "—")}
                                        {pick(r, "TELEFONE", "telefone")
                                          ? ` · ${String(pick(r, "TELEFONE", "telefone"))}`
                                          : ""}
                                      </p>
                                      <details className="mt-2 group">
                                        <summary className="cursor-pointer text-sm text-emerald-400/90 hover:text-emerald-300 list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
                                          <span className="text-zinc-500 font-mono text-xs">▶</span>
                                          <span className="group-open:hidden">Ver conteúdo da conversa</span>
                                          <span className="hidden group-open:inline">Recolher conteúdo</span>
                                        </summary>
                                        <pre className="mt-2 max-h-[min(40vh,320px)] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-200 whitespace-pre-wrap">
                                          {String(pick(r, "CONTEUDO", "conteudo") ?? "—")}
                                        </pre>
                                      </details>
                                      <div className="mt-2 flex flex-wrap gap-2 justify-end">
                                        <Button
                                          variant="secondary"
                                          className="px-2.5 py-1.5 text-xs"
                                          onClick={() => void marcarEfetuado(id, !ef)}
                                          disabled={!id}
                                        >
                                          {ef ? "Reabrir" : "Efetuar"}
                                        </Button>
                                        <Button
                                          variant="danger"
                                          className="px-2.5 py-1.5 text-xs"
                                          onClick={() => void excluir(id)}
                                          disabled={!id}
                                        >
                                          Excluir
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
