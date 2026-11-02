import { fmt } from "@/lib/format";
import { DEFAULT_RUNWAY, summarize, type RunwayInputs } from "@/lib/sim/runway";
import { linePath, linearScale } from "./plot-math";

const W = 1200;
const H = 380;
const PAD = { top: 28, right: 24, bottom: 34, left: 64 };

const SCENARIOS: Array<{ label: string; color: string; inputs: RunwayInputs }> = [
  { label: "A · Base plan", color: "var(--series-1)", inputs: DEFAULT_RUNWAY },
  { label: "B · Raise $2M in month 10", color: "var(--series-2)", inputs: { ...DEFAULT_RUNWAY, fundingAmount: 2_000_000, fundingMonth: 10 } },
  { label: "C · Lean team", color: "var(--series-3)", inputs: { ...DEFAULT_RUNWAY, fixedCosts: 68_000, fixedCostGrowth: 1 } },
];

/**
 * The landing page's hero art is a real chart: the three default runway
 * scenarios, computed by the same engine the simulator uses, drawn at build time.
 */
export function HeroPlot() {
  const runs = SCENARIOS.map((s) => {
    const summary = summarize(s.inputs);
    const values = [s.inputs.startingCash, ...summary.months.map((m) => m.cash)];
    return { ...s, summary, values };
  });
  const all = runs.flatMap((r) => r.values);
  const yMin = Math.min(...all) * 1.1;
  const yMax = Math.max(...all) * 1.08;
  const months = runs[0].values.length - 1;
  const x = linearScale([0, months], [PAD.left, W - PAD.right]);
  const y = linearScale([yMin, yMax], [H - PAD.bottom, PAD.top]);

  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks = Array.from({ length: months / 6 + 1 }, (_, i) => i * 6);

  const a = runs[0];
  const b = runs[1];
  const c = runs[2];
  const outM = a.summary.runwayMonths ?? 0;
  const beC = c.summary.breakEvenMonth ?? 0;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby="hero-plot-title">
        <title id="hero-plot-title">Cash balance over 36 months for three startup scenarios</title>

        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--ink-3)" : "var(--grid)"} strokeWidth={1} />
            <text x={PAD.left - 12} y={y(t)} dy="0.32em" textAnchor="end" className="fill-ink-3 font-mono text-[11px]">
              {fmt.moneyCompact(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={H - 10} textAnchor="middle" className="fill-ink-3 font-mono text-[11px]">
            {t === 0 ? "Now" : `M${t}`}
          </text>
        ))}

        {/* Wash under the base plan */}
        <path
          d={`${linePath(a.values.map((v, i) => [x(i), y(v)]))} L${x(months)},${y(0)} L${x(0)},${y(0)} Z`}
          fill="var(--series-1)"
          fillOpacity={0.08}
          className="animate-fade [animation-delay:900ms]"
        />

        {runs.map((r, i) => (
          <path
            key={r.label}
            d={linePath(r.values.map((v, m) => [x(m), y(v)]))}
            fill="none"
            stroke={r.color}
            strokeWidth={2.25}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            className="animate-draw"
            style={{ animationDelay: `${150 + i * 220}ms` }}
          />
        ))}

        {/* Annotations */}
        <Annotation x={x(outM)} y={y(0)} dx={-18} dy={52} align="end" delay={1500} color={a.color} label={`Cash-out · month ${fmt.dec1(outM)}`} />
        <Annotation
          x={x(10)}
          y={y(b.values[10])}
          dx={22}
          dy={-6}
          align="start"
          delay={1700}
          color={b.color}
          label={`+${fmt.moneyCompact(2_000_000)} raise`}
        />
        <Annotation x={x(beC)} y={y(c.values[beC])} dx={0} dy={-40} align="middle" delay={1900} color={c.color} label={`Break-even · month ${beC}`} />
      </svg>

      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
        {runs.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-4 rounded-full" style={{ background: r.color }} aria-hidden />
            {r.label}
          </span>
        ))}
        <span className="text-ink-3">— cash in the bank, month by month</span>
      </figcaption>
    </figure>
  );
}

function Annotation({
  x,
  y,
  dx,
  dy,
  label,
  color,
  align,
  delay,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  label: string;
  color: string;
  align: "start" | "middle" | "end";
  delay: number;
}) {
  const tx = x + dx;
  const ty = y + dy;
  return (
    <g className="animate-fade" style={{ animationDelay: `${delay}ms` }}>
      <line x1={x} y1={y} x2={tx} y2={ty + (dy < 0 ? 6 : -14)} stroke="var(--ink-3)" strokeWidth={1} />
      <circle cx={x} cy={y} r={5.5} fill={color} stroke="var(--background)" strokeWidth={2.5} />
      <text x={tx} y={ty} textAnchor={align} className="fill-foreground font-mono text-[12px] font-medium">
        {label}
      </text>
    </g>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) ticks.push(Math.round(t) || 0);
  return ticks;
}
