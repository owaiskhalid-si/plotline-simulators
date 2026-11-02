import { describe, expect, it } from "vitest";
import { buildBriefing, isSimulatorId } from "./facts";
import { briefingToPrompt, parseAnalysis } from "./gemini";

describe("AI analyst briefing", () => {
  it("recognises only the three simulators", () => {
    expect(isSimulatorId("runway")).toBe(true);
    expect(isSimulatorId("break-even")).toBe(true);
    expect(isSimulatorId("roulette")).toBe(false);
    expect(isSimulatorId(42)).toBe(false);
  });

  it("re-runs the runway engine from sanitised inputs", () => {
    const b = buildBriefing("runway", { startingCash: 500_000, churnRate: 9_999, bogus: "ignored", uncertainty: 0.35 });
    expect(b.inputs).toContain("Cash in the bank: $500,000");
    // Out-of-range values are clamped to the field's bounds, unknown keys dropped.
    expect(b.inputs).toContain("Monthly churn: 15%");
    expect(b.inputs.join("\n")).not.toMatch(/bogus/);
    const text = b.results.join("\n");
    expect(text).toMatch(/^Runway: /m);
    expect(text).toMatch(/Monte Carlo \(1,000 runs, drivers varied ±35%\)/);
    expect(text).toMatch(/LTV:CAC = /);
  });

  it("reports the stress-test rate and debt-service ratios for a mortgage", () => {
    const b = buildBriefing("mortgage", { rate: 4.39, evaluateHome: true, homePrice: 699_000 });
    const text = b.results.join("\n");
    expect(text).toMatch(/Stress test: must qualify at 6\.39%/);
    expect(text).toMatch(/GDS\): \d+\.\d% of income vs 39% limit/);
    expect(text).toMatch(/The \$699,000 home (qualifies|does NOT qualify)/);
    expect(b.inputs[0]).toMatch(/specific home priced at \$699,000/);
  });

  it("describes break-even and the optimal price", () => {
    const b = buildBriefing("break-even", { price: 6.5, variableCost: 2.1, fixedCosts: 18_500, volume: 5_200, elasticity: 1.4 });
    const text = b.results.join("\n");
    expect(text).toMatch(/Break-even: 4,205 units a month/);
    expect(text).toMatch(/Profit-maximising price/);
  });

  it("turns a briefing into a prompt with both sections", () => {
    const p = briefingToPrompt({ title: "T", inputs: ["a: 1"], results: ["r: 2"] });
    expect(p).toBe("Simulator: T\n\nInputs:\n- a: 1\n\nComputed results:\n- r: 2");
  });

  it("validates and trims the model's answer", () => {
    expect(() => parseAnalysis({})).toThrow();
    expect(() => parseAnalysis({ headline: "x", insights: ["only one"], risks: ["r"], recommendation: "y" })).toThrow();
    const a = parseAnalysis({ headline: "  Tight runway  ", insights: ["a", "b", "c", "d", "e"], risks: ["r1", "", "r2", "r3", "r4"], recommendation: "Cut CAC." });
    expect(a.headline).toBe("Tight runway");
    expect(a.insights).toHaveLength(4);
    expect(a.risks).toEqual(["r1", "r2", "r3"]);
  });
});
