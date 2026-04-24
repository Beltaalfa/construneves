"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CONSTRUNEVES_SCREENS } from "@/lib/construneves-screens";
import { Button } from "@/components/ui/Button";

type ScreenDef = { id: string; label: string };

type GrantUser = {
  id: string;
  name: string;
  email: string;
  screenIds: string[] | null;
};

type ApiGet = {
  configured?: boolean;
  message?: string;
  screens?: ScreenDef[];
  users?: GrantUser[];
  error?: string;
};

function JwtRefreshHint() {
  return (
    <p className="text-zinc-500 text-sm mt-3 max-w-2xl leading-relaxed">
      <a
        href="/api/auth/hub-refresh-jwt"
        className="text-blue-400 hover:underline font-medium"
      >
        Atualizar o meu JWT
      </a>{" "}
      — Hub renova o cookie do painel. Use após o admin mudar as suas telas ou se o painel não refletir o esperado.
    </p>
  );
}

export default function PermissoesClient({
  initialHubRole,
  initialScreens,
}: {
  initialHubRole: string;
  initialScreens: string[] | null;
}) {
  const isAdmin = initialHubRole === "admin";
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(isAdmin);
  const [api, setApi] = useState<ApiGet | null>(null);
  const [modalUser, setModalUser] = useState<GrantUser | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const screens = useMemo(() => api?.screens ?? CONSTRUNEVES_SCREENS, [api?.screens]);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    setToast(null);
    try {
      const r = await fetch("/api/hub/construneves-screen-grants", { credentials: "same-origin" });
      const j = (await r.json()) as ApiGet;
      if (!r.ok) {
        setToast({ ok: false, text: j.error || "Erro ao carregar" });
        setApi(null);
        return;
      }
      setApi(j);
    } catch {
      setToast({ ok: false, text: "Erro de rede ao carregar." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadAdmin();
  }, [isAdmin, loadAdmin]);

  function openModal(u: GrantUser) {
    setModalUser(u);
    const next: Record<string, boolean> = {};
    if (u.screenIds === null) {
      screens.forEach((s) => {
        next[s.id] = true;
      });
    } else {
      (u.screenIds || []).forEach((id) => {
        next[id] = true;
      });
    }
    setDraft(next);
  }

  function closeModal() {
    setModalUser(null);
    setDraft({});
  }

  async function saveModal() {
    if (!modalUser) return;
    setSaving(true);
    setToast(null);
    const screenIds = screens.filter((s) => draft[s.id]).map((s) => s.id);
    try {
      const r = await fetch("/api/hub/construneves-screen-grants", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: modalUser.id, screenIds }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setToast({ ok: false, text: j.error || "Erro ao guardar" });
        return;
      }
      setToast({
        ok: true,
        text:
          "Permissões gravadas no Hub. Cada usuário afetado deve usar «Atualizar o meu JWT» aqui ou entrar de novo pelo Hub.",
      });
      setApi((prev) => {
        if (!prev?.users) return prev;
        return {
          ...prev,
          users: prev.users.map((x) => (x.id === modalUser.id ? { ...x, screenIds } : x)),
        };
      });
      closeModal();
    } catch {
      setToast({ ok: false, text: "Erro de rede ao guardar." });
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    const granular = Array.isArray(initialScreens);
    return (
      <div className="space-y-6 w-full min-w-0 max-w-full sm:max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">As suas permissões</h1>
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed max-w-xl">
            {granular
              ? "Só as páginas autorizadas para a sua conta."
              : "Páginas permitidas para a sua conta."}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/80 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Página</th>
                <th className="px-4 py-3 font-medium">Acesso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {CONSTRUNEVES_SCREENS.filter((s) => s.id !== "/permissoes").map((s) => {
                const ok =
                  !granular ||
                  initialScreens === null ||
                  (initialScreens as string[]).includes(s.id);
                return (
                  <tr key={s.id} className="bg-zinc-950/40">
                    <td className="px-4 py-2.5 text-zinc-200">
                      {s.label}{" "}
                      <span className="text-zinc-500 text-xs">({s.id})</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={ok ? "text-emerald-400 font-medium" : "text-zinc-500"}>
                        {ok ? "Sim" : "Não"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <JwtRefreshHint />
      </div>
    );
  }

  if (loading) {
    return <p className="text-zinc-400 text-sm">A carregar…</p>;
  }

  if (!api?.configured) {
    return (
      <div className="space-y-3 max-w-xl">
        <h1 className="text-2xl font-semibold text-zinc-100">Permissões</h1>
        <p className="text-amber-400/90 text-sm">{api?.message || "Cliente Construneves não configurado no Hub."}</p>
      </div>
    );
  }

  const users = api.users ?? [];

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full lg:max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Permissões</h1>
        <p className="text-zinc-400 mt-2 text-sm leading-relaxed max-w-2xl">
          Quem vê cada página. Admins editam por usuário; os demais só veem a lista em{" "}
          <span className="text-zinc-300">/permissoes</span>.
        </p>
        <p className="text-zinc-500 text-sm mt-2 max-w-2xl">
          Após gravar, cada usuário afetado deve clicar em <span className="text-zinc-400">«Atualizar o meu JWT»</span>{" "}
          ou entrar de novo pelo Hub.
        </p>
      </div>

      {toast ? (
        <div className="space-y-2">
          <div
            className={
              toast.ok
                ? "rounded-lg px-3 py-2 text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "rounded-lg px-3 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/20"
            }
          >
            {toast.text}
          </div>
          {toast.ok ? <JwtRefreshHint /> : null}
        </div>
      ) : null}

      <ul className="space-y-2 w-full min-w-0 max-w-full sm:max-w-lg">
        {users.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-800/50 hover:border-zinc-700 transition-colors"
              onClick={() => openModal(u)}
            >
              <span className="font-semibold block">{u.name || "(sem nome)"}</span>
              <span className="text-zinc-500 text-xs">{u.email}</span>
            </button>
          </li>
        ))}
      </ul>

      {modalUser ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-3 sm:p-4 bg-black/70 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={closeModal}
          />
          <div className="relative w-full max-w-lg max-h-[min(90dvh,calc(100svh-1.5rem))] sm:max-h-[90vh] overflow-y-auto overscroll-y-contain rounded-xl border border-zinc-700 bg-zinc-950 p-4 sm:p-5 shadow-xl min-h-0">
            <div className="flex justify-between gap-3 items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">{modalUser.name}</h2>
                <p className="text-sm text-zinc-500 mt-1">{modalUser.email}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-800"
                onClick={closeModal}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {screens
                .filter((s) => s.id !== "/permissoes")
                .map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-600"
                      checked={!!draft[s.id]}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.checked }))}
                    />
                    <span>{s.label}</span>
                  </label>
                ))}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-zinc-800">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" loading={saving} onClick={() => void saveModal()}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
