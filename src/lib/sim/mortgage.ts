import type { FieldSpec } from "./fields";

/**
 * Canadian mortgage qualification rules. Values reflect the federal rules in
 * force since December 15, 2024 (OSFI B-20 stress test, CMHC insurance).
 * Lenders can be stricter — this is an educational estimate, not advice.
 */
export const CA_RULES = {
  asOf: "December 15, 2024",
  /** Minimum qualifying rate floor, %. */
  stressTestFloor: 5.25,
  /** Buffer added to the contract rate for the stress test, percentage points. */
  stressTestBuffer: 2,
  /** Gross debt service limit (CMHC insured), %. */
  gdsLimit: 39,
  /** Total debt service limit (CMHC insured), %. */
  tdsLimit: 44,
  /** Homes at or above this price cannot be insured, so need 20% down. */
  insuredPriceCap: 1_500_000,
  /** Share of condo fees counted in GDS/TDS. */
  condoFeeShare: 0.5,
  /** Extra premium (percentage points) for a 30-year insured amortization. */
  thirtyYearSurcharge: 0.2,
} as const;

/** CMHC premium as % of the loan, by loan-to-value. */
const CMHC_TIERS: ReadonlyArray<[maxLtv: number, premiumPct: number]> = [
  [0.65, 0.6],
  [0.75, 1.7],
  [0.8, 2.4],
  [0.85, 2.8],
  [0.9, 3.1],
  [0.95, 4.0],
];

export interface MortgageInputs {
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
  /** Contract interest rate, % per year. */
  rate: number;
  amortizationYears: number;
  /** First-time buyers (and new builds) may amortize insured mortgages over 30 years. */
  firstTimeBuyer: boolean;
  /** Property tax, % of the home price per year. */
  propertyTaxRate: number;
  heatingMonthly: number;
  condoFeesMonthly: number;
  /** false = "what can I afford?", true = "can I afford this specific home?" */
  evaluateHome: boolean;
  homePrice: number;
}

export type MortgageKey = keyof MortgageInputs;

export const MORTGAGE_FIELDS: readonly FieldSpec<MortgageKey>[] = [
  { key: "annualIncome", label: "Household income / yr", help: "Gross (pre-tax) income of everyone on the mortgage.", min: 20_000, max: 500_000, step: 1_000, hardMax: 5_000_000, format: "currency" },
  { key: "monthlyDebts", label: "Other debt payments / mo", help: "Car loans, student loans, and 3% of credit card and line-of-credit balances.", min: 0, max: 5_000, step: 25, hardMax: 100_000, format: "currency" },
  { key: "downPayment", label: "Down payment", min: 0, max: 800_000, step: 5_000, hardMax: 20_000_000, format: "currency" },
  { key: "rate", label: "Mortgage rate", help: "The contract rate you were offered (e.g. a 5-year fixed).", min: 1, max: 10, step: 0.01, format: "percent" },
  { key: "amortizationYears", label: "Amortization", min: 25, max: 30, step: 5, format: "years" },
  { key: "propertyTaxRate", label: "Property tax / yr", help: "As a % of the purchase price. Most Canadian cities fall between 0.4% and 1.4%.", min: 0, max: 2.5, step: 0.05, format: "percent" },
  { key: "heatingMonthly", label: "Heating / mo", min: 0, max: 500, step: 10, format: "currency" },
  { key: "condoFeesMonthly", label: "Condo fees / mo", help: "Lenders count 50% of condo fees.", min: 0, max: 1_500, step: 25, hardMax: 10_000, format: "currency" },
  { key: "homePrice", label: "Home price", min: 100_000, max: 2_500_000, step: 5_000, hardMax: 50_000_000, format: "currency" },
];

export const DEFAULT_MORTGAGE: MortgageInputs = {
  annualIncome: 145_000,
  monthlyDebts: 450,
  downPayment: 80_000,
  rate: 4.39,
  amortizationYears: 25,
  firstTimeBuyer: true,
  propertyTaxRate: 0.75,
  heatingMonthly: 120,
  condoFeesMonthly: 0,
  evaluateHome: false,
  homePrice: 699_000,
};

/**
 * Canadian fixed-rate mortgages compound semi-annually, not monthly.
 * Converts a nominal annual rate into the equivalent rate per payment period.
 */
