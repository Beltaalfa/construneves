import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

function hubPublicHostHeader(): string {
  const raw = process.env.NEXTAUTH_URL?.trim() || process.env.HUB_PUBLIC_URL?.trim();
  if (raw) {
    try {
      return new URL(raw.endsWith("/") ? raw : `${raw}/`).host;
    } catch {
      /* fallthrough */
    }
  }
  return process.env.HUB_PUBLIC_HOST?.trim() || "hub.northempresarial.com";
}

/**
 * Proxy server-to-server para o Hub (mesmo padrão do Applyfy: Cookie + Host público).
 */
export function proxyHubJson(opts: {
  method: "GET" | "PUT";
  path: string;
  cookieHeader: string | null;
  body?: string;
}): Promise<{ statusCode: number; body: string }> {
  const base = (process.env.HUB_INTERNAL_URL || "http://127.0.0.1:3007").replace(/\/$/, "");
  const parsed = new URL(base.endsWith("/") ? base : `${base}/`);
  const isHttps = parsed.protocol === "https:";
  const port = parsed.port ? Number(parsed.port) : isHttps ? 443 : 80;
  const hostname = parsed.hostname;
  const hubHost = hubPublicHostHeader();
  const xfProto =
    process.env.HUB_INTERNAL_X_FORWARDED_PROTO?.trim().toLowerCase() === "http"
      ? "http"
      : "https";

  return new Promise((resolve, reject) => {
    const headers: http.OutgoingHttpHeaders = {
      Host: hubHost,
      Accept: "application/json",
      "X-Forwarded-Host": hubHost,
      "X-Forwarded-Proto": xfProto,
      Cookie: opts.cookieHeader ?? "",
    };
    if (opts.body != null) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(opts.body, "utf8"));
    }

    const req = (isHttps ? https : http).request(
      {
        hostname,
        port,
        path: opts.path,
        method: opts.method,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (opts.body != null) req.write(opts.body, "utf8");
    req.end();
  });
}
