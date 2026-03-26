import { redirect } from "next/navigation";

export default function EstoqueBcgRedirectPage() {
  redirect("/dashboard/estoque-e-compras?tab=visao");
}
