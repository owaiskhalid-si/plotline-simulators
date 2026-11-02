import { createRng, percentileSorted, shock } from "./random";
import type { FieldSpec } from "./fields";

/** All rates are entered as percentages (3 = 3%) because that is how people think. */
export interface RunwayInputs {
  startingCash: number;
  startingCustomers: number;
  /** Average revenue per customer per month. */
  arpu: number;
  /** Monthly logo churn, %. */
  churnRate: number;
  /** New customers per month from referrals / organic, as % of the current base. */
  organicGrowth: number;
  /** Paid acquisition budget per month. */
  marketingSpend: number;
  /** Month-over-month growth of the marketing budget, %. */
  marketingGrowth: number;
  /** Blended cost to acquire one paid customer. */
  cac: number;
  grossMargin: number;
  /** Payroll, rent, tools — everything that is not COGS or marketing. */
  fixedCosts: number;
  fixedCostGrowth: number;
  fundingAmount: number;
  /** Month the funding lands (1-based). 0 = no raise. */
  fundingMonth: number;
  horizon: number;
}

export type RunwayKey = keyof RunwayInputs;

export const RUNWAY_FIELDS: readonly FieldSpec<RunwayKey>[] = [
  { key: "startingCash", label: "Cash in the bank", min: 5_000, max: 50_000_000, step: 1, hardMin: 0, hardMax: 500_000_000, format: "currency", scale: "log" },
  { key: "startingCustomers", label: "Paying customers today", min: 1, max: 100_000, step: 1, hardMin: 0, hardMax: 10_000_000, format: "number", scale: "log" },
  { key: "arpu", label: "Revenue per customer / mo", help: "ARPU — average monthly revenue from one paying customer.", min: 1, max: 20_000, step: 1, hardMax: 1_000_000, format: "currency", scale: "log" },
  { key: "churnRate", label: "Monthly churn", help: "Share of customers who cancel each month.", min: 0.1, max: 15, step: 0.1, format: "percent" },
  { key: "organicGrowth", label: "Organic growth / mo", help: "New customers from referrals and word of mouth, as a share of the current base.", min: 0, max: 15, step: 0.1, format: "percent" },
  { key: "marketingSpend", label: "Marketing spend / mo", min: 100, max: 5_000_000, step: 1, hardMin: 0, hardMax: 100_000_000, format: "currency", scale: "log" },
  { key: "marketingGrowth", label: "Marketing budget growth / mo", min: 0, max: 15, step: 0.5, format: "percent" },
  { key: "cac", label: "Cost to acquire a customer", help: "CAC — paid marketing spend divided by new paying customers.", min: 5, max: 50_000, step: 1, hardMax: 1_000_000, format: "currency", scale: "log" },
  { key: "grossMargin", label: "Gross margin", help: "Revenue left after hosting, payment fees and other cost of goods sold.", min: 10, max: 95, step: 1, format: "percent" },
  { key: "fixedCosts", label: "Fixed costs / mo", help: "Payroll, rent, software — everything except marketing and COGS.", min: 500, max: 10_000_000, step: 1, hardMin: 0, hardMax: 100_000_000, format: "currency", scale: "log" },
  { key: "fixedCostGrowth", label: "Fixed cost growth / mo", help: "Hiring and inflation, as month-over-month growth.", min: 0, max: 10, step: 0.5, format: "percent" },
  { key: "fundingAmount", label: "Fundraise amount", min: 0, max: 10_000_000, step: 50_000, hardMax: 500_000_000, format: "currency" },
  { key: "fundingMonth", label: "Funding lands in month", min: 0, max: 48, step: 1, format: "months" },
  { key: "horizon", label: "Forecast horizon", min: 12, max: 60, step: 6, format: "months" },
];

