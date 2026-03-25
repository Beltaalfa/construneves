import { redirect } from "next/navigation";
import { LoginForm } from "./ui-login-form";
import { isLoginEnabled } from "@/lib/auth";

type Props = { searchParams?: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (!isLoginEnabled()) {
    redirect("/");
  }
  const sp = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4">
      <div className="w-full max-w-sm space-y-4 p-6 rounded-xl border border-zinc-800 bg-zinc-900/30">
        <h1 className="text-lg font-semibold text-zinc-100 mb-4">
          Acesso ao painel
        </h1>
        <LoginForm nextPath={sp?.next || "/"} />
      </div>
    </div>
  );
}
