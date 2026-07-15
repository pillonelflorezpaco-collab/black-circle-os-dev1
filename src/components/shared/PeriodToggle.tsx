"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const PERIOD_LABELS: Record<string, string> = {
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
};

export function PeriodToggle({ period, from, to }: { period: string; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showCustom, setShowCustom] = useState(period === "custom");
  const [fromVal, setFromVal] = useState(from ?? "");
  const [toVal, setToVal] = useState(to ?? "");

  function go(p: string) {
    router.push(`${pathname}?period=${p}`, { scroll: false });
  }

  function applyCustom(newFrom: string, newTo: string) {
    if (newFrom && newTo) {
      router.push(`${pathname}?period=custom&from=${newFrom}&to=${newTo}`, { scroll: false });
    }
  }

  const dateInputStyle: React.CSSProperties = {
    background: "var(--bc-surface-2)",
    border: "1px solid var(--bc-border)",
    color: "var(--bc-text)",
    fontSize: 11.5,
    padding: "6px 8px",
    borderRadius: 7,
    fontFamily: "var(--font-jbmono)",
    colorScheme: "dark",
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div className="bc-time-toggle">
        {Object.keys(PERIOD_LABELS).map((p) => (
          <button
            key={p}
            type="button"
            className={period === p && !showCustom ? "active" : ""}
            onClick={() => {
              setShowCustom(false);
              go(p);
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <button type="button" className={showCustom ? "active" : ""} onClick={() => setShowCustom(true)}>
          Personnalisé
        </button>
      </div>

      {showCustom && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="date"
            value={fromVal}
            max={toVal || undefined}
            onChange={(e) => {
              setFromVal(e.target.value);
              applyCustom(e.target.value, toVal);
            }}
            style={dateInputStyle}
          />
          <span style={{ color: "var(--bc-text-faint)", fontSize: 11 }}>→</span>
          <input
            type="date"
            value={toVal}
            min={fromVal || undefined}
            onChange={(e) => {
              setToVal(e.target.value);
              applyCustom(fromVal, e.target.value);
            }}
            style={dateInputStyle}
          />
        </div>
      )}
    </div>
  );
}
