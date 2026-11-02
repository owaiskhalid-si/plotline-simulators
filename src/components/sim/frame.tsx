"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DownloadIcon, LinkIcon, PrinterIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Segmented } from "./field";

export interface LegendItem {
  label: string;
  color: string;
  shape?: "line" | "band" | "square" | "dot";
}

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5 text-xs text-ink-2">
          <Swatch color={it.color} shape={it.shape} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export function Swatch({ color, shape = "square" }: { color: string; shape?: LegendItem["shape"] }) {
  if (shape === "line") return <span className="h-[2px] w-3.5 rounded-full" style={{ background: color }} aria-hidden />;
  if (shape === "dot") return <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />;
  if (shape === "band") return <span className="h-2.5 w-3.5 rounded-[3px]" style={{ background: color }} aria-hidden />;
  return <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />;
}

export function ChartFrame({
  title,
  description,
  legend,
  table,
  aside,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  legend?: LegendItem[];
  /** When provided, the frame offers a Chart / Table toggle (the accessible view). */
  table?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={cn("print-break min-w-0 rounded-xl border border-hairline bg-surface p-4 sm:p-5", className)}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[0.9375rem] font-medium tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-3">{description}</p>}
        </div>
        <div className="no-print flex items-center gap-2">
          {aside}
          {table && (
            <Segmented
              size="sm"
              ariaLabel={`${title} view`}
              value={view}
              onChange={setView}
              options={[
                { value: "chart", label: "Chart" },
                { value: "table", label: "Table" },
              ]}
            />
          )}
        </div>
      </header>
      {legend && legend.length > 1 && <Legend items={legend} className="mt-3" />}
      <div className="mt-3">
        {view === "chart" || !table ? children : <div className="max-h-[340px] overflow-auto rounded-lg border border-hairline">{table}</div>}
      </div>
    </section>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
}

export function DataTable<T>({ columns, rows, caption }: { columns: Column<T>[]; rows: T[]; caption?: string }) {
  return (
    <table className="w-full border-collapse text-[0.8125rem]">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead className="sticky top-0 z-10 bg-surface">
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                "border-b border-hairline px-3 py-2 text-xs font-medium whitespace-nowrap text-ink-3",
                c.align === "left" ? "text-left" : "text-right",
              )}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="transition-colors hover:bg-muted/60">
            {columns.map((c) => (
              <td
                key={c.key}
                className={cn(
                  "border-b border-hairline/70 px-3 py-1.5 whitespace-nowrap tabular",
                  c.align === "left" ? "text-left text-ink-2" : "text-right",
                )}
              >
                {c.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SimHeader({
  index,
  kicker,
  title,
  children,
  actions,
}: {
  index: string;
  kicker: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="grain relative overflow-hidden border-b border-hairline">
      <div className="bg-graph pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
      <div className="relative mx-auto flex max-w-[1320px] flex-col gap-6 px-4 pt-10 pb-8 sm:px-6 md:flex-row md:items-end md:justify-between md:pt-14">
        <div className="max-w-2xl animate-rise">
          <p className="eyebrow">
            Simulator {index} <span className="mx-1.5 text-hairline">/</span> {kicker}
          </p>
          <h1 className="mt-3 font-heading text-[2.5rem] leading-[1.02] font-normal tracking-[-0.02em] sm:text-[3.4rem]">{title}</h1>
          {children && <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ink-2">{children}</p>}
        </div>
        {actions && <div className="no-print flex flex-wrap gap-2 [animation-delay:120ms] animate-rise">{actions}</div>}
      </div>
    </div>
  );
}

const actionClass =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-surface px-3 text-[0.8125rem] font-medium text-foreground transition-colors hover:border-foreground";

export function ShareButton() {
  return (
    <button
      type="button"
      className={actionClass}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast.success("Link copied — it opens this exact scenario.");
        } catch {
          toast.error("Couldn't copy. Copy the address bar instead.");
        }
      }}
    >
      <LinkIcon className="size-3.5" aria-hidden />
      Share link
    </button>
  );
}

export function CsvButton({ onExport }: { onExport: () => void }) {
  return (
    <button type="button" className={actionClass} onClick={onExport}>
      <DownloadIcon className="size-3.5" aria-hidden />
      CSV
    </button>
  );
}

export function PrintButton() {
  return (
    <button type="button" className={actionClass} onClick={() => window.print()}>
      <PrinterIcon className="size-3.5" aria-hidden />
      PDF report
    </button>
  );
}

export function SimLayout({ controls, children }: { controls: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-[1320px] gap-6 px-4 pt-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
      <aside className="no-print lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-1 [scrollbar-width:thin]">
        <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5">{controls}</div>
      </aside>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
