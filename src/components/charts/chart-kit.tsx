"use client";

import { Swatch, type LegendItem } from "@/components/sim/frame";

/** Shared Recharts styling so every chart reads as one system. */
export const tick = { fill: "var(--ink-3)", fontSize: 11, fontFamily: "var(--font-plex-mono)" } as const;

export const xAxisProps = {
  tick,
  tickLine: false,
  axisLine: { stroke: "var(--axis)" },
  tickMargin: 8,
  minTickGap: 16,
} as const;

export const yAxisProps = {
  tick,
  tickLine: false,
  axisLine: false,
  tickMargin: 6,
  width: 58,
} as const;

export const gridProps = { vertical: false, stroke: "var(--grid)" } as const;

export const crosshair = { stroke: "var(--ink-3)", strokeWidth: 1, strokeOpacity: 0.6 } as const;

export const barCursor = { fill: "var(--foreground)", fillOpacity: 0.04 } as const;

export const chartMargin = { top: 8, right: 12, bottom: 0, left: 0 } as const;

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  shape?: LegendItem["shape"];
  muted?: boolean;
}

export function TooltipCard({ title, rows, footer }: { title: string; rows: TooltipRow[]; footer?: string }) {
  return (
    <div className="min-w-[180px] rounded-lg border border-hairline bg-popover px-3 py-2.5 text-xs shadow-[0_8px_24px_-8px_rgb(0_0_0/0.25)]">
      <p className="mb-1.5 font-mono text-[0.6875rem] tracking-wide text-ink-3 uppercase">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              {r.color && <Swatch color={r.color} shape={r.shape} />}
              {r.label}
            </span>
            <span className={r.muted ? "tabular text-ink-3" : "font-medium tabular text-foreground"}>{r.value}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-2 border-t border-hairline pt-1.5 text-ink-3">{footer}</p>}
    </div>
  );
}

/** Recharts passes `{ active, payload }` to custom content; this narrows it. */
export function datumOf<T>(props: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }): T | null {
  if (!props.active || !props.payload?.length) return null;
  return (props.payload[0].payload as T) ?? null;
}

/** Evenly spaced month ticks (every 3, 6 or 12 months depending on the horizon). */
export function monthTicks(horizon: number, from = 0): number[] {
  const step = horizon <= 24 ? 3 : horizon <= 36 ? 6 : 12;
  const ticks: number[] = [];
  for (let m = from === 0 ? 0 : step; m <= horizon; m += step) ticks.push(m);
  return ticks;
}
