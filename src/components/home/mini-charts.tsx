import { DEFAULT_RUNWAY, monteCarlo } from "@/lib/sim/runway";
import { amortize, DEFAULT_MORTGAGE, maxAffordable } from "@/lib/sim/mortgage";
import { cvpSeries, DEFAULT_BREAK_EVEN, summarizeBreakEven } from "@/lib/sim/break-even";
import { linePath, linearScale } from "./plot-math";

const W = 400;
const H = 150;

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={0} x2={W} y1={H * t} y2={H * t} stroke="var(--grid)" strokeWidth={1} />
      ))}
      {children}
    </svg>
  );
}

export function MiniRunway() {
  const mc = monteCarlo(DEFAULT_RUNWAY, { runs: 400, uncertainty: 0.2, seed: 3 });
  const bands = [
    { month: 0, p10: DEFAULT_RUNWAY.startingCash, p25: DEFAULT_RUNWAY.startingCash, p50: DEFAULT_RUNWAY.startingCash, p75: DEFAULT_RUNWAY.startingCash, p90: DEFAULT_RUNWAY.startingCash },
    ...mc.bands,
  ];
  const lo = Math.min(...bands.map((b) => b.p10));
  const hi = Math.max(...bands.map((b) => b.p90));
  const x = linearScale([0, bands.length - 1], [6, W - 6]);
  const y = linearScale([lo, hi], [H - 8, 10]);
  const area = (a: "p10" | "p25", b: "p90" | "p75") =>
    `${linePath(bands.map((d) => [x(d.month), y(d[b])]))} ${bands
      .slice()
      .reverse()
      .map((d) => `L${x(d.month).toFixed(1)},${y(d[a]).toFixed(1)}`)
      .join(" ")} Z`;
  return (
    <Frame label="Monte Carlo fan chart of cash balance">
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeWidth={1} />
      <path d={area("p10", "p90")} fill="var(--series-1)" opacity={0.13} />
      <path d={area("p25", "p75")} fill="var(--series-1)" opacity={0.22} />
      <path d={linePath(bands.map((d) => [x(d.month), y(d.p50)]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
    </Frame>
  );
}

export function MiniMortgage() {
  const home = maxAffordable(DEFAULT_MORTGAGE).evaluation;
  const s = amortize(home.loan, DEFAULT_MORTGAGE.rate, home.amortizationYears);
  const max = Math.max(...s.years.map((r) => r.principal + r.interest));
  const band = (W - 12) / s.years.length;
  const bw = Math.min(10, band * 0.62);
  const y = linearScale([0, max * 1.1], [H - 6, 6]);
  return (
    <Frame label="Principal and interest paid each year">
      {s.years.map((r, i) => {
        const cx = 6 + band * i + band / 2;
        const pTop = y(r.principal);
        const iTop = y(r.principal + r.interest);
        return (
          <g key={r.year}>
            <rect x={cx - bw / 2} y={pTop} width={bw} height={H - 6 - pTop} fill="var(--series-1)" />
            <rect x={cx - bw / 2} y={iTop} width={bw} height={Math.max(0, pTop - iTop - 1.5)} rx={2} fill="var(--series-2)" />
          </g>
        );
      })}
    </Frame>
  );
}

export function MiniBreakEven() {
  const pts = cvpSeries(DEFAULT_BREAK_EVEN, 21);
  const s = summarizeBreakEven(DEFAULT_BREAK_EVEN);
  const maxU = pts[pts.length - 1].units;
  const maxV = Math.max(...pts.map((p) => Math.max(p.revenue, p.totalCost)));
  const x = linearScale([0, maxU], [6, W - 6]);
  const y = linearScale([0, maxV * 1.05], [H - 6, 8]);
  const be = s.breakEvenUnits;
  return (
    <Frame label="Cost-volume-profit lines crossing at break-even">
      <path d={linePath(pts.map((p) => [x(p.units), y(p.totalCost)]))} fill="none" stroke="var(--series-2)" strokeWidth={2} />
      <path d={linePath(pts.map((p) => [x(p.units), y(p.revenue)]))} fill="none" stroke="var(--series-1)" strokeWidth={2} />
      <circle cx={x(be)} cy={y(be * DEFAULT_BREAK_EVEN.price)} r={5.5} fill="var(--foreground)" stroke="var(--surface)" strokeWidth={2.5} />
    </Frame>
  );
}
