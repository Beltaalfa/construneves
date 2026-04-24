"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Recipient = { phone: string; label: string };

const MAX_CONTATOS = 30;
const MIN_LINHAS_VISIVEIS = 2;

/** Pelo menos 2 linhas; se a última tiver telefone, uma linha vazia extra para o próximo contato. */
function normalizeEditorRows(input: Recipient[]): Recipient[] {
  const base =
    input.length > 0
      ? input.map((x) => ({ phone: x.phone ?? "", label: x.label ?? "" }))
      : [{ phone: "", label: "" }];
  const out = [...base];
  while (out.length < MIN_LINHAS_VISIVEIS && out.length < MAX_CONTATOS) {
    out.push({ phone: "", label: "" });
  }
  const last = out[out.length - 1];
  if (out.length < MAX_CONTATOS && last.phone.trim() !== "") {
    out.push({ phone: "", label: "" });
  }
  return out;
}

/** API pode devolver chaves em minúsculas ou maiúsculas (ex.: Firebird). */
function recipientFromApiRow(x: unknown): Recipient {
  const o = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
  const phone = String(o.phone ?? o.PHONE ?? "").trim();
  const label = String(o.label ?? o.LABEL ?? "").trim();
  return { phone, label };
}

type ApiGet = {
  recipients?: Recipient[];
  recipientsCobranca?: Recipient[];
  fallbackEnvPhone?: string | null;
  fallbackEnvPhoneCobranca?: string | null;
  emptyUsesEnvFallback?: boolean;
  prefilledFromEnv?: boolean;
  prefilledFromEnvCobranca?: boolean;
  detail?: string;
};

