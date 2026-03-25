const base = () =>
  (process.env.PAINEL_INTERNAL_API || "http://127.0.0.1:8091").replace(
    /\/$/,
    "",
  );

export async function internalFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${base()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    cache: "no-store",
  });
}
