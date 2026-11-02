"use client";

import { useId, useState } from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import { clamp, roundSignificant, type FieldSpec } from "@/lib/sim/fields";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const grouping = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 });

function affixes(format: FieldSpec["format"]): { prefix?: string; suffix?: string } {
  switch (format) {
    case "currency":
      return { prefix: "$" };
    case "percent":
      return { suffix: "%" };
    case "months":
      return { suffix: "mo" };
    case "years":
      return { suffix: "yr" };
    default:
      return {};
  }
}

export function HelpTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="grid size-4 place-items-center rounded-full border border-input font-mono text-[0.5625rem] leading-none text-ink-3 transition-colors hover:border-foreground hover:text-foreground"
          aria-label="More info"
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

interface NumberBoxProps {
  id: string;
  spec: FieldSpec;
  value: number;
  onCommit: (v: number) => void;
  disabled?: boolean;
}

/** Inline editable value: shows grouped digits, edits as a plain number. */
function NumberBox({ id, spec, value, onCommit, disabled }: NumberBoxProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const { prefix, suffix } = affixes(spec.format);
  const display = draft ?? grouping.format(value);

  const commit = () => {
    if (draft === null) return;
    const n = Number.parseFloat(draft.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n)) {
      const stepped = spec.step >= 1 ? Math.round(n) : n;
      onCommit(clamp(stepped, spec.hardMin ?? spec.min, spec.hardMax ?? spec.max));
    }
    setDraft(null);
  };

  return (
    <div
      className={cn(
        "flex h-7 items-center rounded-md border border-transparent px-1.5 transition-colors",
        "hover:border-input focus-within:border-foreground focus-within:bg-surface",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {prefix && <span className="text-sm text-ink-3">{prefix}</span>}
      <input
        id={id}
        value={display}
        disabled={disabled}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        onFocus={(e) => {
          setDraft(String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        style={{ width: `${Math.max(2, display.length) + 0.4}ch` }}
        className="min-w-0 bg-transparent text-right text-sm font-medium tabular outline-none"
      />
      {suffix && <span className="ml-0.5 text-sm text-ink-3">{suffix}</span>}
    </div>
  );
}

interface SliderFieldProps {
  spec: FieldSpec;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** Overrides the label from the spec. */
  label?: string;
  note?: React.ReactNode;
}

const LOG_STEPS = 1000;

function toPosition(spec: FieldSpec, v: number): number {
  if (spec.scale !== "log") return clamp(v, spec.min, spec.max);
  const t = Math.log(clamp(v, spec.min, spec.max) / spec.min) / Math.log(spec.max / spec.min);
  return Math.round(t * LOG_STEPS);
}

function fromPosition(spec: FieldSpec, pos: number): number {
  if (spec.scale !== "log") return pos;
  const raw = spec.min * Math.pow(spec.max / spec.min, pos / LOG_STEPS);
  const nice = roundSignificant(raw, raw < 10 ? 2 : 3);
  return spec.step >= 1 ? Math.round(nice) : Math.round(nice / spec.step) * spec.step;
}

export function SliderField({ spec, value, onChange, disabled, label, note }: SliderFieldProps) {
  const id = useId();
  const log = spec.scale === "log";
  return (
    <div className={cn("py-2.5", disabled && "opacity-55")}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-ink-2">
          <span className="truncate">{label ?? spec.label}</span>
          {spec.help && <HelpTip text={spec.help} />}
        </label>
        <NumberBox id={id} spec={spec} value={value} onCommit={onChange} disabled={disabled} />
      </div>
      <SliderPrimitive.Root
        value={[toPosition(spec, value)]}
        onValueChange={([pos]) => onChange(fromPosition(spec, pos))}
        min={log ? 0 : spec.min}
        max={log ? LOG_STEPS : spec.max}
        step={log ? 1 : spec.step}
        disabled={disabled}
        aria-label={label ?? spec.label}
        className="relative mt-2 flex h-4 w-full touch-none items-center select-none"
      >
        <SliderPrimitive.Track className="relative h-[3px] grow overflow-hidden rounded-full bg-hairline">
          <SliderPrimitive.Range className="absolute h-full bg-foreground" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-4 rounded-full border-2 border-foreground bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.15)] transition-transform hover:scale-110 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none active:scale-110" />
      </SliderPrimitive.Root>
      {note && <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{note}</p>}
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  onChange: (v: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, ariaLabel, size = "md", className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-lg bg-muted p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-md font-medium whitespace-nowrap transition-all",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[0.8125rem]",
              active ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ControlGroup({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn("border-t border-hairline pt-4 first:border-t-0 first:pt-0", className)}>
      <legend className="eyebrow float-left mb-1 w-full">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}