export const RUNWAY_PRESETS = {
  seed: {
    label: "Seed-stage SaaS",
    inputs: {
      startingCash: 1_200_000, startingCustomers: 80, arpu: 99, churnRate: 3, organicGrowth: 2,
      marketingSpend: 25_000, marketingGrowth: 3, cac: 450, grossMargin: 80, fixedCosts: 85_000,
      fixedCostGrowth: 2, fundingAmount: 0, fundingMonth: 0, horizon: 36,
    },
  },
  bootstrapped: {
    label: "Bootstrapped micro-SaaS",
    inputs: {
      startingCash: 60_000, startingCustomers: 150, arpu: 29, churnRate: 4, organicGrowth: 3,
      marketingSpend: 2_000, marketingGrowth: 2, cac: 120, grossMargin: 85, fixedCosts: 6_000,
      fixedCostGrowth: 1, fundingAmount: 0, fundingMonth: 0, horizon: 36,
    },
  },
  seriesA: {
    label: "Series A scale-up",
    inputs: {
      startingCash: 6_000_000, startingCustomers: 900, arpu: 350, churnRate: 1.5, organicGrowth: 1.5,
      marketingSpend: 180_000, marketingGrowth: 4, cac: 3_200, grossMargin: 75, fixedCosts: 420_000,
      fixedCostGrowth: 3, fundingAmount: 0, fundingMonth: 0, horizon: 36,
    },
  },
  agency: {
    label: "Agency on retainers",
    inputs: {
      startingCash: 150_000, startingCustomers: 12, arpu: 4_000, churnRate: 5, organicGrowth: 4,
      marketingSpend: 3_000, marketingGrowth: 1, cac: 6_000, grossMargin: 45, fixedCosts: 38_000,
      fixedCostGrowth: 1, fundingAmount: 0, fundingMonth: 0, horizon: 36,
    },
  },
} satisfies Record<string, { label: string; inputs: RunwayInputs }>;

export type RunwayPresetId = keyof typeof RUNWAY_PRESETS;

export const DEFAULT_RUNWAY: RunwayInputs = RUNWAY_PRESETS.seed.inputs;

export interface RunwayMonth {
  month: number;
  customers: number;
  newCustomers: number;
  churnedCustomers: number;
  mrr: number;
  grossProfit: number;
  marketing: number;
  fixed: number;
  netIncome: number;
  funding: number;
  cash: number;
}

export interface RunwaySummary {
  months: RunwayMonth[];
  /** First month the bank balance goes below zero, or null if it never does. */
  cashOutMonth: number | null;
  /** Fractional months of runway (interpolated inside the cash-out month). */
  runwayMonths: number | null;
  /** First month with non-negative net income. */
  breakEvenMonth: number | null;
  lowestCash: number;
  lowestCashMonth: number;
  endingMrr: number;
  endingCustomers: number;
  ltv: number;
  ltvToCac: number;
  cacPaybackMonths: number;
  /** Net burn ÷ net new ARR over the first 12 months. null when not burning. */
  burnMultiple: number | null;
  totalRaised: number;
}

interface Shocks {
  churn: number;
  cac: number;
  organic: number;
  arpu: number;
  /** Per-month noise on acquisition and churn. */
  monthly?: (month: number) => { acquisition: number; churn: number };
}

const NO_SHOCKS: Shocks = { churn: 1, cac: 1, organic: 1, arpu: 1 };

/** Core month-by-month projection. Pure — same inputs, same output. */
export function projectMonths(inputs: RunwayInputs, shocks: Shocks = NO_SHOCKS): RunwayMonth[] {
  const horizon = Math.max(1, Math.round(inputs.horizon));
  const churn = (inputs.churnRate / 100) * shocks.churn;
  const organic = (inputs.organicGrowth / 100) * shocks.organic;
  const cac = Math.max(1, inputs.cac * shocks.cac);
  const arpu = inputs.arpu * shocks.arpu;
  const margin = inputs.grossMargin / 100;
  const mg = inputs.marketingGrowth / 100;
  const fg = inputs.fixedCostGrowth / 100;

  const months: RunwayMonth[] = [];
  let customers = inputs.startingCustomers;
  let cash = inputs.startingCash;

  for (let m = 1; m <= horizon; m++) {
    const noise = shocks.monthly?.(m) ?? { acquisition: 1, churn: 1 };
    const marketing = inputs.marketingSpend * Math.pow(1 + mg, m - 1);
    const paidNew = (marketing / cac) * noise.acquisition;
    const organicNew = customers * organic * noise.acquisition;
    const churned = Math.min(customers, customers * churn * noise.churn);
    customers = Math.max(0, customers + paidNew + organicNew - churned);

    const mrr = customers * arpu;
    const grossProfit = mrr * margin;
    const fixed = inputs.fixedCosts * Math.pow(1 + fg, m - 1);
    const netIncome = grossProfit - marketing - fixed;
    const funding = inputs.fundingMonth === m ? inputs.fundingAmount : 0;
    cash += netIncome + funding;

    months.push({
      month: m,
      customers,
      newCustomers: paidNew + organicNew,
      churnedCustomers: churned,
      mrr,
      grossProfit,
      marketing,
      fixed,
      netIncome,
      funding,
      cash,
    });
  }
  return months;
}