export function periodicRate(annualPct: number, periodsPerYear: number): number {
  return Math.pow(1 + annualPct / 100 / 2, 2 / periodsPerYear) - 1;
}

export function payment(principal: number, annualPct: number, years: number, periodsPerYear = 12): number {
  if (principal <= 0) return 0;
  const n = years * periodsPerYear;
  const i = periodicRate(annualPct, periodsPerYear);
  if (i === 0) return principal / n;
  return (principal * i) / (1 - Math.pow(1 + i, -n));
}

export function minimumDownPayment(price: number): number {
  if (price <= 0) return 0;
  if (price >= CA_RULES.insuredPriceCap) return price * 0.2;
  if (price <= 500_000) return price * 0.05;
  return 25_000 + (price - 500_000) * 0.1;
}

export function cmhcPremiumPct(ltv: number): number {
  for (const [maxLtv, pct] of CMHC_TIERS) if (ltv <= maxLtv + 1e-9) return pct;
  return NaN; // above 95% LTV is not insurable
}

export function qualifyingRate(contractPct: number): number {
  return Math.max(contractPct + CA_RULES.stressTestBuffer, CA_RULES.stressTestFloor);
}

export type Constraint = "downPayment" | "gds" | "tds";

export interface HomeEvaluation {
  price: number;
  downPayment: number;
  minDownPayment: number;
  insured: boolean;
  premiumPct: number;
  premium: number;
  loan: number;
  amortizationYears: number;
  /** True when a 30-year term was requested but the buyer is not eligible for it. */
  amortizationCapped: boolean;
  qualifyingRate: number;
  paymentContract: number;
  paymentQualifying: number;
  propertyTaxMonthly: number;
  /** Housing costs counted by lenders at the qualifying rate. */
  housingCostQualifying: number;
  /** What you will actually pay each month at the contract rate. */
  housingCostActual: number;
  gds: number;
  tds: number;
  failures: Constraint[];
  qualifies: boolean;
}

export function evaluateHome(price: number, inputs: MortgageInputs): HomeEvaluation {
  const down = Math.min(inputs.downPayment, price);
  const minDown = minimumDownPayment(price);
  const baseLoan = Math.max(0, price - down);
  const insured = price > 0 && down / price < 0.2 && price < CA_RULES.insuredPriceCap;

  const wants30 = inputs.amortizationYears >= 30;
  const amortizationCapped = wants30 && insured && !inputs.firstTimeBuyer;
  const amortizationYears = amortizationCapped ? 25 : wants30 ? 30 : 25;

  let premiumPct = 0;
  if (insured && baseLoan > 0) {
    const tier = cmhcPremiumPct(baseLoan / price);
    premiumPct = Number.isNaN(tier) ? 0 : tier + (amortizationYears === 30 ? CA_RULES.thirtyYearSurcharge : 0);
  }
  const premium = (baseLoan * premiumPct) / 100;
  const loan = baseLoan + premium;

  const qRate = qualifyingRate(inputs.rate);
  const paymentContract = payment(loan, inputs.rate, amortizationYears);
  const paymentQualifying = payment(loan, qRate, amortizationYears);

  const propertyTaxMonthly = (price * inputs.propertyTaxRate) / 100 / 12;
  const carrying = propertyTaxMonthly + inputs.heatingMonthly + inputs.condoFeesMonthly * CA_RULES.condoFeeShare;
  const housingCostQualifying = paymentQualifying + carrying;
  const housingCostActual = paymentContract + propertyTaxMonthly + inputs.heatingMonthly + inputs.condoFeesMonthly;

  const monthlyIncome = inputs.annualIncome / 12;
  const gds = monthlyIncome > 0 ? (housingCostQualifying / monthlyIncome) * 100 : Infinity;
  const tds = monthlyIncome > 0 ? ((housingCostQualifying + inputs.monthlyDebts) / monthlyIncome) * 100 : Infinity;

  const failures: Constraint[] = [];
  if (down + 0.5 < minDown) failures.push("downPayment");
  if (gds > CA_RULES.gdsLimit) failures.push("gds");
  if (tds > CA_RULES.tdsLimit) failures.push("tds");

  return {
    price,
    downPayment: down,
    minDownPayment: minDown,
    insured,
    premiumPct,
    premium,
    loan,
    amortizationYears,
    amortizationCapped,
    qualifyingRate: qRate,
    paymentContract,
    paymentQualifying,
    propertyTaxMonthly,
    housingCostQualifying,
    housingCostActual,
    gds,
    tds,
    failures,
    qualifies: failures.length === 0,
  };
}

