// Turns a simulator's inputs into a plain-text briefing for the AI analyst.
// The server re-runs the pure engines here, so the model only ever sees numbers
// the simulator itself produced — never figures supplied by the client.
import { clamp, sanitize, type FieldSpec } from "../sim/fields";
import { fmt, formatField } from "../format";
import { DEFAULT_RUNWAY, monteCarlo, RUNWAY_FIELDS, summarize, type RunwayInputs } from "../sim/runway";
import { amortize, CA_RULES, DEFAULT_MORTGAGE, evaluateHome, maxAffordable, MORTGAGE_FIELDS, renewalShock, type MortgageInputs } from "../sim/mortgage";
import { BREAK_EVEN_FIELDS, DEFAULT_BREAK_EVEN, demandAtPrice, summarizeBreakEven, type BreakEvenInputs } from "../sim/break-even";

export const SIMULATORS = ["runway", "mortgage", "break-even"] as const;
export type SimulatorId = (typeof SIMULATORS)[number];

export const isSimulatorId = (v: unknown): v is SimulatorId => typeof v === "string" && (SIMULATORS as readonly string[]).includes(v);

export interface Briefing {
  title: string;
  inputs: string[];
  results: string[];
}

const pct = (v: number, digits = 1) => (Number.isFinite(v) ? `${v.toFixed(digits)}%` : "n/a");
const num = (v: number) => (Number.isFinite(v) ? v.toLocaleString("en-CA", { maximumFractionDigits: 1 }) : "n/a");

function inputLines<K extends string>(fields: readonly FieldSpec<K>[], values: Record<K, unknown>): string[] {
  return fields.map((f) => `${f.label}: ${formatField(f.format, Number(values[f.key]))}`);
}

export function buildBriefing(simulator: SimulatorId, raw: unknown): Briefing {
  switch (simulator) {
    case "runway":
      return runwayBriefing(raw);
    case "mortgage":
      return mortgageBriefing(raw);
    case "break-even":
      return breakEvenBriefing(raw);
  }
}

// ─── Runway ──────────────────────────────────────────────────────────────────

function runwayBriefing(raw: unknown): Briefing {
  const inputs: RunwayInputs = sanitize(DEFAULT_RUNWAY, RUNWAY_FIELDS, raw);
  const u = (raw as { uncertainty?: unknown } | null)?.uncertainty;
  const uncertainty = typeof u === "number" && Number.isFinite(u) ? clamp(u, 0, 0.5) : 0.2;

  const s = summarize(inputs);
  const mc = monteCarlo(inputs, { runs: 1000, uncertainty, seed: 7 });
  const last = mc.bands[mc.bands.length - 1];

  const lines = inputLines(RUNWAY_FIELDS, inputs).map((l) => (l.startsWith("Funding lands in month: 0") ? "Fundraise: none planned" : l));

  const results = [
    s.runwayMonths !== null
      ? `Runway: cash runs out in month ${s.cashOutMonth} (${fmt.dec1(s.runwayMonths)} months from today)`
      : `Runway: cash lasts the full ${inputs.horizon}-month forecast`,
    s.breakEvenMonth !== null ? `Break-even (first month with non-negative net income): month ${s.breakEvenMonth}` : `Break-even: not reached within ${inputs.horizon} months`,
    `Lowest cash balance: ${fmt.money(s.lowestCash)}${s.lowestCashMonth ? ` in month ${s.lowestCashMonth}` : " (today)"}`,
    `Ending MRR after ${inputs.horizon} months: ${fmt.money(s.endingMrr)} (${fmt.money(s.endingMrr * 12)} ARR) with ${fmt.int(s.endingCustomers)} customers`,
    `First-month MRR: ${fmt.money(inputs.startingCustomers * inputs.arpu)}; first-month net income: ${fmt.money(s.months[0]?.netIncome ?? 0)}`,
    `Customer lifetime value (gross-margin basis): ${fmt.money(s.ltv)}; LTV:CAC = ${fmt.ratio(s.ltvToCac)}`,
    `CAC payback: ${fmt.months(s.cacPaybackMonths)}`,
    s.burnMultiple === null ? "Burn multiple: not burning cash over the first 12 months" : `Burn multiple (net burn ÷ net new ARR, first 12 months): ${fmt.ratio(s.burnMultiple)}`,
    s.totalRaised ? `Capital raised in the plan: ${fmt.money(s.totalRaised)} in month ${inputs.fundingMonth}` : "No fundraise in the plan",
    `Monte Carlo (${mc.runs.toLocaleString("en-CA")} runs, drivers varied ±${Math.round(uncertainty * 100)}%): ${Math.round(mc.cashOutProbability * 100)}% chance of running out of cash within ${inputs.horizon} months` +
      (mc.medianCashOutMonth !== null ? `; median cash-out in month ${Math.round(mc.medianCashOutMonth)}` : ""),
    last ? `Monte Carlo cash at month ${last.month}: median ${fmt.money(last.p50)}, worst 10% ${fmt.money(last.p10)}, best 10% ${fmt.money(last.p90)}` : "",
    "Benchmarks this simulator uses: LTV:CAC of 3× or better is healthy; CAC payback under 12 months is good, over 24 is slow; burn multiple ≤ 1.5 is efficient, > 2.5 is poor.",
  ].filter(Boolean);

  return { title: "Startup cash runway & unit economics (monthly projection)", inputs: lines, results };
}

