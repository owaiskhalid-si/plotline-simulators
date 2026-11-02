import { describe, expect, it } from "vitest";
import { DEFAULT_RUNWAY, monteCarlo, projectMonths, summarize, type RunwayInputs } from "./runway";
import { createRng, percentileSorted } from "./random";

const flat: RunwayInputs = {
  startingCash: 100_000,
  startingCustomers: 0,
  arpu: 100,
  churnRate: 0,
  organicGrowth: 0,
  marketingSpend: 0,
  marketingGrowth: 0,
  cac: 100,
  grossMargin: 80,
  fixedCosts: 10_000,
  fixedCostGrowth: 0,
  fundingAmount: 0,
  fundingMonth: 0,
  horizon: 24,
};

describe("random", () => {
  it("is deterministic for a seed", () => {
    const a = createRng(7);
    const b = createRng(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("interpolates percentiles", () => {
    expect(percentileSorted([0, 10], 0.5)).toBe(5);
    expect(percentileSorted([1, 2, 3, 4, 5], 0.9)).toBeCloseTo(4.6);
  });
});

describe("projectMonths", () => {
  it("burns fixed costs linearly with no revenue", () => {
    const months = projectMonths(flat);
    expect(months).toHaveLength(24);
    expect(months[0].cash).toBe(90_000);
    expect(months[9].cash).toBe(0);
    expect(months[10].cash).toBe(-10_000);
  });

  it("converts marketing spend into customers at CAC", () => {
    const months = projectMonths({ ...flat, marketingSpend: 1_000, cac: 100 });
    expect(months[0].customers).toBe(10);
    expect(months[0].mrr).toBe(1_000);
  });

  it("applies churn to the existing base", () => {
    const months = projectMonths({ ...flat, startingCustomers: 100, churnRate: 10 });
    expect(months[0].customers).toBeCloseTo(90);
    expect(months[1].customers).toBeCloseTo(81);
  });

  it("adds funding in the chosen month", () => {
    const months = projectMonths({ ...flat, fundingAmount: 50_000, fundingMonth: 3 });
    expect(months[2].funding).toBe(50_000);
    expect(months[2].cash).toBe(120_000);
  });
});

describe("summarize", () => {
  it("finds the cash-out month and fractional runway", () => {
    const s = summarize({ ...flat, startingCash: 105_000 });
    expect(s.cashOutMonth).toBe(11);
    expect(s.runwayMonths).toBeCloseTo(10.5);
    expect(s.breakEvenMonth).toBeNull();
  });

  it("reports unit economics", () => {
    const s = summarize({ ...flat, churnRate: 2, cac: 400 });
    expect(s.ltv).toBeCloseTo(4_000); // 100 × 0.8 / 0.02
    expect(s.ltvToCac).toBeCloseTo(10);
    expect(s.cacPaybackMonths).toBeCloseTo(5);
  });

  it("detects break-even for a profitable business", () => {
    const s = summarize({ ...flat, startingCustomers: 200 });
    expect(s.breakEvenMonth).toBe(1);
    expect(s.cashOutMonth).toBeNull();
  });
});

describe("monteCarlo", () => {
  it("collapses to the deterministic path with zero uncertainty", () => {
    const mc = monteCarlo(DEFAULT_RUNWAY, { runs: 50, uncertainty: 0 });
    const det = projectMonths(DEFAULT_RUNWAY);
    mc.bands.forEach((b, i) => {
      expect(b.p10).toBeCloseTo(det[i].cash, 6);
      expect(b.p90).toBeCloseTo(det[i].cash, 6);
    });
  });

  it("keeps percentiles ordered and survival non-increasing", () => {
    const mc = monteCarlo(DEFAULT_RUNWAY, { runs: 400, uncertainty: 0.3, seed: 1 });
    let prevSurvival = 1;
    for (const b of mc.bands) {
      expect(b.p10).toBeLessThanOrEqual(b.p25);
      expect(b.p25).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p75);
      expect(b.p75).toBeLessThanOrEqual(b.p90);
      expect(b.survival).toBeLessThanOrEqual(prevSurvival);
      prevSurvival = b.survival;
    }
    expect(mc.cashOutProbability).toBeCloseTo(1 - mc.bands[mc.bands.length - 1].survival);
  });

  it("is reproducible for a seed", () => {
    const a = monteCarlo(DEFAULT_RUNWAY, { runs: 100, seed: 9 });
    const b = monteCarlo(DEFAULT_RUNWAY, { runs: 100, seed: 9 });
    expect(a).toEqual(b);
  });
});
