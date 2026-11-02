import type { FieldSpec } from "./fields";

export interface BreakEvenInputs {
  price: number;
  variableCost: number;
  fixedCosts: number;
  /** Units you expect to sell per month at the current price. */
  volume: number;
  /** Price elasticity of demand: % drop in volume for a 1% price increase. */
  elasticity: number;
}

export type BreakEvenKey = keyof BreakEvenInputs;

export const BREAK_EVEN_FIELDS: readonly FieldSpec<BreakEvenKey>[] = [
  { key: "price", label: "Selling price / unit", min: 0.5, max: 2_000, step: 0.05, hardMin: 0.01, hardMax: 1_000_000, format: "currency", scale: "log" },
  { key: "variableCost", label: "Variable cost / unit", help: "Materials, packaging, payment fees, delivery — anything that scales with each sale.", min: 0.1, max: 1_500, step: 0.05, hardMin: 0, hardMax: 1_000_000, format: "currency", scale: "log" },
  { key: "fixedCosts", label: "Fixed costs / mo", help: "Rent, salaries, insurance, software — paid whether you sell or not.", min: 100, max: 2_000_000, step: 1, hardMin: 0, hardMax: 50_000_000, format: "currency", scale: "log" },
  { key: "volume", label: "Expected sales / mo", min: 10, max: 1_000_000, step: 1, hardMin: 0, hardMax: 10_000_000, format: "number", scale: "log" },
  { key: "elasticity", label: "Price sensitivity", help: "Elasticity of demand. 1.5 means a 10% price rise loses about 15% of volume. Coffee ≈ 0.5, restaurants ≈ 1.5–2.5.", min: 0.2, max: 4, step: 0.1, format: "number" },
];

export const DEFAULT_BREAK_EVEN: BreakEvenInputs = {
  price: 6.5,
  variableCost: 2.1,
  fixedCosts: 18_500,
  volume: 5_200,
  elasticity: 1.4,
};

export interface BreakEvenSummary {
  contribution: number;
  contributionRatio: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  revenue: number;
  profit: number;
  /** How far sales can fall before you lose money, as a share of expected sales. */
  marginOfSafety: number;
  /** % change in profit for a 1% change in sales. */
  operatingLeverage: number;
  optimalPrice: number | null;
  optimalProfit: number | null;
}

export function summarizeBreakEven(inputs: BreakEvenInputs): BreakEvenSummary {
  const { price, variableCost, fixedCosts, volume } = inputs;
  const contribution = price - variableCost;
  const contributionRatio = price > 0 ? contribution / price : 0;
  const breakEvenUnits = contribution > 0 ? fixedCosts / contribution : Infinity;
  const revenue = price * volume;
  const profit = contribution * volume - fixedCosts;
  const marginOfSafety = volume > 0 && Number.isFinite(breakEvenUnits) ? (volume - breakEvenUnits) / volume : -Infinity;
  const operatingLeverage = profit !== 0 ? (contribution * volume) / profit : Infinity;
  const opt = optimalPrice(inputs);

  return {
    contribution,
    contributionRatio,
    breakEvenUnits,
    breakEvenRevenue: breakEvenUnits * price,
    revenue,
    profit,
    marginOfSafety,
    operatingLeverage,
    optimalPrice: opt,
    optimalProfit: opt === null ? null : profitAtPrice(inputs, opt),
  };
}

/** Constant-elasticity demand curve anchored at the current price and volume. */
export function demandAtPrice(inputs: BreakEvenInputs, p: number): number {
  if (p <= 0 || inputs.price <= 0) return 0;
  return inputs.volume * Math.pow(p / inputs.price, -inputs.elasticity);
}

export function profitAtPrice(inputs: BreakEvenInputs, p: number): number {
  return (p - inputs.variableCost) * demandAtPrice(inputs, p) - inputs.fixedCosts;
}

/**
 * With constant elasticity e > 1, profit peaks at p* = c · e / (e − 1) (the
 * Lerner markup rule). With e ≤ 1 demand is inelastic and there is no interior
 * optimum — raising the price always helps, until customers start to leave.
 */
export function optimalPrice(inputs: BreakEvenInputs): number | null {
  const e = inputs.elasticity;
  if (e <= 1 || inputs.variableCost <= 0) return null;
  return (inputs.variableCost * e) / (e - 1);
}

export interface CvpPoint {
  units: number;
  revenue: number;
  totalCost: number;
  fixedCost: number;
}

/** Cost–volume–profit lines from zero to comfortably past break-even. */
export function cvpSeries(inputs: BreakEvenInputs, points = 41): CvpPoint[] {
  const s = summarizeBreakEven(inputs);
  const be = Number.isFinite(s.breakEvenUnits) ? s.breakEvenUnits : inputs.volume;
  const maxUnits = niceCeil(Math.max(be * 1.6, inputs.volume * 1.25, 10));
  return Array.from({ length: points }, (_, k) => {
    const units = (maxUnits * k) / (points - 1);
    return {
      units,
      revenue: units * inputs.price,
      totalCost: inputs.fixedCosts + units * inputs.variableCost,
      fixedCost: inputs.fixedCosts,
    };
  });
}

export interface PricePoint {
  price: number;
  profit: number;
  volume: number;
}

export function priceCurve(inputs: BreakEvenInputs, points = 60): PricePoint[] {
  const opt = optimalPrice(inputs);
  const lo = Math.max(inputs.variableCost * 1.2, inputs.price * 0.5, 0.01);
  const hi = Math.max(inputs.price * 2, (opt ?? 0) * 1.3, lo * 1.5);
  return Array.from({ length: points }, (_, k) => {
    const price = lo + ((hi - lo) * k) / (points - 1);
    return { price, profit: profitAtPrice(inputs, price), volume: demandAtPrice(inputs, price) };
  });
}

export interface HeatCell {
  price: number;
  volume: number;
  profit: number;
}

/** Profit for every price × volume combination around today's plan. */
export function profitGrid(inputs: BreakEvenInputs, steps = 9): { prices: number[]; volumes: number[]; cells: HeatCell[] } {
  const span = (center: number, from: number, to: number) =>
    Array.from({ length: steps }, (_, k) => center * (from + ((to - from) * k) / (steps - 1)));
  const prices = span(inputs.price, 0.6, 1.4);
  const volumes = span(inputs.volume || 100, 0.5, 1.5);
  const cells: HeatCell[] = [];
  for (const volume of volumes) {
    for (const price of prices) {
      cells.push({ price, volume, profit: (price - inputs.variableCost) * volume - inputs.fixedCosts });
    }
  }
  return { prices, volumes, cells };
}

function niceCeil(v: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * mag;
}

export const BREAK_EVEN_PRESETS = {
  cafe: {
    label: "Neighbourhood café",
    inputs: DEFAULT_BREAK_EVEN,
  },
  skincare: {
    label: "DTC skincare brand",
    inputs: { price: 38, variableCost: 11, fixedCosts: 42_000, volume: 2_100, elasticity: 1.3 },
  },
  mealPrep: {
    label: "Meal-prep delivery",
    inputs: { price: 14, variableCost: 7.5, fixedCosts: 26_000, volume: 3_600, elasticity: 2.2 },
  },
} satisfies Record<string, { label: string; inputs: BreakEvenInputs }>;

export type BreakEvenPresetId = keyof typeof BREAK_EVEN_PRESETS;
