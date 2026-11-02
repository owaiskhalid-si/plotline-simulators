"use client";

import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/format";
import type { BreakEvenInputs, BreakEvenSummary, CvpPoint, HeatCell, PricePoint } from "@/lib/sim/break-even";
import { chartMargin, crosshair, datumOf, gridProps, TooltipCard, xAxisProps, yAxisProps } from "@/components/charts/chart-kit";

export const CVP_COLORS = { revenue: "var(--series-1)", cost: "var(--series-2)" } as const;

export function CvpChart({ points, inputs, summary }: { points: CvpPoint[]; inputs: BreakEvenInputs; summary: BreakEvenSummary }) {
  const be = summary.breakEvenUnits;
  const maxUnits = points[points.length - 1]?.units ?? 0;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={points} margin={{ ...chartMargin, top: 20 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="units" type="number" domain={[0, maxUnits]} {...xAxisProps} tickFormatter={(v: number) => fmt.compact(v)} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <ReferenceLine
          y={inputs.fixedCosts}
          stroke="var(--ink-3)"
          strokeDasharray="3 3"
          label={{ value: "Fixed costs", position: "insideBottomRight", fill: "var(--ink-3)", fontSize: 11 }}
        />
        {inputs.volume > 0 && inputs.volume <= maxUnits && (
          <ReferenceLine x={inputs.volume} stroke="var(--foreground)" strokeWidth={1} label={{ value: "Your plan", position: "top", fill: "var(--ink-2)", fontSize: 11 }} />
        )}
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<CvpPoint>(p);
            if (!d) return null;
            const profit = d.revenue - d.totalCost;
            return (
              <TooltipCard
                title={`${fmt.int(d.units)} units`}
                rows={[
                  { label: "Revenue", value: fmt.money(d.revenue), color: CVP_COLORS.revenue, shape: "line" },
                  { label: "Total costs", value: fmt.money(d.totalCost), color: CVP_COLORS.cost, shape: "line" },
                  { label: profit >= 0 ? "Profit" : "Loss", value: fmt.money(Math.abs(profit)), muted: true },
                ]}
              />
            );
          }}
        />
        <Line type="linear" dataKey="totalCost" stroke={CVP_COLORS.cost} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        <Line type="linear" dataKey="revenue" stroke={CVP_COLORS.revenue} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        {Number.isFinite(be) && be <= maxUnits && (
          <ReferenceDot
            x={be}
            y={be * inputs.price}
            r={6}
            fill="var(--foreground)"
            stroke="var(--surface)"
            strokeWidth={2}
            label={{ value: `Break-even · ${fmt.int(be)}`, position: "left", offset: 12, fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function PriceCurveChart({ points, inputs, summary }: { points: PricePoint[]; inputs: BreakEvenInputs; summary: BreakEvenSummary }) {
  const opt = summary.optimalPrice;
  const lo = points[0]?.price ?? 0;
  const hi = points[points.length - 1]?.price ?? 1;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={points} margin={{ ...chartMargin, top: 20 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="price" type="number" domain={[lo, hi]} {...xAxisProps} tickFormatter={(v: number) => fmt.price(v)} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <ReferenceLine y={0} stroke="var(--ink-3)" />
        <ReferenceLine x={inputs.price} stroke="var(--foreground)" strokeWidth={1} label={{ value: "Today", position: "insideBottomLeft", fill: "var(--ink-2)", fontSize: 11 }} />
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<PricePoint>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={`Price ${fmt.price(d.price)}`}
                rows={[
                  { label: "Monthly profit", value: fmt.money(d.profit), color: "var(--series-1)", shape: "line" },
                  { label: "Expected sales", value: `${fmt.int(d.volume)} units`, muted: true },
                ]}
              />
            );
          }}
        />
        <Area type="monotone" dataKey="profit" stroke="none" fill="var(--series-1)" fillOpacity={0.08} isAnimationActive={false} baseValue={0} />
        <Line type="monotone" dataKey="profit" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        {opt !== null && opt >= lo && opt <= hi && summary.optimalProfit !== null && (
          <ReferenceDot
            x={opt}
            y={summary.optimalProfit}
            r={6}
            fill="var(--series-1)"
            stroke="var(--surface)"
            strokeWidth={2}
            label={{ value: `Best ${fmt.price(opt)}`, position: "top", offset: 10, fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Diverging heatmap: red = loss, grey = break-even, blue = profit. */
export function ProfitHeatmap({ prices, volumes, cells }: { prices: number[]; volumes: number[]; cells: HeatCell[] }) {
  const [hover, setHover] = useState<HeatCell | null>(null);
  const maxAbs = Math.max(1, ...cells.map((c) => Math.abs(c.profit)));
  const mid = Math.floor(prices.length / 2);
  const rows = [...volumes].reverse(); // highest volume on top

  const fill = (profit: number) => {
    const t = Math.min(1, Math.abs(profit) / maxAbs);
    const pole = profit >= 0 ? "var(--div-pos)" : "var(--div-neg)";
    return { background: `color-mix(in oklab, ${pole} ${Math.round(12 + t * 88)}%, var(--div-mid))`, dark: t > 0.5 };
  };

  const shown = hover ?? cells.find((c) => c.price === prices[mid] && c.volume === volumes[mid]) ?? null;

  return (
    <div>
      <div className="flex gap-2">
        <div className="flex w-12 shrink-0 flex-col justify-between py-1 text-right font-mono text-[0.625rem] text-ink-3" aria-hidden>
          {rows.map((v, i) => (
            <span key={i} className={cn(i % 2 === 1 && "invisible")}>
              {fmt.compact(v)}
            </span>
          ))}
        </div>
        <div
          className="grid flex-1 gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${prices.length}, minmax(0, 1fr))` }}
          role="grid"
          aria-label="Monthly profit by price and volume"
          onMouseLeave={() => setHover(null)}
        >
          {rows.map((v, ri) =>
            prices.map((p, ci) => {
              const cell = cells.find((c) => c.price === p && c.volume === v)!;
              const f = fill(cell.profit);
              const isPlan = ci === mid && ri === rows.length - 1 - mid;
              return (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  role="gridcell"
                  onMouseEnter={() => setHover(cell)}
                  onFocus={() => setHover(cell)}
                  aria-label={`Price ${fmt.price(p)}, ${fmt.int(v)} units: ${fmt.money(cell.profit)}`}
                  className={cn(
                    "relative aspect-[1.35] min-h-6 rounded-[3px] text-[0.625rem] font-medium tabular transition-transform hover:z-10 hover:scale-[1.08] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-foreground",
                    f.dark ? "text-white" : "text-foreground",
                    isPlan && "ring-2 ring-foreground ring-offset-1 ring-offset-surface",
                  )}
                  style={{ background: f.background }}
                >
                  <span className="hidden sm:inline">{fmt.moneyCompact(cell.profit).replace("$", "")}</span>
                </button>
              );
            }),
          )}
        </div>
      </div>
      <div className="mt-1.5 flex gap-2">
        <div className="w-12 shrink-0" />
        <div className="grid flex-1 font-mono text-[0.625rem] text-ink-3" style={{ gridTemplateColumns: `repeat(${prices.length}, minmax(0, 1fr))` }} aria-hidden>
          {prices.map((p, i) => (
            <span key={i} className={cn("text-center", i % 2 === 1 && "invisible")}>
              {fmt.price(p)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3 text-xs">
        <div className="flex items-center gap-2 text-ink-3">
          <span>Loss</span>
          <span
            className="h-2 w-28 rounded-full"
            style={{ background: "linear-gradient(to right, var(--div-neg), var(--div-mid), var(--div-pos))" }}
            aria-hidden
          />
          <span>Profit</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="size-2.5 rounded-[2px] ring-2 ring-foreground" aria-hidden /> your plan
          </span>
        </div>
        {shown && (
          <p className="text-ink-2 tabular">
            {fmt.price(shown.price)} × {fmt.int(shown.volume)} units →{" "}
            <span className={cn("font-medium", shown.profit >= 0 ? "text-good-text" : "text-critical-text")}>{fmt.money(shown.profit)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
