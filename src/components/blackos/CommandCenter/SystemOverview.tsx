export interface SystemOverviewCard {
  label: string;
  value: number;
  sub: string;
  tone?: "amber" | "green" | "neutral";
}

// Secondary system indicators, not the focal point of the page — see
// .bc-mini-card.compact in globals.css. Amber is reserved for cards whose
// `tone` is explicitly "amber" (i.e. genuinely needs attention), never
// applied by default to purely informational counts.
export function SystemOverview({ cards }: { cards: SystemOverviewCard[] }) {
  return (
    <div className="bc-grid4 compact">
      {cards.map((card) => (
        <div className="bc-mini-card compact" key={card.label}>
          <div className="lab">{card.label}</div>
          <div className={`val${card.tone && card.tone !== "neutral" ? ` ${card.tone}` : ""}`}>{card.value}</div>
          <div className="sub">{card.sub}</div>
        </div>
      ))}
    </div>
  );
}
