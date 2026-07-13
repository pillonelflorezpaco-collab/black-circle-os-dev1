"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export function Sidebar() {
  const pathname = usePathname();

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

      <button type="button" className="bc-profile-switch">
        <span className="pf-avatar">A</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Tous les clients
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 4.5 6 7.5l3-3" />
        </svg>
      </button>

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
