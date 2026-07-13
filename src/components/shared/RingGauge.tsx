export function RingGauge({ value, target, label }: { value: number; target: number; label: string }) {
  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const ratio = Math.min(1, value / target);
  const color = value < 3 ? "var(--bc-red)" : value < 7 ? "var(--bc-amber)" : "var(--bc-green)";
  const status = value < 3 ? "Critique" : value < 7 ? "Attention" : "Sain";
  const dash = (CIRC * ratio).toFixed(1);

  return (
    <div className="bc-ring-tile">
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={R} className="bc-ring-track" />
        <circle cx="28" cy="28" r={R} className="bc-ring-fill" stroke={color} strokeDasharray={`${dash} ${CIRC.toFixed(1)}`} />
        <text x="28" y="31" textAnchor="middle" fontFamily="var(--font-jbmono)" fontSize="12" fontWeight="600" fill="var(--bc-text)">
          {value.toFixed(1).replace(".", ",")}
        </text>
      </svg>
      <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-jbmono)", fontSize: 9.5, color }}>{status}</span>
    </div>
  );
}
