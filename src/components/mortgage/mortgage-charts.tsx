"use client";

import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "@/lib/format";
import type { AmortizationSchedule, RenewalScenario } from "@/lib/sim/mortgage";
import { barCursor, chartMargin, crosshair, datumOf, gridProps, tick, TooltipCard, xAxisProps, yAxisProps } from "@/components/charts/chart-kit";

export const BALANCE_COLORS = { monthly: "var(--foreground)", biweekly: "var(--series-3)" } as const;
export const SPLIT_COLORS = { principal: "var(--series-1)", interest: "var(--series-2)" } as const;

export function BalanceChart({ monthly, biweekly, loan }: { monthly: AmortizationSchedule; biweekly: AmortizationSchedule; loan: number }) {
  const years = monthly.years.length;
  const data = Array.from({ length: years + 1 }, (_, y) => ({
    year: y,
    monthly: y === 0 ? loan : (monthly.years[y - 1]?.balance ?? 0),
    biweekly: y === 0 ? loan : (biweekly.years[y - 1]?.balance ?? 0),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={chartMargin}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="year" {...xAxisProps} ticks={data.filter((d) => d.year % 5 === 0).map((d) => d.year)} interval={0} tickFormatter={(y: number) => (y === 0 ? "Now" : `Yr ${y}`)} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <Tooltip
          cursor={crosshair}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={d.year === 0 ? "Today" : `End of year ${d.year}`}
                rows={[
                  { label: "Monthly payments", value: fmt.money(d.monthly), color: BALANCE_COLORS.monthly, shape: "line" },
                  { label: "Accelerated bi-weekly", value: fmt.money(d.biweekly), color: BALANCE_COLORS.biweekly, shape: "line" },
                ]}
              />
            );
          }}
        />
        <Line type="monotone" dataKey="monthly" stroke={BALANCE_COLORS.monthly} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
        <Line type="monotone" dataKey="biweekly" stroke={BALANCE_COLORS.biweekly} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function YearlySplitChart({ schedule }: { schedule: AmortizationSchedule }) {
  const data = schedule.years.map((y) => ({ ...y, total: y.interest + y.principal }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={chartMargin} barCategoryGap="22%">
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="year" {...xAxisProps} ticks={data.filter((d) => d.year === 1 || d.year % 5 === 0).map((d) => d.year)} interval={0} tickFormatter={(y: number) => `Yr ${y}`} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <Tooltip
          cursor={barCursor}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={`Year ${d.year}`}
                rows={[
                  { label: "Principal", value: fmt.money(d.principal), color: SPLIT_COLORS.principal },
                  { label: "Interest", value: fmt.money(d.interest), color: SPLIT_COLORS.interest },
                  { label: "Total paid", value: fmt.money(d.total), muted: true },
                ]}
                footer={`${Math.round((d.interest / d.total) * 100)}% of this year's payments go to interest`}
              />
            );
          }}
        />
        <Bar dataKey="principal" stackId="a" fill={SPLIT_COLORS.principal} stroke="var(--surface)" strokeWidth={1} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="interest" stackId="a" fill={SPLIT_COLORS.interest} stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RenewalChart({ scenarios, currentRate }: { scenarios: RenewalScenario[]; currentRate: number }) {
  const data = scenarios.map((s) => ({
    ...s,
    label: `${s.rate.toFixed(2)}%`,
    isToday: s.delta === 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ ...chartMargin, top: 28 }} barCategoryGap="30%">
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="label" {...xAxisProps} />
        <YAxis {...yAxisProps} tickFormatter={(v: number) => fmt.moneyCompact(v)} />
        <Tooltip
          cursor={barCursor}
          content={(p) => {
            const d = datumOf<(typeof data)[number]>(p);
            if (!d) return null;
            return (
              <TooltipCard
                title={`Renew at ${d.label}`}
                rows={[
                  { label: "New monthly payment", value: fmt.money(d.payment), color: "var(--series-1)" },
                  { label: "Change vs today", value: `${d.change >= 0 ? "+" : "−"}${fmt.money(Math.abs(d.change))}`, muted: true },
                ]}
                footer={d.isToday ? `Rates unchanged from ${currentRate.toFixed(2)}%` : `${d.delta > 0 ? "+" : ""}${d.delta} point${Math.abs(d.delta) === 1 ? "" : "s"} vs today`}
              />
            );
          }}
        />
        <Bar dataKey="payment" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
          <LabelList
            dataKey="change"
            position="top"
            offset={8}
            style={{ ...tick, fill: "var(--ink-2)" }}
            formatter={(v: unknown) => {
              const n = Number(v);
              if (Math.abs(n) < 1) return "today";
              return `${n > 0 ? "+" : "−"}${fmt.money(Math.abs(n))}`;
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
