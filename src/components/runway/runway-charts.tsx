"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmt } from "@/lib/format";
import type { MonteCarloBand, RunwaySummary } from "@/lib/sim/runway";
import { chartMargin, crosshair, datumOf, gridProps, monthTicks, TooltipCard, xAxisProps, yAxisProps } from "@/components/charts/chart-kit";

export interface ScenarioSeries {
  name: string;
  color: string;
  summary: RunwaySummary;
  startingCash: number;
  fundingMonth: number;
  fundingAmount: number;
}

const monthTick = (m: number) => (m === 0 ? "Now" : `M${m}`);

/** Cash balance — one scenario with a wash, or all scenarios as lines. */
export function CashChart({ scenarios, activeIndex, compare }: { scenarios: ScenarioSeries[]; activeIndex: number; compare: boolean }) {
  const shown = compare ? scenarios : [scenarios[activeIndex]];
  const horizon = Math.max(...shown.map((s) => s.summary.months.length));
  const data = Array.from({ length: horizon + 1 }, (_, m) => {
    const row: Record<string, number> = { month: m };
    shown.forEach((s, i) => {
      row[`s${i}`] = m === 0 ? s.startingCash : (s.summary.months[m - 1]?.cash ?? NaN);
    });
    return row;
  });
  const single = shown.length === 1 ? shown[0] : null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="month" {...xAxisProps} ticks={monthTicks(horizon)} interval={0} tickFormatter={monthTick} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <ReferenceLine y={0} stroke="var(--ink-3)" strokeWidth={1} />
        {single && single.fundingMonth > 0 && single.fundingAmount > 0 && single.fundingMonth <= horizon && (
          <ReferenceLine
            x={single.fundingMonth}
            stroke="var(--ink-3)"
            strokeDasharray="3 3"
            label={{ value: `+${fmt.moneyCompact(single.fundingAmount)}`, position: "insideTopLeft", fill: "var(--ink-2)", fontSize: 11 }}
          />
        )}
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<Record<string, number>>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={d.month === 0 ? "Today" : `Month ${d.month}`}
                rows={shown.map((s, i) => ({ label: s.name, value: fmt.money(d[`s${i}`]), color: s.color, shape: "line" }))}
              />
            );
          }}
        />
        {single && (
          <Area type="monotone" dataKey="s0" stroke="none" fill={single.color} fillOpacity={0.1} isAnimationActive={false} />
        )}
        {shown.map((s, i) => (
          <Line
            key={s.name + i}
            type="monotone"
            dataKey={`s${i}`}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4.5, stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        ))}
        {shown.map((s, i) =>
          s.summary.runwayMonths !== null ? (
            <ReferenceDot
              key={`out${i}`}
              x={Math.round(s.summary.runwayMonths)}
              y={0}
              r={5}
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ) : null,
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Gross profit vs operating costs — the gap between the lines is the monthly burn. */
export function ProfitVsCostChart({ summary, color }: { summary: RunwaySummary; color: string }) {
  const data = summary.months.map((m) => ({
    month: m.month,
    grossProfit: m.grossProfit,
    opex: m.marketing + m.fixed,
    net: m.netIncome,
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="month" {...xAxisProps} ticks={monthTicks(data.length, 1)} interval={0} tickFormatter={monthTick} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        {summary.breakEvenMonth !== null && (
          <ReferenceLine x={summary.breakEvenMonth} stroke="var(--ink-3)" strokeDasharray="3 3" label={{ value: "Break-even", position: "insideTopRight", fill: "var(--ink-2)", fontSize: 11 }} />
        )}
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={`Month ${d.month}`}
                rows={[
                  { label: "Gross profit", value: fmt.money(d.grossProfit), color, shape: "line" },
                  { label: "Operating costs", value: fmt.money(d.opex), color: "var(--ink-3)", shape: "line" },
                  { label: d.net >= 0 ? "Profit" : "Burn", value: fmt.money(Math.abs(d.net)), muted: true },
                ]}
              />
            );
          }}
        />
        <Line type="monotone" dataKey="opex" stroke="var(--ink-3)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="grossProfit" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CustomersChart({ summary, color }: { summary: RunwaySummary; color: string }) {
  const data = summary.months.map((m) => ({ month: m.month, customers: m.customers, added: m.newCustomers, lost: m.churnedCustomers }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="month" {...xAxisProps} ticks={monthTicks(data.length, 1)} interval={0} tickFormatter={monthTick} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.compact(v)} />
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={`Month ${d.month}`}
                rows={[
                  { label: "Customers", value: fmt.int(d.customers), color, shape: "line" },
                  { label: "Added", value: `+${fmt.int(d.added)}`, muted: true },
                  { label: "Churned", value: `−${fmt.int(d.lost)}`, muted: true },
                ]}
              />
            );
          }}
        />
        <Area type="monotone" dataKey="customers" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Monte Carlo fan: P10–P90 and P25–P75 bands around the median path. */
export function FanChart({ bands, startingCash, color }: { bands: MonteCarloBand[]; startingCash: number; color: string }) {
  const data = [
    { month: 0, outer: [startingCash, startingCash], inner: [startingCash, startingCash], p50: startingCash, p10: startingCash, p90: startingCash, p25: startingCash, p75: startingCash, survival: 1 },
    ...bands.map((b) => ({ month: b.month, outer: [b.p10, b.p90], inner: [b.p25, b.p75], p50: b.p50, p10: b.p10, p90: b.p90, p25: b.p25, p75: b.p75, survival: b.survival })),
  ];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="month" {...xAxisProps} ticks={monthTicks(bands.length)} interval={0} tickFormatter={monthTick} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <ReferenceLine y={0} stroke="var(--ink-3)" strokeWidth={1} />
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={d.month === 0 ? "Today" : `Month ${d.month}`}
                rows={[
                  { label: "Best 10%", value: fmt.money(d.p90), muted: true },
                  { label: "Upper quartile", value: fmt.money(d.p75), muted: true },
                  { label: "Median", value: fmt.money(d.p50), color, shape: "line" },
                  { label: "Lower quartile", value: fmt.money(d.p25), muted: true },
                  { label: "Worst 10%", value: fmt.money(d.p10), muted: true },
                ]}
                footer={`${Math.round(d.survival * 100)}% of futures still have cash`}
              />
            );
          }}
        />
        <Area type="monotone" dataKey="outer" stroke="none" fill={color} fillOpacity={0.12} isAnimationActive={false} />
        <Area type="monotone" dataKey="inner" stroke="none" fill={color} fillOpacity={0.22} isAnimationActive={false} />
        <Line type="monotone" dataKey="p50" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4.5, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SurvivalChart({ bands, color }: { bands: MonteCarloBand[]; color: string }) {
  const data = [{ month: 0, survival: 100 }, ...bands.map((b) => ({ month: b.month, survival: b.survival * 100 }))];
  return (
    <ResponsiveContainer width="100%" height={150}>
      <AreaChart data={data} margin={{ ...chartMargin, left: -8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="month" {...xAxisProps} ticks={monthTicks(bands.length).filter((_, i) => i % 2 === 0)} interval={0} tickFormatter={monthTick} />
        <YAxis {...yAxisProps} width={44} domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return <TooltipCard title={d.month === 0 ? "Today" : `Month ${d.month}`} rows={[{ label: "Still solvent", value: `${d.survival.toFixed(1)}%`, color, shape: "line" }]} />;
          }}
        />
        <Area type="stepAfter" dataKey="survival" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