// ─── Mortgage ────────────────────────────────────────────────────────────────

function mortgageBriefing(raw: unknown): Briefing {
  const s = sanitize(DEFAULT_MORTGAGE, MORTGAGE_FIELDS, raw);
  const inputs: MortgageInputs = { ...s, amortizationYears: s.amortizationYears >= 30 ? 30 : 25 };

  const afford = maxAffordable(inputs);
  const home = inputs.evaluateHome ? evaluateHome(inputs.homePrice, inputs) : afford.evaluation;
  const monthly = amortize(home.loan, inputs.rate, home.amortizationYears, "monthly");
  const biweekly = amortize(home.loan, inputs.rate, home.amortizationYears, "accelerated-biweekly");
  const renewal = renewalShock(home.loan, inputs.rate, home.amortizationYears);

  const lines = [
    inputs.evaluateHome ? `Question: can this household afford a specific home priced at ${fmt.money(inputs.homePrice)}?` : "Question: what is the maximum purchase price this household qualifies for?",
    ...inputLines(MORTGAGE_FIELDS, inputs).filter((l) => inputs.evaluateHome || !l.startsWith("Home price")),
    `First-time buyer or new build: ${inputs.firstTimeBuyer ? "yes" : "no"}`,
  ];

  const constraint = { downPayment: "the down payment", gds: "the GDS ratio", tds: "the TDS ratio" } as const;
  const downPct = home.price > 0 ? (home.downPayment / home.price) * 100 : 0;
  const results = [
    `Maximum purchase price that passes every rule: ${fmt.money(afford.maxPrice)}${afford.bindingConstraint ? ` (limited by ${constraint[afford.bindingConstraint]})` : ""}`,
    inputs.evaluateHome
      ? home.qualifies
        ? `The ${fmt.money(home.price)} home qualifies`
        : `The ${fmt.money(home.price)} home does NOT qualify — fails on ${home.failures.map((f) => constraint[f]).join(" and ")}`
      : `Scenario below is at the maximum price of ${fmt.money(home.price)}`,
    `Down payment: ${fmt.money(home.downPayment)} (${pct(downPct)} of price); minimum required: ${fmt.money(home.minDownPayment)}`,
    home.insured ? `CMHC mortgage insurance: ${pct(home.premiumPct, 2)} premium = ${fmt.money(home.premium)}, added to the loan` : "No mortgage insurance (20%+ down)",
    `Mortgage amount: ${fmt.money(home.loan)} over ${home.amortizationYears} years at ${pct(inputs.rate, 2)}${home.amortizationCapped ? " (30-year amortization not available to this buyer — capped at 25)" : ""}`,
    `Stress test: must qualify at ${pct(home.qualifyingRate, 2)} (greater of rate + ${CA_RULES.stressTestBuffer} points or ${CA_RULES.stressTestFloor}%)`,
    `Monthly payment: ${fmt.money(home.paymentContract)} actual; ${fmt.money(home.paymentQualifying)} at the stress-test rate`,
    `All-in monthly housing cost (payment + property tax + heat + half of condo fees): ${fmt.money(home.housingCostActual)}`,
    `Gross debt service (GDS): ${pct(home.gds)} of income vs ${CA_RULES.gdsLimit}% limit; total debt service (TDS): ${pct(home.tds)} vs ${CA_RULES.tdsLimit}% limit`,
    `Total interest over the amortization with monthly payments: ${fmt.money(monthly.totalInterest)}`,
    `Accelerated bi-weekly payments instead: save ${fmt.money(monthly.totalInterest - biweekly.totalInterest)} in interest and finish ${fmt.dec1(monthly.payoffYears - biweekly.payoffYears)} years sooner`,
    `Renewal shock after a 5-year term (balance then ≈ ${fmt.money(monthly.years[4]?.balance ?? 0)}): ` +
      renewal
        .filter((r) => r.delta !== 0)
        .map((r) => `at ${pct(r.rate, 2)} the payment is ${fmt.money(r.payment)} (${r.change >= 0 ? "+" : "−"}${fmt.money(Math.abs(r.change))}/mo)`)
        .join("; "),
    `Rules as of ${CA_RULES.asOf}: federal B-20 stress test, CMHC insured limits, semi-annual compounding.`,
  ];

  return { title: "Canadian mortgage affordability & stress test", inputs: lines, results };
}

