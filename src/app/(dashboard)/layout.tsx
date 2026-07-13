import { Sidebar } from "@/components/shared/Sidebar";
import { prisma } from "@/lib/prisma";
import { getSelectedClientId } from "@/app/actions";

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const [clients, selectedClientId] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSelectedClientId(),
  ]);

  return (
    <div className="bc-shell">
      <Sidebar clients={clients} selectedClientId={selectedClientId} />
      <div className="bc-main">{children}</div>
    </div>
  );
}
