import { Sidebar } from "@/components/shared/Sidebar";
import { prisma } from "@/lib/prisma";
import { getSelectedModelId } from "@/app/actions";
import { getEffectiveAgencyId, getActingAgencyId } from "@/lib/agencyContext";
import { auth } from "@/lib/auth";

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const agencyId = await getEffectiveAgencyId();

  const [models, selectedModelId, agencies, selectedAgencyId] = await Promise.all([
    prisma.model.findMany({ where: agencyId ? { agencyId } : undefined, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getSelectedModelId(),
    isSuperAdmin ? prisma.agency.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : Promise.resolve(undefined),
    isSuperAdmin ? getActingAgencyId() : Promise.resolve(undefined),
  ]);

  return (
    <div className="bc-shell">
      <Sidebar
        models={models}
        selectedModelId={selectedModelId}
        agencies={agencies}
        selectedAgencyId={selectedAgencyId}
        user={session?.user ? { name: session.user.name, role: session.user.role } : null}
      />
      <div className="bc-main">{children}</div>
    </div>
  );
}
