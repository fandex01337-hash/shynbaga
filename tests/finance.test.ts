import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/finance/analyze";
import {
  annualToDaily,
  dailyToAnnual,
  formatNumber,
  formatPercent,
  formatTenge,
  fromTiyn,
  toTiyn,
} from "@/lib/finance/money";
import { earlyRepayment, latePenalty, monthsToSave } from "@/lib/finance/scenarios";
import { annuityPayment, buildSchedule, impliedAnnualRate, resolveCosts } from "@/lib/finance/schedule";
import type { Analysis } from "@/lib/finance/types";
import { loan } from "./helpers";

function ok(p = loan()): Analysis {
  const a = analyze(p);
  if (!a.ok) throw new Error(`analysis failed: ${a.error}`);
  return a;
}

describe("money", () => {
  it("converts tenge <-> tiyn without float drift", () => {
    expect(toTiyn(94559.6)).toBe(9455960);
    expect(toTiyn(0.1 + 0.2)).toBe(30);
    expect(fromTiyn(9455960)).toBe(94559.6);
  });
  it("formats", () => {
    expect(formatTenge(9455960, { decimals: true }).replace(/\s/g, " ")).toBe("94 559,60 ₸");
    expect(formatTenge(9455960).replace(/\s/g, " ")).toBe("94 560 ₸");
    expect(formatNumber(1.234, 1)).toBe("1,2");
    expect(formatPercent(26.824)).toBe("26,8%");
  });
  it("daily <-> annual: 0,3% в день = 109,5% годовых", () => {
    expect(dailyToAnnual(0.3)).toBeCloseTo(109.5, 6);
    expect(annualToDaily(109.5)).toBeCloseTo(0.3, 6);
  });
});

describe("golden: 1 000 000 ₸, 12 мес., 24%, аннуитет", () => {
  const a = ok();
  it("payment 94 559,60", () => {
    expect(a.schedule[0].payment).toBe(9455960);
    expect(a.schedule).toHaveLength(12);
  });
  it("total 1 134 715,16 and overpay 134 715,16 (±0,10 ₸ округления)", () => {
    expect(Math.abs(a.totalPaid - 113471516)).toBeLessThanOrEqual(10);
    expect(Math.abs(a.overpay - 13471516)).toBeLessThanOrEqual(10);
    expect(a.handed).toBe(100_000_000);
  });
  it("closes the balance to zero", () => {
    expect(a.schedule[11].balance).toBe(0);
  });
  it("effective rate ≈ 26,82%", () => {
    expect(a.effectiveRateAnnual).toBeCloseTo(26.82, 1);
  });
  it("breakdown sums to total paid", () => {
    const b = a.breakdown;
    expect(b.body + b.interest + b.fees + b.insurance).toBe(a.totalPaid);
  });
});

describe("fees and insurance", () => {
  it("3% fee deducted at issue → on hand 970 000, effective ≈ 34,48% (±0,05)", () => {
    const a = ok(loan({ fees: [{ name: "fee", kind: "upfront_deducted", amount: null, percent: 3 }] }));
    expect(a.handed).toBe(97_000_000);
    expect(Math.abs((a.effectiveRateAnnual as number) - 34.48)).toBeLessThan(0.05);
    expect(a.breakdown.fees).toBe(3_000_000);
    expect(a.breakdown.body + a.breakdown.interest + a.breakdown.fees + a.breakdown.insurance).toBe(a.totalPaid);
  });
  it("fee paid on top raises total and effective rate but not handed", () => {
    const base = ok();
    const a = ok(loan({ fees: [{ name: "fee", kind: "upfront_paid", amount: 30_000, percent: null }] }));
    expect(a.handed).toBe(base.handed);
    expect(a.totalPaid).toBe(base.totalPaid + 3_000_000);
    expect(a.effectiveRateAnnual as number).toBeGreaterThan(base.effectiveRateAnnual as number);
  });
  it("monthly fee adds to each payment", () => {
    const a = ok(loan({ fees: [{ name: "svc", kind: "monthly", amount: 1000, percent: null }] }));
    expect(a.schedule[0].total).toBe(a.schedule[0].payment + 100_000);
    expect(a.breakdown.fees).toBe(12 * 100_000);
  });
  it("insurance: monthly / deducted / paid / financed", () => {
    const mk = (mode: "monthly" | "upfront_deducted" | "upfront_paid" | "financed") =>
      ok(loan({ insurance: { present: true, amount: 12_000, percent: null, mode } }));
    expect(mk("monthly").breakdown.insurance).toBe(12 * 1_200_000);
    expect(mk("upfront_deducted").handed).toBe(100_000_000 - 1_200_000);
    expect(mk("upfront_paid").breakdown.insurance).toBe(1_200_000);
    const fin = mk("financed");
    expect(fin.schedule.reduce((s, r) => s + r.principalPart, 0)).toBe(101_200_000);
    expect(fin.breakdown.insurance).toBeGreaterThanOrEqual(1_200_000);
  });
  it("insurance by percent, absent insurance ignored", () => {
    const c = resolveCosts(loan({ insurance: { present: true, amount: null, percent: 2, mode: "upfront_paid" } }));
    expect(c.insPaid).toBe(2_000_000);
    expect(resolveCosts(loan({ insurance: { present: false, amount: 5, percent: null, mode: "upfront_paid" } })).insPaid).toBe(0);
  });
});

