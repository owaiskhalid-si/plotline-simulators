import { describe, expect, it } from "vitest";
import {
  cvpSeries,
  DEFAULT_BREAK_EVEN,
  optimalPrice,
  profitAtPrice,
  profitGrid,
  summarizeBreakEven,
} from "./break-even";

describe("summarizeBreakEven", () => {
  it("computes break-even units and revenue", () => {
    const s = summarizeBreakEven({ price: 10, variableCost: 4, fixedCosts: 6_000, volume: 1_500, elasticity: 1.5 });
    expect(s.contribution).toBe(6);
    expect(s.contributionRatio).toBeCloseTo(0.6);
    expect(s.breakEvenUnits).toBe(1_000);
    expect(s.breakEvenRevenue).toBe(10_000);
    expect(s.profit).toBe(3_000);
    expect(s.marginOfSafety).toBeCloseTo(1 / 3);
    expect(s.operatingLeverage).toBeCloseTo(3);
  });

  it("never breaks even when price is below variable cost", () => {
    const s = summarizeBreakEven({ ...DEFAULT_BREAK_EVEN, price: 2, variableCost: 3 });
    expect(s.breakEvenUnits).toBe(Infinity);
  });
});

describe("pricing", () => {
  it("finds the profit-maximising price for elastic demand", () => {
    const p = optimalPrice(DEFAULT_BREAK_EVEN)!;
    expect(p).toBeCloseTo((DEFAULT_BREAK_EVEN.variableCost * 1.4) / 0.4);
    const best = profitAtPrice(DEFAULT_BREAK_EVEN, p);
    expect(best).toBeGreaterThan(profitAtPrice(DEFAULT_BREAK_EVEN, p * 0.97));
    expect(best).toBeGreaterThan(profitAtPrice(DEFAULT_BREAK_EVEN, p * 1.03));
  });

  it("has no interior optimum for inelastic demand", () => {
    expect(optimalPrice({ ...DEFAULT_BREAK_EVEN, elasticity: 0.8 })).toBeNull();
  });

  it("anchors demand at today's price and volume", () => {
    expect(profitAtPrice(DEFAULT_BREAK_EVEN, DEFAULT_BREAK_EVEN.price)).toBeCloseTo(
      summarizeBreakEven(DEFAULT_BREAK_EVEN).profit,
    );
  });
});

describe("series", () => {
  it("crosses revenue and cost at break-even", () => {
    const pts = cvpSeries(DEFAULT_BREAK_EVEN);
    expect(pts[0].revenue).toBe(0);
    expect(pts[0].totalCost).toBe(DEFAULT_BREAK_EVEN.fixedCosts);
    expect(pts[pts.length - 1].revenue).toBeGreaterThan(pts[pts.length - 1].totalCost);
  });

  it("builds a full price × volume grid", () => {
    const g = profitGrid(DEFAULT_BREAK_EVEN);
    expect(g.cells).toHaveLength(81);
    expect(g.prices[4]).toBeCloseTo(DEFAULT_BREAK_EVEN.price);
  });
});
