import { describe, expect, it } from "vitest";
import { annualizeMonthly, effectiveAnnualRate, irrMonthly, npv } from "@/lib/finance/effectiveRate";

const annuityFlows = (p: number, rMonthly: number, n: number, cashIn = p) => {
  const pay = (p * rMonthly) / (1 - Math.pow(1 + rMonthly, -n));
  return [cashIn, ...Array<number>(n).fill(-pay)];
};

describe("irr", () => {
  it("recovers the monthly rate of an annuity", () => {
    const irr = irrMonthly(annuityFlows(1_000_000, 0.02, 12)) as number;
    expect(irr).toBeCloseTo(0.02, 8);
    expect(annualizeMonthly(irr)).toBeCloseTo(26.8242, 3);
  });
  it("npv is zero at the irr", () => {
    const f = annuityFlows(500_000, 0.015, 24);
    expect(Math.abs(npv(f, irrMonthly(f) as number))).toBeLessThan(1e-3);
  });
  it("fee deducted at issue: 970 000 received → ≈34,48%", () => {
    const f = annuityFlows(1_000_000, 0.02, 12, 970_000);
    expect(effectiveAnnualRate(f) as number).toBeCloseTo(34.48, 1);
  });
  it("very expensive microloan: bisection expands the bracket", () => {
    const irr = irrMonthly([100, -1000]) as number;
    expect(irr).toBeCloseTo(9, 6);
  });
  it("zero or negative cost → 0%", () => {
    expect(irrMonthly([100, -50, -50])).toBe(0);
    expect(irrMonthly([100, -60, -60])).toBeGreaterThan(0);
    expect(irrMonthly([100, -30, -30])).toBe(0);
  });
  it("invalid flows → null", () => {
    expect(irrMonthly([])).toBeNull();
    expect(irrMonthly([100])).toBeNull();
    expect(irrMonthly([-100, -50])).toBeNull();
    expect(irrMonthly([100, 50, 50])).toBeNull();
    expect(effectiveAnnualRate([0, -1])).toBeNull();
  });
  it("unsolvable extreme flows → null", () => {
    expect(irrMonthly([1e-300, -1e300])).toBeNull();
  });
});
