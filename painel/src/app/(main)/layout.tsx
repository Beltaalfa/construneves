import { LayoutWithSidebar } from "@/components/layout/LayoutWithSidebar";
import { resolveNavAccessFromCookies } from "@/lib/resolve-nav-access";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const navAccess = await resolveNavAccessFromCookies();
  return <LayoutWithSidebar navAccess={navAccess}>{children}</LayoutWithSidebar>;
}
