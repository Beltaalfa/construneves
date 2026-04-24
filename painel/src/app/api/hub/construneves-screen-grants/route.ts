import { proxyHubJson } from "@/lib/hub-internal-proxy";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { statusCode, body } = await proxyHubJson({
    method: "GET",
    path: "/api/admin/construneves-screens",
    cookieHeader: request.headers.get("cookie"),
  });
  return new NextResponse(body, {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PUT(request: NextRequest) {
  const raw = await request.text();
  const { statusCode, body } = await proxyHubJson({
    method: "PUT",
    path: "/api/admin/construneves-screens",
    cookieHeader: request.headers.get("cookie"),
    body: raw,
  });
  return new NextResponse(body, {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}