// ─── Break-even ──────────────────────────────────────────────────────────────

function breakEvenBriefing(raw: unknown): Briefing {
  const inputs: BreakEvenInputs = sanitize(DEFAULT_BREAK_EVEN, BREAK_EVEN_FIELDS, raw);
  const s = summarizeBreakEven(inputs);

  const results = [
    `Contribution per unit: ${fmt.price(s.contribution)} (${pct(s.contributionRatio * 100, 0)} of the price)`,
    Number.isFinite(s.breakEvenUnits)
      ? `Break-even: ${num(Math.ceil(s.breakEvenUnits))} units a month = ${fmt.money(s.breakEvenRevenue)} in sales`
      : "Break-even: never — the price is at or below the variable cost",
    `At the planned ${num(inputs.volume)} units: revenue ${fmt.money(s.revenue)}, monthly profit ${fmt.money(s.profit)} (${fmt.money(s.profit * 12)} a year)`,
    Number.isFinite(s.marginOfSafety) ? `Margin of safety: ${pct(s.marginOfSafety * 100, 0)} — sales can fall this far before a month turns red` : "Margin of safety: n/a",
    Number.isFinite(s.operatingLeverage) && s.profit > 0 ? `Operating leverage: ${fmt.ratio(s.operatingLeverage)} — a 1% change in sales moves profit by ${s.operatingLeverage.toFixed(1)}%` : "Operating leverage: n/a (not profitable at plan)",
    s.optimalPrice !== null && s.optimalProfit !== null
      ? `Profit-maximising price from demand elasticity ${inputs.elasticity.toFixed(1)}: ${fmt.price(s.optimalPrice)} (vs ${fmt.price(inputs.price)} today) → about ${num(demandAtPrice(inputs, s.optimalPrice))} units and ${fmt.money(s.optimalProfit)} profit a month (${s.optimalProfit - s.profit >= 0 ? "+" : "−"}${fmt.money(Math.abs(s.optimalProfit - s.profit))})`
      : `Demand is inelastic (sensitivity ${inputs.elasticity.toFixed(1)} ≤ 1), so the model finds no interior optimum — higher prices keep adding profit until customers leave`,
  ];

  return { title: "Break-even & price optimizer (monthly)", inputs: inputLines(BREAK_EVEN_FIELDS, inputs), results };
}
