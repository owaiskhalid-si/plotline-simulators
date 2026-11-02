export type FieldFormat = "currency" | "percent" | "number" | "months" | "years";

export interface FieldSpec<K extends string = string> {
  key: K;
  label: string;
  help?: string;
  min: number;
  max: number;
  step: number;
  format: FieldFormat;
  /** Values the text box accepts beyond the slider range. */
  hardMax?: number;
  hardMin?: number;
  /** Log sliders give equal travel to $10→$100 and $10k→$100k. */
  scale?: "linear" | "log";
}

/**
 * Merge untrusted values (e.g. decoded from a share link) onto defaults,
 * keeping only known numeric keys and clamping them to sane bounds.
 */
export function sanitize<T extends object>(
  defaults: T,
  specs: readonly FieldSpec[],
  raw: unknown,
): T {
  const base = defaults as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  if (!raw || typeof raw !== "object") return out as T;
  const src = raw as Record<string, unknown>;
  for (const key of Object.keys(base)) {
    const incoming = src[key];
    const fallback = base[key];
    if (typeof fallback === "number") {
      if (typeof incoming !== "number" || !Number.isFinite(incoming)) continue;
      const spec = specs.find((s) => s.key === key);
      out[key] = spec ? clamp(incoming, spec.hardMin ?? spec.min, spec.hardMax ?? spec.max) : incoming;
    } else if (typeof fallback === "boolean" && typeof incoming === "boolean") {
      out[key] = incoming;
    } else if (typeof fallback === "string" && typeof incoming === "string") {
      out[key] = incoming.slice(0, 40);
    }
  }
  return out as T;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Round to three significant figures — keeps log-slider values tidy (18,543 → 18,500). */
export function roundSignificant(v: number, digits = 3): number {
  if (v === 0 || !Number.isFinite(v)) return v;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - digits + 1);
  return Math.round(v / mag) * mag;
}
