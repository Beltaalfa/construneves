/**
 * Evita SyntaxError quando o servidor devolve HTML (login, 404, proxy, erro Next).
 */
export type SafeJsonResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; rawSnippet?: string };

export async function safeFetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<SafeJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      ...init,
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: `Falha de rede: ${String(e)}`,
    };
  }

  const text = await res.text();
  const trimmed = text.trim();

  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html")
  ) {
    return {
      ok: false,
      status: res.status,
      error:
        res.status === 401
          ? "Não autorizado. Faça login novamente."
          : `O servidor retornou uma página HTML (${res.status}) em vez de dados. Confira se a rota /api/dash existe e se o painel-api está no ar.`,
      rawSnippet: trimmed.slice(0, 120),
    };
  }

  try {
    const data = JSON.parse(text) as T;
    if (!res.ok) {
      const d = data as { detail?: unknown; error?: unknown };
      const detail =
        typeof d.detail === "string"
          ? d.detail
          : typeof d.error === "string"
            ? d.error
            : typeof d.detail === "object" && d.detail !== null
              ? JSON.stringify(d.detail)
              : res.statusText;
      return { ok: false, status: res.status, error: detail };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return {
      ok: false,
      status: res.status,
      error: "Resposta inválida (não é JSON).",
      rawSnippet: trimmed.slice(0, 200),
    };
  }
}