export interface Affordability {
  maxPrice: number;
  evaluation: HomeEvaluation;
  /** The rule that stops you from buying a more expensive home. */
  bindingConstraint: Constraint | null;
}

/** Highest price that passes the down payment rule and both debt-service ratios. */
export function maxAffordable(inputs: MortgageInputs): Affordability {
  let lo = 0;
  let hi = 50_000_000;
  if (!evaluateHome(hi, inputs).qualifies) {
    for (let i = 0; i < 60 && hi - lo > 50; i++) {
      const mid = (lo + hi) / 2;
      if (evaluateHome(mid, inputs).qualifies) lo = mid;
      else hi = mid;
    }
  } else {
    lo = hi;
  }
  const maxPrice = Math.floor(lo / 100) * 100;
  const above = evaluateHome(maxPrice + 1_000, inputs);
  return {
    maxPrice,
    evaluation: evaluateHome(maxPrice, inputs),
    bindingConstraint: above.failures[0] ?? null,
  };
}

export interface AmortizationYear {
  year: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface AmortizationSchedule {
  payment: number;
  periodsPerYear: number;
  payoffYears: number;
  totalInterest: number;
  years: AmortizationYear[];
}

/**
 * Amortization for monthly payments or accelerated bi-weekly payments
 * (half the monthly payment, 26 times a year — one extra monthly payment per year).
 */
export function amortize(
  loan: number,
  annualPct: number,
  years: number,
  frequency: "monthly" | "accelerated-biweekly" = "monthly",
): AmortizationSchedule {
  const monthly = payment(loan, annualPct, years, 12);
  const ppy = frequency === "monthly" ? 12 : 26;
  const pay = frequency === "monthly" ? monthly : monthly / 2;
  const i = periodicRate(annualPct, ppy);

  const rows: AmortizationYear[] = [];
  let balance = loan;
  let totalInterest = 0;
  let period = 0;
  let yearInterest = 0;
  let yearPrincipal = 0;
  const maxPeriods = years * ppy + ppy; // guard

  while (balance > 0.005 && period < maxPeriods) {
    period++;
    const interest = balance * i;
    const principal = Math.min(pay - interest, balance);
    balance -= principal;
    totalInterest += interest;
    yearInterest += interest;
    yearPrincipal += principal;
    if (period % ppy === 0 || balance <= 0.005) {
      rows.push({ year: Math.ceil(period / ppy), interest: yearInterest, principal: yearPrincipal, balance: Math.max(0, balance) });
      yearInterest = 0;
      yearPrincipal = 0;
    }
  }

  return { payment: pay, periodsPerYear: ppy, payoffYears: period / ppy, totalInterest, years: rows };
}

/** Balance left after `afterYears` of monthly payments. */
export function balanceAfter(loan: number, annualPct: number, years: number, afterYears: number): number {
  const pay = payment(loan, annualPct, years, 12);
  const i = periodicRate(annualPct, 12);
  const n = afterYears * 12;
  const growth = Math.pow(1 + i, n);
  return Math.max(0, loan * growth - (i === 0 ? pay * n : (pay * (growth - 1)) / i));
}

export interface RenewalScenario {
  rate: number;
  delta: number;
  payment: number;
  change: number;
}

/** Monthly payment at renewal after a 5-year term if rates move by each delta. */
export function renewalShock(
  loan: number,
  annualPct: number,
  years: number,
  termYears = 5,
  deltas: readonly number[] = [-1, 0, 1, 2, 3],
): RenewalScenario[] {
  const current = payment(loan, annualPct, years);
  const remaining = balanceAfter(loan, annualPct, years, termYears);
  const remainingYears = years - termYears;
  return deltas.map((delta) => {
    const rate = Math.max(0.5, annualPct + delta);
    const p = payment(remaining, rate, remainingYears);
    return { rate, delta, payment: p, change: p - current };
  });
}
