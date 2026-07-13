import { Sidebar } from "@/components/shared/Sidebar";
import { prisma } from "@/lib/prisma";
import { getSelectedClientId } from "@/app/actions";
import { auth } from "@/lib/auth";

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const [clients, selectedClientId, session] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSelectedClientId(),
    auth(),
  ]);

  return (
    <div className="bc-shell">
      <Sidebar
        clients={clients}
        selectedClientId={selectedClientId}
        user={session?.user ? { name: session.user.name, role: session.user.role } : null}
      />
      <div className="bc-main">{children}</div>
    </div>
  );
}
