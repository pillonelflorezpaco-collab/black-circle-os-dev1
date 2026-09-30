import Link from "next/link";

const TABS: { href: string; label: string; key: "overview" | "calendar" | "accounts" | "flow" }[] = [
  { href: "/social-media", label: "Overview", key: "overview" },
  { href: "/social-media/calendar", label: "Calendar", key: "calendar" },
  { href: "/social-media/accounts", label: "Accounts", key: "accounts" },
  { href: "/social-media/flow", label: "Flow", key: "flow" },
];

export function SocialMediaTabs({ active }: { active: "overview" | "calendar" | "accounts" | "flow" }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className="bc-plat-chip"
          style={{
            textDecoration: "none",
            background: active === tab.key ? "var(--bc-amber-glow)" : undefined,
            borderColor: active === tab.key ? "transparent" : undefined,
            color: active === tab.key ? "var(--bc-amber)" : undefined,
          }}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
