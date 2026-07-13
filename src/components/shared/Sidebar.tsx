"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setSelectedClient } from "@/app/actions";

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

export function Sidebar({
  clients,
  selectedClientId,
}: {
  clients: ClientOption[];
  selectedClientId: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
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

  async function choose(id: string | null) {
    setOpen(false);
    setPending(true);
    await setSelectedClient(id);
    setPending(false);
    router.refresh();
  }

  return (
    <aside className="bc-sidebar">
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
        <span className="who">Angels Pillonel</span>
        <span>Admin · v0.1</span>
      </div>
    </aside>
  );
}
