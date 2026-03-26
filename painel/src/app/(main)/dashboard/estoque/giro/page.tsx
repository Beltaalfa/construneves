import { redirect } from "next/navigation";

export default function EstoqueGiroRedirectPage() {
  redirect("/dashboard/estoque-e-compras?tab=cobertura");
}
