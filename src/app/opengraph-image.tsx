import { ImageResponse } from "next/og";
import { DEFAULT_RUNWAY, summarize } from "@/lib/sim/runway";

export const alt = "Plotline — business simulators";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card with a real chart from the runway engine. */
export default function OpengraphImage() {
  const plans = [
    { color: "#2a78d6", inputs: DEFAULT_RUNWAY },
    { color: "#eb6834", inputs: { ...DEFAULT_RUNWAY, fundingAmount: 2_000_000, fundingMonth: 10 } },
    { color: "#1baf7a", inputs: { ...DEFAULT_RUNWAY, fixedCosts: 68_000, fixedCostGrowth: 1 } },
  ].map((p) => ({ ...p, values: [p.inputs.startingCash, ...summarize(p.inputs).months.map((m) => m.cash)] }));

  const all = plans.flatMap((p) => p.values);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const w = 1040;
  const h = 200;
  const x = (i: number) => (i / (plans[0].values.length - 1)) * w;
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  const zero = y(0);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f3f0e8", padding: "56px 80px", fontFamily: "serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#141311" }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: "#141311", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: "#c8411a" }} />
          </div>
          Plotline
          <span style={{ marginLeft: 12, fontSize: 18, letterSpacing: 3, color: "#8a867c", fontFamily: "monospace" }}>BUSINESS SIMULATORS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30, fontSize: 68, lineHeight: 1.05, color: "#141311" }}>
          <span>Run the numbers</span>
          <div style={{ display: "flex" }}>
            <span style={{ color: "#c8411a", marginRight: 18 }}>before</span>
            <span>they run you.</span>
          </div>
        </div>
        <svg width={w} height={h + 20} viewBox={`0 -10 ${w} ${h + 20}`} style={{ marginTop: 36 }}>
          <line x1={0} x2={w} y1={zero} y2={zero} stroke="#c6c1b3" strokeWidth={2} />
          {plans.map((p) => (
            <path
              key={p.color}
              d={p.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={p.color}
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
