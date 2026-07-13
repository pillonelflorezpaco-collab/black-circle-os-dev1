import { Sidebar } from "@/components/shared/Sidebar";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bc-shell">
      <Sidebar />
      <div className="bc-main">{children}</div>
    </div>
  );
}