export function summarize(inputs: RunwayInputs, months = projectMonths(inputs)): RunwaySummary {
  let cashOutMonth: number | null = null;
  let runwayMonths: number | null = null;
  let breakEvenMonth: number | null = null;
  let lowestCash = inputs.startingCash;
  let lowestCashMonth = 0;

  let prevCash = inputs.startingCash;
  for (const row of months) {
    if (cashOutMonth === null && row.cash < 0) {
      cashOutMonth = row.month;
      // How far into this month the balance crossed zero.
      const drop = prevCash - row.cash;
      const frac = drop > 0 ? Math.min(1, Math.max(0, prevCash / drop)) : 0;
      runwayMonths = row.month - 1 + frac;
    }
    if (breakEvenMonth === null && row.netIncome >= 0) breakEvenMonth = row.month;
    if (row.cash < lowestCash) {
      lowestCash = row.cash;
      lowestCashMonth = row.month;
    }
    prevCash = row.cash;
  }

  const margin = inputs.grossMargin / 100;
  const churn = Math.max(0.001, inputs.churnRate / 100);
  const monthlyGp = inputs.arpu * margin;
  const ltv = monthlyGp / churn;
  const last = months[months.length - 1];

  const first12 = months.slice(0, 12);
  const netBurn = -first12.reduce((s, r) => s + r.netIncome, 0);
  const endMrr12 = first12[first12.length - 1]?.mrr ?? 0;
  const netNewArr = (endMrr12 - inputs.startingCustomers * inputs.arpu) * 12;
  const burnMultiple = netBurn > 0 && netNewArr > 0 ? netBurn / netNewArr : null;

  return {
    months,
    cashOutMonth,
    runwayMonths,
    breakEvenMonth,
    lowestCash,
    lowestCashMonth,
    endingMrr: last?.mrr ?? 0,
    endingCustomers: last?.customers ?? 0,
    ltv,
    ltvToCac: inputs.cac > 0 ? ltv / inputs.cac : Infinity,
    cacPaybackMonths: monthlyGp > 0 ? inputs.cac / monthlyGp : Infinity,
    burnMultiple,
    totalRaised: inputs.fundingMonth > 0 && inputs.fundingMonth <= inputs.horizon ? inputs.fundingAmount : 0,
  };
}

export interface MonteCarloBand {
  month: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** Share of runs whose cash never went below zero up to and including this month. */
  survival: number;
}

export interface MonteCarloResult {
  runs: number;
  bands: MonteCarloBand[];
  /** Probability the company runs out of cash within the horizon. */
  cashOutProbability: number;
  /** Median runway across runs that do run out (months). */
  medianCashOutMonth: number | null;
}

export interface MonteCarloOptions {
  runs?: number;
  /** Uncertainty on the key drivers, 0.2 ≈ ±20% (one standard deviation, log scale). */
  uncertainty?: number;
  seed?: number;
}

/**
 * Re-runs the projection with the uncertain drivers (churn, CAC, organic growth,
 * price) drawn from log-normal distributions, plus month-to-month noise.
 */
export function monteCarlo(inputs: RunwayInputs, opts: MonteCarloOptions = {}): MonteCarloResult {
  const runs = opts.runs ?? 1000;
  const spread = opts.uncertainty ?? 0.2;
  const rng = createRng(opts.seed ?? 42);
  const horizon = Math.max(1, Math.round(inputs.horizon));

  const cashByMonth = Array.from({ length: horizon }, () => new Float64Array(runs));
  const aliveByMonth = new Uint32Array(horizon);
  const cashOutMonths: number[] = [];

  for (let r = 0; r < runs; r++) {
    const months = projectMonths(inputs, {
      churn: shock(rng, spread),
      cac: shock(rng, spread),
      organic: shock(rng, spread),
      arpu: shock(rng, spread * 0.5),
      monthly: () => ({ acquisition: shock(rng, spread * 0.5), churn: shock(rng, spread * 0.3) }),
    });
    let dead = false;
    for (let m = 0; m < horizon; m++) {
      const cash = months[m].cash;
      cashByMonth[m][r] = cash;
      if (!dead && cash < 0) {
        dead = true;
        cashOutMonths.push(m + 1);
      }
      if (!dead) aliveByMonth[m]++;
    }
  }

  const bands: MonteCarloBand[] = cashByMonth.map((col, m) => {
    const sorted = col.slice().sort();
    return {
      month: m + 1,
      p10: percentileSorted(sorted, 0.1),
      p25: percentileSorted(sorted, 0.25),
      p50: percentileSorted(sorted, 0.5),
      p75: percentileSorted(sorted, 0.75),
      p90: percentileSorted(sorted, 0.9),
      survival: aliveByMonth[m] / runs,
    };
  });

  cashOutMonths.sort((a, b) => a - b);
  return {
    runs,
    bands,
    cashOutProbability: cashOutMonths.length / runs,
    medianCashOutMonth: cashOutMonths.length ? percentileSorted(cashOutMonths, 0.5) : null,
  };
}
