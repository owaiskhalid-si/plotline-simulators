import { describe, expect, it } from "vitest";
import {
  amortize,
  balanceAfter,
  cmhcPremiumPct,
  DEFAULT_MORTGAGE,
  evaluateHome,
  maxAffordable,
  minimumDownPayment,
  payment,
  periodicRate,
  qualifyingRate,
  renewalShock,
} from "./mortgage";

describe("rates and payments", () => {
  it("compounds semi-annually like Canadian lenders", () => {
    expect(periodicRate(5, 12)).toBeCloseTo(Math.pow(1.025, 1 / 6) - 1, 12);
  });

  it("matches the textbook Canadian payment", () => {
    // $100,000 at 5% over 25 years, semi-annual compounding → $581.60 / month
    expect(payment(100_000, 5, 25)).toBeCloseTo(581.6, 1);
  });

  it("applies the stress test floor and buffer", () => {
    expect(qualifyingRate(4.39)).toBeCloseTo(6.39);
    expect(qualifyingRate(2.99)).toBe(5.25);
  });
});

describe("down payment and CMHC", () => {
  it("uses the tiered minimum down payment", () => {
    expect(minimumDownPayment(400_000)).toBe(20_000);
    expect(minimumDownPayment(700_000)).toBe(45_000);
    expect(minimumDownPayment(1_499_999)).toBeCloseTo(124_999.9);
    expect(minimumDownPayment(1_500_000)).toBe(300_000);
  });

  it("prices insurance by loan-to-value", () => {
    expect(cmhcPremiumPct(0.95)).toBe(4);
    expect(cmhcPremiumPct(0.9)).toBe(3.1);
    expect(cmhcPremiumPct(0.86)).toBe(3.1);
    expect(cmhcPremiumPct(0.8)).toBe(2.4);
    expect(Number.isNaN(cmhcPremiumPct(0.97))).toBe(true);
  });

  it("adds the premium to the loan for insured purchases", () => {
    const e = evaluateHome(500_000, { ...DEFAULT_MORTGAGE, downPayment: 25_000, amortizationYears: 25 });
    expect(e.insured).toBe(true);
    expect(e.premiumPct).toBe(4);
    expect(e.loan).toBeCloseTo(475_000 * 1.04);
  });

  it("does not insure 20%+ down payments", () => {
    const e = evaluateHome(500_000, { ...DEFAULT_MORTGAGE, downPayment: 100_000 });
    expect(e.insured).toBe(false);
    expect(e.premium).toBe(0);
  });

  it("caps insured amortization at 25 years for repeat buyers", () => {
    const e = evaluateHome(500_000, { ...DEFAULT_MORTGAGE, downPayment: 25_000, amortizationYears: 30, firstTimeBuyer: false });
    expect(e.amortizationCapped).toBe(true);
    expect(e.amortizationYears).toBe(25);
  });

  it("adds the 30-year surcharge for eligible first-time buyers", () => {
    const e = evaluateHome(500_000, { ...DEFAULT_MORTGAGE, downPayment: 25_000, amortizationYears: 30, firstTimeBuyer: true });
    expect(e.amortizationYears).toBe(30);
    expect(e.premiumPct).toBeCloseTo(4.2);
  });
});

describe("maxAffordable", () => {
  it("returns the highest qualifying price", () => {
    const a = maxAffordable(DEFAULT_MORTGAGE);
    expect(a.evaluation.qualifies).toBe(true);
    expect(evaluateHome(a.maxPrice + 1_000, DEFAULT_MORTGAGE).qualifies).toBe(false);
    expect(a.maxPrice).toBeGreaterThan(600_000);
    expect(a.maxPrice).toBeLessThan(800_000);
    expect(a.bindingConstraint).toBe("gds");
  });

  it("is limited by the down payment when income is high", () => {
    const a = maxAffordable({ ...DEFAULT_MORTGAGE, annualIncome: 600_000, downPayment: 40_000 });
    expect(a.bindingConstraint).toBe("downPayment");
    expect(a.maxPrice).toBeCloseTo(650_000, -3); // 25k on the first 500k + 10% of 150k
  });

  it("is limited by total debt when other debts are heavy", () => {
    const a = maxAffordable({ ...DEFAULT_MORTGAGE, monthlyDebts: 2_500 });
    expect(a.bindingConstraint).toBe("tds");
  });
});

describe("amortization", () => {
  it("pays off a monthly schedule in exactly the amortization period", () => {
    const s = amortize(400_000, 4.5, 25);
    expect(s.payoffYears).toBeCloseTo(25, 1);
    expect(s.years[s.years.length - 1].balance).toBeCloseTo(0, 2);
    expect(s.totalInterest + 400_000).toBeCloseTo(s.payment * 300, 0);
  });

  it("pays off faster with accelerated bi-weekly payments", () => {
    const monthly = amortize(400_000, 4.5, 25);
    const biweekly = amortize(400_000, 4.5, 25, "accelerated-biweekly");
    expect(biweekly.payoffYears).toBeLessThan(23);
    expect(biweekly.totalInterest).toBeLessThan(monthly.totalInterest);
  });

  it("agrees with the closed-form balance", () => {
    const s = amortize(400_000, 4.5, 25);
    expect(balanceAfter(400_000, 4.5, 25, 5)).toBeCloseTo(s.years[4].balance, 2);
  });

  it("shows no payment change at renewal when rates are flat", () => {
    const flat = renewalShock(400_000, 4.5, 25).find((r) => r.delta === 0)!;
    expect(flat.change).toBeCloseTo(0, 6);
  });
});