describe("schedule", () => {
  it("differentiated: equal principal parts, decreasing payments", () => {
    const a = ok(loan({ paymentType: "differentiated" }));
    expect(a.schedule[0].principalPart).toBe(8_333_333);
    expect(a.schedule[0].interest).toBe(2_000_000);
    expect(a.schedule[0].payment).toBeGreaterThan(a.schedule[11].payment);
    expect(a.schedule.reduce((s, r) => s + r.principalPart, 0)).toBe(100_000_000);
  });
  it("zero rate annuity splits evenly", () => {
    expect(annuityPayment(1200, 0, 12)).toBe(100);
    const a = ok(loan({ nominalRateAnnual: 0 }));
    expect(a.overpay).toBe(0);
    expect(a.effectiveRateAnnual).toBe(0);
  });
  it("implied rate from payment round-trips", () => {
    const pay = annuityPayment(100_000_000, 24, 12);
    expect(impliedAnnualRate(100_000_000, 12, Math.round(pay))).toBeCloseTo(24, 2);
    expect(impliedAnnualRate(1200, 12, 100)).toBe(0);
    expect(impliedAnnualRate(100, 12, 5)).toBeNull();
    expect(impliedAnnualRate(0, 12, 5)).toBeNull();
  });
});

describe("analyze: rate sources and errors", () => {
  it("validates input", () => {
    expect(analyze(loan({ principal: null }))).toEqual({ ok: false, error: "principal" });
    expect(analyze(loan({ principal: 0 }))).toEqual({ ok: false, error: "principal" });
    expect(analyze(loan({ termMonths: null }))).toEqual({ ok: false, error: "term" });
    expect(analyze(loan({ termMonths: 2.5 }))).toEqual({ ok: false, error: "term" });
    expect(analyze(loan({ termMonths: 601 }))).toEqual({ ok: false, error: "term" });
    expect(analyze(loan({ nominalRateAnnual: null }))).toEqual({ ok: false, error: "rate" });
  });
  it("daily rate → ×365", () => {
    const a = ok(loan({ nominalRateAnnual: null, dailyRate: 0.3, principal: 100_000, termMonths: 3 }));
    expect(a.rateSource).toBe("daily");
    expect(a.rateAnnualUsed).toBeCloseTo(109.5, 6);
  });
  it("rate implied from stated payment", () => {
    const a = ok(loan({ nominalRateAnnual: null, statedMonthlyPayment: 94559.6 }));
    expect(a.rateSource).toBe("implied_from_payment");
    expect(a.rateAnnualUsed).toBeCloseTo(24, 1);
    expect(analyze(loan({ nominalRateAnnual: null, statedMonthlyPayment: 10 }))).toEqual({ ok: false, error: "rate" });
  });
  it("installment 0%: effective rate computed from cash price (hidden markup)", () => {
    const a = ok(loan({ principal: 348_000, cashPrice: 300_000, termMonths: 12, nominalRateAnnual: 0 }));
    expect(a.markup).toBe(4_800_000);
    expect(a.handed).toBe(30_000_000);
    expect(a.overpay).toBe(4_800_000);
    expect(a.breakdown.interest).toBe(4_800_000);
    expect(a.effectiveRateAnnual as number).toBeGreaterThan(25);
    expect(a.priceMultiple).toBeCloseTo(1.16, 5);
  });
  it("installment without a stated rate falls back to 0%", () => {
    const a = ok(loan({ principal: 348_000, cashPrice: 300_000, nominalRateAnnual: null }));
    expect(a.rateSource).toBe("zero");
  });
  it("ignores cashPrice greater than principal", () => {
    const a = ok(loan({ cashPrice: 2_000_000 }));
    expect(a.base).toBe(100_000_000);
    expect(a.markup).toBe(0);
  });
  it("cost per day and multiple", () => {
    const a = ok();
    expect(a.costPerDay).toBeCloseTo(a.overpay / 365, 0);
    expect(a.priceMultiple).toBeCloseTo(1.1347, 3);
    expect(a.overpayPct).toBeCloseTo(13.47, 1);
  });
});

describe("scenarios", () => {
  const a = ok();
  it("early repayment shortens term and saves interest", () => {
    const r = earlyRepayment(a, 20_000);
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.saved).toBeGreaterThan(0);
    expect(r.months).toBe(a.schedule.length - r.monthsSaved);
    const none = earlyRepayment(a, 0);
    expect(none.monthsSaved).toBe(0);
    expect(Math.abs(none.saved)).toBeLessThanOrEqual(1);
    expect(earlyRepayment(a, -5).monthsSaved).toBe(0);
  });
  it("early repayment works for differentiated and with paid upfront costs", () => {
    const d = ok(loan({ paymentType: "differentiated", fees: [{ name: "x", kind: "upfront_paid", amount: 1000, percent: null }] }));
    const r = earlyRepayment(d, 30_000);
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.totalPaid).toBeLessThan(d.totalPaid);
  });
  it("huge extra pays everything in the first month", () => {
    const rows = buildSchedule(a.scheduleInput, 10 ** 12);
    expect(rows).toHaveLength(1);
    expect(rows[0].balance).toBe(0);
  });
  it("late penalty: percent per day + fixed", () => {
    const p = loan({
      penalties: [
        { description: "pen", percentPerDay: 0.5, fixedAmount: null },
        { description: "fix", percentPerDay: null, fixedAmount: 5000 },
      ],
    });
    const r = latePenalty(p, a, 30);
    expect(r.hasPenaltyTerms).toBe(true);
    expect(r.total).toBe(Math.round((a.firstPaymentTotal * 0.5 * 30) / 100) + 500_000);
    expect(latePenalty(loan(), a, 30)).toEqual({ total: 0, hasPenaltyTerms: false });
  });
  it("months to save", () => {
    expect(monthsToSave(100_000_000, 9_455_960)).toBe(11);
    expect(monthsToSave(0, 5)).toBeNull();
    expect(monthsToSave(5, 0)).toBeNull();
  });
});