export default function NotificacoesClient() {
  const [rows, setRows] = useState<Recipient[]>(() =>
    normalizeEditorRows([{ phone: "", label: "" }]),
  );
  const [rowsCob, setRowsCob] = useState<Recipient[]>(() =>
    normalizeEditorRows([{ phone: "", label: "" }]),
  );
  const [meta, setMeta] = useState<{
    fallback?: string | null;
    usesEnv?: boolean;
    prefilledFromEnv?: boolean;
  }>({});
  const [metaCob, setMetaCob] = useState<{
    fallback?: string | null;
    usesEnv?: boolean;
    prefilledFromEnv?: boolean;
  }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCob, setSavingCob] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingCob, setTestingCob] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [criandoPedido, setCriandoPedido] = useState(false);
  const [previewCob, setPreviewCob] = useState(false);
  const [enviandoCob, setEnviandoCob] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    if (!silent) {
      setLoading(true);
      setToast(null);
    }
    try {
      const r = await fetch("/api/internal/notificacoes", { credentials: "same-origin" });
      const j = (await r.json()) as ApiGet;
      if (!r.ok) {
        setToast({ ok: false, text: (j as { detail?: string }).detail || "Erro ao carregar" });
        return;
      }
      const list = Array.isArray(j.recipients) ? j.recipients : [];
      const mapped =
        list.length > 0
          ? list.map((x) => recipientFromApiRow(x))
          : [{ phone: "", label: "" }];
      setRows(normalizeEditorRows(mapped));
      setMeta({
        fallback: j.fallbackEnvPhone ?? null,
        usesEnv: Boolean(j.emptyUsesEnvFallback),
        prefilledFromEnv: Boolean(j.prefilledFromEnv),
      });

      if (Array.isArray(j.recipientsCobranca)) {
        const listCob = j.recipientsCobranca;
        const mappedCob =
          listCob.length > 0 ? listCob.map((x) => recipientFromApiRow(x)) : [{ phone: "", label: "" }];
        setRowsCob(normalizeEditorRows(mappedCob));
        setMetaCob({
          fallback: j.fallbackEnvPhoneCobranca ?? null,
          usesEnv: Boolean(j.emptyUsesEnvFallback),
          prefilledFromEnv: Boolean(j.prefilledFromEnvCobranca),
        });
      }
    } catch {
      setToast({ ok: false, text: "Erro de rede ao carregar." });
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function addRow() {
    setRows((prev) => {
      if (prev.length >= MAX_CONTATOS) return prev;
      return normalizeEditorRows([...prev, { phone: "", label: "" }]);
    });
  }

  function addTwoRows() {
    setRows((prev) => {
      if (prev.length >= MAX_CONTATOS) return prev;
      const n = Math.min(2, MAX_CONTATOS - prev.length);
      const extra = Array.from({ length: n }, () => ({ phone: "", label: "" } as Recipient));
      return normalizeEditorRows([...prev, ...extra]);
    });
  }

  function removeRow(i: number) {
    setRows((prev) => {
      let next: Recipient[];
      if (prev.length <= 1) {
        next = [{ phone: "", label: "" }];
      } else {
        next = prev.filter((_, idx) => idx !== i);
      }
      return normalizeEditorRows(next);
    });
  }

  function updateRow(i: number, patch: Partial<Recipient>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRowCob() {
    setRowsCob((prev) => {
      if (prev.length >= MAX_CONTATOS) return prev;
      return normalizeEditorRows([...prev, { phone: "", label: "" }]);
    });
  }

  function addTwoRowsCob() {
    setRowsCob((prev) => {
      if (prev.length >= MAX_CONTATOS) return prev;
      const n = Math.min(2, MAX_CONTATOS - prev.length);
      const extra = Array.from({ length: n }, () => ({ phone: "", label: "" } as Recipient));
      return normalizeEditorRows([...prev, ...extra]);
    });
  }

  function removeRowCob(i: number) {
    setRowsCob((prev) => {
      let next: Recipient[];
      if (prev.length <= 1) {
        next = [{ phone: "", label: "" }];
      } else {
        next = prev.filter((_, idx) => idx !== i);
      }
      return normalizeEditorRows(next);
    });
  }

  function updateRowCob(i: number, patch: Partial<Recipient>) {
    setRowsCob((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  /** Sempre enviar as duas listas no PUT para nunca gravar uma vazia por engano por cima da outra. */
  function buildRecipientsPayload() {
    const recipients = rows
      .map((r) => ({
        phone: r.phone.trim(),
        label: r.label.trim(),
      }))
      .filter((r) => r.phone.length > 0);
    const recipientsCobranca = rowsCob
      .map((r) => ({
        phone: r.phone.trim(),
        label: r.label.trim(),
      }))
      .filter((r) => r.phone.length > 0);
    return { recipients, recipientsCobranca };
  }

  async function save() {
    setSaving(true);
    setToast(null);
    const { recipients, recipientsCobranca } = buildRecipientsPayload();
    try {
      const r = await fetch("/api/internal/notificacoes", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, recipientsCobranca }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        detail?: string;
        count?: number;
        countCobranca?: number;
        recipients?: unknown[];
        recipientsCobranca?: unknown[];
      };
      if (!r.ok) {
        setToast({ ok: false, text: j.detail || "Erro ao gravar" });
        return;
      }
      if (Array.isArray(j.recipients) && Array.isArray(j.recipientsCobranca)) {
        const mappedE = j.recipients.length
          ? j.recipients.map((x) => recipientFromApiRow(x))
          : [{ phone: "", label: "" }];
        const mappedC = j.recipientsCobranca.length
          ? j.recipientsCobranca.map((x) => recipientFromApiRow(x))
          : [{ phone: "", label: "" }];
        setRows(normalizeEditorRows(mappedE));
        setRowsCob(normalizeEditorRows(mappedC));
      } else {
        await load({ silent: true });
      }
      setToast({
        ok: true,
        text: `Salvo. Estoque: ${j.count ?? recipients.length}; cobrança: ${j.countCobranca ?? recipientsCobranca.length} número(s).`,
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede ao gravar." });
    } finally {
      setSaving(false);
    }
  }

  async function saveCobranca() {
    setSavingCob(true);
    setToast(null);
    const { recipients, recipientsCobranca } = buildRecipientsPayload();
    try {
      const r = await fetch("/api/internal/notificacoes", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, recipientsCobranca }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        detail?: string;
        count?: number;
        countCobranca?: number;
        recipients?: unknown[];
        recipientsCobranca?: unknown[];
      };
      if (!r.ok) {
        setToast({ ok: false, text: j.detail || "Erro ao gravar cobrança" });
        return;
      }
      if (Array.isArray(j.recipients) && Array.isArray(j.recipientsCobranca)) {
        const mappedE = j.recipients.length
          ? j.recipients.map((x) => recipientFromApiRow(x))
          : [{ phone: "", label: "" }];
        const mappedC = j.recipientsCobranca.length
          ? j.recipientsCobranca.map((x) => recipientFromApiRow(x))
          : [{ phone: "", label: "" }];
        setRows(normalizeEditorRows(mappedE));
        setRowsCob(normalizeEditorRows(mappedC));
      } else {
        await load({ silent: true });
      }
      setToast({
        ok: true,
        text: `Salvo. Cobrança: ${j.countCobranca ?? recipientsCobranca.length}; estoque: ${j.count ?? recipients.length} número(s).`,
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede ao gravar." });
    } finally {
      setSavingCob(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/notificacoes", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        erro?: string;
        skipped?: boolean;
        reason?: string;
        dry_run?: boolean;
        texto?: string;
        destinos?: string[];
        resposta?: string;
      };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.erro || (j as { detail?: string }).detail || "Falha no teste" });
        return;
      }
      if (j.skipped) {
        setToast({ ok: true, text: j.reason || "Ignorado." });
        return;
      }
      if (j.dry_run) {
        setToast({
          ok: true,
          text: `Dry-run estoque: ${(j.destinos || []).length} destino(s). ${(j.texto || "").slice(0, 120)}…`,
        });
        return;
      }
      setToast({
        ok: true,
        text: `Teste estoque enviado a ${(j.destinos || []).length} número(s). ${j.resposta || ""}`.trim(),
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede no teste." });
    } finally {
      setTesting(false);
    }
  }

  async function sendTestCobranca() {
    setTestingCob(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/notificacoes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "teste-cobranca" }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        erro?: string;
        skipped?: boolean;
        reason?: string;
        dry_run?: boolean;
        texto?: string;
        destinos?: string[];
        resposta?: string;
        detail?: string;
      };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.erro || j.detail || "Falha no teste de cobrança" });
        return;
      }
      if (j.skipped) {
        setToast({ ok: true, text: j.reason || "Ignorado." });
        return;
      }
      if (j.dry_run) {
        setToast({
          ok: true,
          text: `Dry-run cobrança: ${(j.destinos || []).length} destino(s).`,
        });
        return;
      }
      setToast({
        ok: true,
        text: `Teste cobrança enviado a ${(j.destinos || []).length} número(s). ${j.resposta || ""}`.trim(),
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede no teste de cobrança." });
    } finally {
      setTestingCob(false);
    }
  }

  async function previewAlertaCobranca() {
    setPreviewCob(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/notificacoes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "cobranca-atraso-teste" }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        erro?: string;
        detail?: string;
        qtd_clientes?: number;
        texto_primeira_parte?: string;
        dry_run?: boolean;
      };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.erro || j.detail || "Falha na pré-visualização" });
        return;
      }
      const n = j.qtd_clientes ?? 0;
      const snippet = (j.texto_primeira_parte || "").slice(0, 400);
      setToast({
        ok: true,
        text: `Pré-visualização: ${n} cliente(s). ${snippet.slice(0, 200)}${snippet.length > 200 ? "…" : ""}`,
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede na pré-visualização." });
    } finally {
      setPreviewCob(false);
    }
  }

  async function enviarAlertaCobrancaAgora() {
    const ok = window.confirm(
      "Enviar agora por WhatsApp a lista de atraso (alerta diário)? Mensagem real para os números de cobrança guardados.",
    );
    if (!ok) return;
    setEnviandoCob(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/notificacoes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "cobranca-atraso-executar" }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        erro?: string;
        detail?: string;
        skipped?: boolean;
        reason?: string;
        dry_run?: boolean;
        qtd_clientes?: number;
        partes?: number;
        resposta?: string;
      };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.erro || j.detail || "Falha ao enviar" });
        return;
      }
      if (j.skipped) {
        setToast({ ok: true, text: j.reason || "Ignorado." });
        return;
      }
      if (j.dry_run) {
        setToast({ ok: true, text: "Dry-run ativo no servidor — nada enviado." });
        return;
      }
      setToast({
        ok: true,
        text: `Alerta enviado: ${j.qtd_clientes ?? 0} cliente(s), ${j.partes ?? 1} parte(s). ${j.resposta || ""}`.trim(),
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede ao enviar alerta." });
    } finally {
      setEnviandoCob(false);
    }
  }

  async function sendReenvioTodosNegativos() {
    setReenviando(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/notificacoes-reenvio-negativo", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        erro?: string;
        skipped?: boolean;
        reason?: string;
        dry_run?: boolean;
        texto?: string;
        count?: number;
        resposta?: string;
        detail?: string;
      };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.erro || j.detail || "Falha ao reenviar" });
        return;
      }
      if (j.skipped) {
        setToast({ ok: true, text: j.reason || "Ignorado." });
        return;
      }
      if (j.dry_run) {
        setToast({
          ok: true,
          text: `Dry-run: ${j.count ?? 0} item(ns). ${(j.texto || "").slice(0, 160)}…`,
        });
        return;
      }
      setToast({
        ok: true,
        text: `Reenviado: ${j.count ?? 0} produto(s) negativo(s) na mensagem. ${j.resposta || ""}`.trim(),
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede ao reenviar." });
    } finally {
      setReenviando(false);
    }
  }

  async function adicionarNegativosPedCompraAberto() {
    const ok = window.confirm(
      "Gravar no Firebird: na ordem de compra aberta mais recente, adicionar ou somar cada produto com estoque negativo (como em Pedidos de compra abertos). Continuar?",
    );
    if (!ok) return;
    setCriandoPedido(true);
    setToast(null);
    try {
      const r = await fetch("/api/internal/notificacoes-pedido-compra-negativos", {
        method: "POST",
        credentials: "same-origin",
      });
      const j = (await r.json()) as {
        ok?: boolean;
        erro?: string;
        detail?: string;
        skipped?: boolean;
        reason?: string;
        dry_run?: boolean;
        linhas_negativas?: number;
        preview?: unknown[];
        id_ped_compra_ordem?: number | null;
        inseridos?: number;
        actualizados?: number;
        produtos_negativos?: number;
      };
      if (!r.ok || j.ok === false) {
        setToast({ ok: false, text: j.erro || j.detail || "Falha ao gravar pedido de compra" });
        return;
      }
      if (j.skipped) {
        setToast({ ok: true, text: j.reason || "Nada a fazer." });
        return;
      }
      if (j.dry_run) {
        setToast({
          ok: true,
          text: `Dry-run: ordem ${j.id_ped_compra_ordem ?? "—"}, ${j.linhas_negativas ?? 0} negativo(s). Veja CONSTRUNEVES_PED_COMPRA_DRY_RUN no .env.`,
        });
        return;
      }
      setToast({
        ok: true,
        text: `Pedido ${j.id_ped_compra_ordem ?? "—"}: +${j.inseridos ?? 0} linhas novas; ${j.actualizados ?? 0} atualizadas (${j.produtos_negativos ?? 0} negativos).`,
      });
    } catch {
      setToast({ ok: false, text: "Erro de rede ao gravar." });
    } finally {
      setCriandoPedido(false);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full sm:max-w-3xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 mb-1">Notificações (WhatsApp)</h1>
        <p className="text-sm text-zinc-500 mb-4">
          Duas listas: <strong className="text-zinc-400">estoque negativo</strong> e{" "}
          <strong className="text-zinc-400">cobrança (alerta diário)</strong>. Formato WAHA: DDI + número (ex.{" "}
          <span className="text-zinc-400">5537999990000</span>). Até {MAX_CONTATOS} contatos por lista.
        </p>

        {toast ? (
          <div
            className={`mb-4 text-sm rounded-lg px-3 py-2 border ${
              toast.ok
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                : "bg-red-950/40 border-red-900 text-red-300"
            }`}
            role="status"
          >
            {toast.text}
          </div>
        ) : null}

        {loading ? (
          <p className="text-zinc-500 text-sm">A carregar…</p>
        ) : (
          <>
            <h2 className="text-lg font-medium text-zinc-200 mb-2">Estoque negativo</h2>
            <p className="text-sm text-zinc-500 mb-2">
              Todos recebem o <strong className="text-zinc-400">mesmo</strong> aviso quando um produto fica com estoque negativo. “Quem é” identifica a pessoa ou setor.
            </p>
            <p className="text-sm text-zinc-600 mb-4">
              Uma linha por WhatsApp. <strong className="text-zinc-500">Outro contato</strong> ou <strong className="text-zinc-500">+ 2 linhas</strong> para mais destinatários.
            </p>

            {meta.prefilledFromEnv ? (
              <p className="text-sm text-zinc-200 bg-zinc-800/40 border border-zinc-700 rounded-lg px-3 py-2 mb-4">
                Número vindo de <code className="text-blue-300 text-xs">WHATSAPP_ALERTA_ESTOQUE_PARA</code>. Edite e{" "}
                <strong>Guardar</strong> para gravar na lista.
              </p>
            ) : meta.usesEnv && meta.fallback ? (
              <p className="text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 mb-4">
                Lista vazia + <strong>Guardar</strong> volta ao fallback{" "}
                <code className="text-zinc-300 text-xs">WHATSAPP_ALERTA_ESTOQUE_PARA</code>{" "}
                <span className="font-mono text-xs">({meta.fallback})</span>.
              </p>
            ) : null}

            <div className="space-y-4">
              {rows.map((row, i) => (
                <div
                  key={`e-${i}`}
                  className="flex flex-col sm:flex-row gap-3 sm:items-end border border-zinc-800 rounded-xl p-4 bg-zinc-900/20"
                >
                  <div className="flex-1 space-y-2 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                      Contato estoque {i + 1}
                    </p>
                    <Input
                      label="Telefone (WhatsApp)"
                      value={row.phone}
                      onChange={(e) => updateRow(i, { phone: e.target.value })}
                      placeholder="5537999990000"
                      autoComplete="tel"
                    />
                    <Input
                      label="Quem é (opcional)"
                      value={row.label}
                      onChange={(e) => updateRow(i, { label: e.target.value })}
                      placeholder="Ex.: Maria — Compras / João — Direção"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 text-red-400 hover:text-red-300"
                    onClick={() => removeRow(i)}
                    title={rows.length <= 1 ? "Limpa o número" : "Remover esta linha"}
                  >
                    {rows.length <= 1 ? "Limpar" : "Remover"}
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={addRow} disabled={rows.length >= MAX_CONTATOS}>
                  Outro contato
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addTwoRows}
                  disabled={rows.length >= MAX_CONTATOS - 1}
                >
                  + 2 linhas (duas pessoas)
                </Button>
                <Button type="button" onClick={() => void save()} loading={saving}>
                  Guardar (estoque)
                </Button>
                <Button type="button" variant="secondary" onClick={() => void sendTest()} loading={testing}>
                  Enviar teste (estoque)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void sendReenvioTodosNegativos()}
                  loading={reenviando}
                  className="border-amber-800/50 text-amber-200 hover:bg-amber-950/40"
                >
                  Reenviar todos os negativos
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void adicionarNegativosPedCompraAberto()}
                  loading={criandoPedido}
                  className="border-emerald-900/50 text-emerald-200 hover:bg-emerald-950/30"
                >
                  Negativos → pedido de compra aberto
                </Button>
                <Button type="button" variant="ghost" onClick={() => void load()} disabled={loading}>
                  Recarregar
                </Button>
              </div>
              <p className="text-xs text-zinc-600 pt-2 max-w-xl leading-relaxed">
                <strong className="text-zinc-500">Reenviar todos os negativos</strong>: produtos com{" "}
                <code className="text-zinc-400 text-xs">QTD_ATUAL</code> &lt; 0.{" "}
                <strong className="text-zinc-500">Negativos → pedido</strong>: exige{" "}
                <code className="text-zinc-400 text-xs">CONSTRUNEVES_PED_COMPRA_NEGATIVOS=1</code> na API.
              </p>
            </div>

            <hr className="border-zinc-800 my-10" />

            <h2 className="text-lg font-medium text-zinc-200 mb-2">Cobrança — alerta diário</h2>
            <p className="text-sm text-zinc-500 mb-2">
              Destinatários do alerta diário (clientes em atraso; dias em{" "}
              <code className="text-zinc-400 text-xs">COBRANCA_ATRASO_DIAS</code>),{" "}
              <strong className="text-zinc-400">sem</strong> apontamento de cobrança no mês atual e{" "}
              <strong className="text-zinc-400">sem</strong> baixa no mês atual. Cron no servidor; aqui: pré-visualizar, teste ou envio manual.
            </p>
            <p className="text-sm text-zinc-600 mb-4">
              Lista separada do estoque. <strong className="text-zinc-500">Guardar (cobrança)</strong> grava só esta secção.
            </p>

            {metaCob.prefilledFromEnv ? (
              <p className="text-sm text-zinc-200 bg-zinc-800/40 border border-zinc-700 rounded-lg px-3 py-2 mb-4">
                Sugestão de <code className="text-blue-300 text-xs">WHATSAPP_COBRANCA_ATRASO_PARA</code>. Edite e{" "}
                <strong>Guardar (cobrança)</strong>.
              </p>
            ) : metaCob.usesEnv && metaCob.fallback ? (
              <p className="text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2 mb-4">
                Lista vazia + <strong>Guardar (cobrança)</strong> →{" "}
                <code className="text-zinc-300 text-xs">WHATSAPP_COBRANCA_ATRASO_PARA</code>{" "}
                <span className="font-mono text-xs">({metaCob.fallback})</span>.
              </p>
            ) : null}

            <div className="space-y-4">
              {rowsCob.map((row, i) => (
                <div
                  key={`c-${i}`}
                  className="flex flex-col sm:flex-row gap-3 sm:items-end rounded-xl border border-amber-900/25 bg-amber-950/10 p-4"
                >
                  <div className="flex-1 space-y-2 min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600/90">
                      Contato cobrança {i + 1}
                    </p>
                    <Input
                      label="Telefone (WhatsApp)"
                      value={row.phone}
                      onChange={(e) => updateRowCob(i, { phone: e.target.value })}
                      placeholder="5534988070651"
                      autoComplete="tel"
                    />
                    <Input
                      label="Quem é (opcional)"
                      value={row.label}
                      onChange={(e) => updateRowCob(i, { label: e.target.value })}
                      placeholder="Ex.: Cobrança — Uberlândia"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 text-red-400 hover:text-red-300"
                    onClick={() => removeRowCob(i)}
                    title={rowsCob.length <= 1 ? "Limpa o número" : "Remover esta linha"}
                  >
                    {rowsCob.length <= 1 ? "Limpar" : "Remover"}
                  </Button>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addRowCob}
                  disabled={rowsCob.length >= MAX_CONTATOS}
                >
                  Outro contato
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addTwoRowsCob}
                  disabled={rowsCob.length >= MAX_CONTATOS - 1}
                >
                  + 2 linhas
                </Button>
                <Button type="button" onClick={() => void saveCobranca()} loading={savingCob}>
                  Guardar (cobrança)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void sendTestCobranca()}
                  loading={testingCob}
                >
                  Enviar teste (cobrança)
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void previewAlertaCobranca()}
                  loading={previewCob}
                  className="border-zinc-600"
                >
                  Pré-visualizar alerta
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void enviarAlertaCobrancaAgora()}
                  loading={enviandoCob}
                  className="border-amber-800/50 text-amber-100 hover:bg-amber-950/40"
                >
                  Enviar alerta agora
                </Button>
                <Button type="button" variant="ghost" onClick={() => void load()} disabled={loading}>
                  Recarregar
                </Button>
              </div>
              <p className="text-xs text-zinc-600 pt-2 max-w-xl leading-relaxed">
                <strong className="text-zinc-500">Pré-visualizar</strong>: lê o Firebird e mostra o texto (sem enviar).{" "}
                <strong className="text-zinc-500">Enviar alerta agora</strong>: WhatsApp real. Cron pode chamar{" "}
                <code className="text-zinc-400 text-xs">/dash/cobranca/alerta-atraso/executar</code>.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
