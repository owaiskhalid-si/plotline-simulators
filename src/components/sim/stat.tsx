import { ArrowDownRightIcon, ArrowUpRightIcon, CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "good" | "bad" | "warn" | "neutral";

const toneIcon = {
  good: CircleCheckIcon,
  bad: CircleAlertIcon,
  warn: CircleAlertIcon,
  neutral: null,
} as const;

const toneText = {
  good: "text-good-text",
  bad: "text-critical-text",
  warn: "text-ink-2",
  neutral: "text-ink-3",
} as const;

export function StatTile({
  label,
  value,
  note,
  tone = "neutral",
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const Icon = toneIcon[tone];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 bg-surface px-4 py-3.5", className)}>
      <p className="truncate text-xs text-ink-3">{label}</p>
      <p className="truncate text-[1.375rem] leading-tight font-semibold tracking-tight">{value}</p>
      {note && (
        <p className={cn("flex items-start gap-1 text-xs leading-snug", toneText[tone])}>
          {Icon && <Icon className={cn("mt-px size-3.5 shrink-0", tone === "warn" && "text-warning")} aria-hidden />}
          <span className="line-clamp-2">{note}</span>
        </p>
      )}
    </div>
  );
}

/** A hairline-separated grid of stat tiles. */
export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline", className)}>{children}</div>
  );
}

export function Delta({ value, goodWhen = "up", children }: { value: number; goodWhen?: "up" | "down"; children: React.ReactNode }) {
  const up = value >= 0;
  const good = goodWhen === "up" ? up : !up;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span className={cn("inline-flex items-center gap-0.5", good ? "text-good-text" : "text-critical-text")}>
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function HeroFigure({
  eyebrow,
  value,
  unit,
  caption,
  badge,
}: {
  eyebrow: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  caption?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-hairline bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{eyebrow}</p>
        {badge}
      </div>
      <div>
        <p className="flex flex-wrap items-baseline gap-x-2 text-[3.25rem] leading-none font-semibold tracking-[-0.03em] sm:text-[3.75rem]">
          {value}
          {unit && <span className="text-lg font-medium tracking-normal text-ink-2">{unit}</span>}
        </p>
        {caption && <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">{caption}</p>}
      </div>
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const Icon = toneIcon[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "good" && "border-good/30 bg-good/10 text-good-text",
        tone === "bad" && "border-critical/30 bg-critical/10 text-critical-text",
        tone === "warn" && "border-warning/40 bg-warning/10 text-foreground",
        tone === "neutral" && "border-hairline bg-muted text-ink-2",
      )}
    >
      {Icon && <Icon className={cn("size-3.5", tone === "warn" && "text-warning")} aria-hidden />}
      {children}
    </span>
  );
}

/** Horizontal meter for a ratio against a limit (e.g. GDS vs 39%). */
export function LimitMeter({
  label,
  value,
  limit,
  max,
  help,
}: {
  label: string;
  value: number;
  limit: number;
  max: number;
  help?: string;
}) {
  const pct = Math.min(100, (Math.max(0, value) / max) * 100);
  const limitPct = (limit / max) * 100;
  const over = value > limit;
  const near = !over && value > limit * 0.92;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.8125rem] text-ink-2">{label}</p>
        <p className="text-sm font-semibold tabular">
          {Number.isFinite(value) ? `${value.toFixed(1)}%` : "—"}
          <span className="ml-1 font-normal text-ink-3">/ {limit}% max</span>
        </p>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-series-1/15" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300", over ? "bg-critical" : near ? "bg-warning" : "bg-series-1")}
          style={{ width: `${pct}%` }}
        />
        <div className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-foreground" style={{ left: `calc(${limitPct}% - 1px)` }} />
      </div>
      <p className={cn("mt-1.5 flex items-center gap-1 text-xs", over ? "text-critical-text" : "text-ink-3")}>
        {over ? <CircleAlertIcon className="size-3.5" aria-hidden /> : near ? <CircleAlertIcon className="size-3.5 text-warning" aria-hidden /> : <CircleCheckIcon className="size-3.5 text-good" aria-hidden />}
        {over ? `Over the ${limit}% limit` : near ? "Close to the limit" : "Within the limit"}
        {help && <span className="text-ink-3">· {help}</span>}
      </p>
    </div>
  );
}
