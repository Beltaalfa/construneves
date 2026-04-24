import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { hubJwtCookieName } from "@/lib/auth";
import PermissoesClient from "./PermissoesClient";

export default async function PermissoesPage() {
  const token = (await cookies()).get(hubJwtCookieName())?.value;
  let hubRole = "client";
  let initialScreens: string[] | null = null;
  if (token) {
    try {
      const p = decodeJwt(token) as Record<string, unknown>;
      if (typeof p.hub_role === "string") hubRole = p.hub_role;
      if (Array.isArray(p.construneves_screens)) {
        initialScreens = p.construneves_screens as string[];
      }
    } catch {
      /* ignore */
    }
  }
  return <PermissoesClient initialHubRole={hubRole} initialScreens={initialScreens} />;
}
