"use client";

import { useState, useRef, useMemo } from "react";

export type SparklinePoint = { label: string; value: number };

export function Sparkline({ data, color = "#E8B368" }: { data: SparklinePoint[]; color?: string }) {
  const w = 600;
  const h = 140;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;
  const stepX = w / (data.length - 1 || 1);
  const y = (v: number) => h - ((v - min) / (max - min)) * (h - 18) - 6;

  const points = useMemo(() => data.map((d, i) => ({ x: i * stepX, y: y(d.value), ...d })), [data, stepX, max]);
  const path = `M${points.map((p) => `${p.x},${p.y}`).join(" L")}`;
  const area = `${path} L${w},${h} L0,${h} Z`;

  const peakIdx = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const peak = points[peakIdx];
  const endPoint = points[points.length - 1];
  const active = hoverIdx !== null ? points[hoverIdx] : null;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * w;
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - relX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  const uid = "spk";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg
        ref={svgRef}
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ overflow: "visible", width: "100%", height: "100%", cursor: "crosshair" }}
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
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
        <line x1={peak.x} y1={peak.y} x2={peak.x} y2={h} stroke={color} strokeWidth="1" strokeDasharray="3 4" opacity="0.35" />
        <path d={path} fill="none" stroke={color} strokeWidth="5" filter={`url(#blur_${uid})`} opacity="0.35" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />

        {/* peak: pulsing emphasis + direct label, per mark spec (label the extreme, not every point) */}
        <circle cx={peak.x} cy={peak.y} r="9" fill={color} opacity="0.18">
          <animate attributeName="r" values="6;13;6" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.32;0;0.32" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={peak.x} cy={peak.y} r="3.5" fill={color} />
        <circle cx={endPoint.x} cy={endPoint.y} r="3" fill={color} />

        {/* hover crosshair + emphasized dot with a surface ring */}
        {active && (
          <>
            <line x1={active.x} y1="0" x2={active.x} y2={h} stroke={color} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
            <circle cx={active.x} cy={active.y} r="6" fill="#050505" />
            <circle cx={active.x} cy={active.y} r="4" fill={color} />
          </>
        )}
      </svg>

      {active && (
        <div
          style={{
            position: "absolute",
            left: `${(active.x / w) * 100}%`,
            top: Math.max(0, active.y - 54),
            transform: "translateX(-50%)",
            background: "#161311",
            border: `1px solid ${hexToRgba(color, 0.35)}`,
            borderRadius: 10,
            padding: "7px 11px",
            fontFamily: "var(--font-jbmono)",
            fontSize: 12,
            color,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0,0,0,.5)",
            zIndex: 10,
          }}
        >
          {active.value.toLocaleString("fr-FR")}
          <div style={{ color: "var(--bc-text-faint)", fontSize: 10, marginTop: 2 }}>{active.label}</div>
        </div>
      )}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
