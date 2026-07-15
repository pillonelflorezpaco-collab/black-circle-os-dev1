"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setSelectedClient, logout } from "@/app/actions";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/pipeline", label: "Content Pipeline" },
  { href: "/publications", label: "Publications" },
  { href: "/analytics", label: "Analytics" },
  { href: "/equipe", label: "Équipe" },
  { href: "/automatisations", label: "Automatisations" },
  { href: "/rapports", label: "Rapports" },
];

type ClientOption = { id: string; name: string };

type SidebarUser = { name: string; role: string } | null;

export function Sidebar({
  clients,
  selectedClientId,
  user,
}: {
  clients: ClientOption[];
  selectedClientId: string | null;
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = clients.find((c) => c.id === selectedClientId) ?? null;
  const label = selected ? selected.name : "Tous les clients";
  const initial = selected ? selected.name[0].toUpperCase() : "A";

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Closing the drawer on route change avoids it staying open after tapping a nav link.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function choose(id: string | null) {
    setOpen(false);
    setPending(true);
    await setSelectedClient(id);
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <div className="bc-mobile-topbar">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 4.5h12M2 8h12M2 11.5h12" />
          </svg>
        </button>
        <div className="bc-logo-word" style={{ fontSize: 15 }}>
          Black Circle <b>OS</b>
        </div>
      </div>

      <div className={`bc-sidebar-backdrop${mobileOpen ? " open" : ""}`} onClick={() => setMobileOpen(false)} />

      <aside className={`bc-sidebar${mobileOpen ? " open" : ""}`}>
        <div className="bc-logo-line">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9.2" stroke="var(--bc-amber)" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2.1" fill="var(--bc-amber)" />
          </svg>
          <div>
            <div className="bc-logo-word">
              Black Circle <b>OS</b>
            </div>
            <div className="bc-logo-sub">Control Center</div>
          </div>
        </div>

        <div style={{ position: "relative", marginBottom: 18 }} ref={menuRef}>
          <button
            type="button"
            className="bc-profile-switch"
            style={{ marginBottom: 0, opacity: pending ? 0.6 : 1 }}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            <span className="pf-avatar">{initial}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {label}
            </span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ transform: open ? "rotate(180deg)" : undefined }}>
              <path d="M3 4.5 6 7.5l3-3" />
            </svg>
          </button>

          {open && (
            <div className="bc-profile-menu">
              <button type="button" className={`bc-profile-menu-item${!selectedClientId ? " active" : ""}`} onClick={() => choose(null)}>
                Tous les clients
              </button>
              {clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`bc-profile-menu-item${selectedClientId === c.id ? " active" : ""}`}
                  onClick={() => choose(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bc-nav-label">Espace de travail</div>
        <nav className="bc-nav">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} className={`bc-nav-btn${active ? " active" : ""}`}>
                <span className="dot" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="bc-nav-label">Système</div>
        <nav className="bc-nav">
          <Link href="/parametres" className={`bc-nav-btn${pathname === "/parametres" ? " active" : ""}`}>
            <span className="dot" />
            Paramètres
          </Link>
        </nav>

        <div className="bc-sidebar-foot">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div className="who">{user?.name ?? "—"}</div>
              <span>{user?.role ?? "—"} · v0.1</span>
            </div>
            {user && (
              <form action={logout}>
                <button
                  type="submit"
                  title="Se déconnecter"
                  style={{ background: "none", border: "none", color: "var(--bc-text-faint)", cursor: "pointer", padding: 4 }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M5.5 12.5h-3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3" />
                    <path d="M9.5 9.5 12.5 7 9.5 4.5M12.5 7h-8" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
