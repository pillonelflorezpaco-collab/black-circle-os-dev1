export function Sparkline({ data, color = "#E8B368" }: { data: number[]; color?: string }) {
  const w = 600;
  const h = 140;
  const max = Math.max(...data, 1);
  const min = 0;
  const stepX = w / (data.length - 1 || 1);
  const y = (v: number) => h - ((v - min) / (max - min)) * (h - 18) - 6;
  const pts = data.map((v, i) => `${i * stepX},${y(v)}`);
  const path = `M${pts.join(" L")}`;
  const area = `${path} L${w},${h} L0,${h} Z`;
  const peakIdx = data.indexOf(max);
  const peakX = peakIdx * stepX;
  const peakY = y(max);
  const endX = w;
  const endY = y(data[data.length - 1] ?? 0);
  const uid = "spk";

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible", width: "100%", height: "100%" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`area_${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`blur_${uid}`} x="-20%" y="-40%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path d={area} fill={`url(#area_${uid})`} opacity="0.9" />
      <line x1={peakX} y1={peakY} x2={peakX} y2={h} stroke={color} strokeWidth="1" strokeDasharray="3 4" opacity="0.35" />
      <path d={path} fill="none" stroke={color} strokeWidth="5" filter={`url(#blur_${uid})`} opacity="0.35" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx={peakX} cy={peakY} r="9" fill={color} opacity="0.18">
        <animate attributeName="r" values="6;13;6" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.32;0;0.32" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={peakX} cy={peakY} r="3.5" fill={color} />
      <circle cx={endX} cy={endY} r="3" fill={color} />
    </svg>
  );
}
