const money0 = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const money2 = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyCompact = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", notation: "compact", maximumFractionDigits: 1 });
const int = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 });
const monthYear = new Intl.DateTimeFormat("en-CA", { month: "short", year: "numeric" });

export const fmt = {
  money: (v: number) => (Number.isFinite(v) ? money0.format(v) : "—"),
  /** Cents only when they matter (prices under $100). */
  price: (v: number) => (Number.isFinite(v) ? (Math.abs(v) < 100 ? money2.format(v) : money0.format(v)) : "—"),
  moneyCompact: (v: number) => (Number.isFinite(v) ? moneyCompact.format(v) : "—"),
  int: (v: number) => (Number.isFinite(v) ? int.format(v) : "—"),
  dec1: (v: number) => (Number.isFinite(v) ? dec1.format(v) : "—"),
  compact: (v: number) => (Number.isFinite(v) ? compact.format(v) : "—"),
  pct: (v: number, digits = 1) => (Number.isFinite(v) ? `${v.toFixed(digits)}%` : "—"),
  ratio: (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}×` : "∞"),
  months: (v: number) => (Number.isFinite(v) ? `${dec1.format(v)} mo` : "—"),
};

/** Calendar label for "n months from `start`". */
export function monthFromNow(start: Date, offset: number): string {
  const d = new Date(start.getFullYear(), start.getMonth() + Math.round(offset), 1);
  return monthYear.format(d);
}

export function formatField(format: string, v: number): string {
  switch (format) {
    case "currency":
      return fmt.price(v);
    case "percent":
      return `${v}%`;
    case "months":
      return `${v} mo`;
    case "years":
      return `${v} yr`;
    default:
      return fmt.int(v);
  }
}
