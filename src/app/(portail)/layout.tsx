export default function PortailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bc-bg)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {children}
    </div>
  );
}
