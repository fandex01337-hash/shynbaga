import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/finance/analyze";
import { evaluateEngineFlags } from "@/lib/flags/rules";
import { emptyParams } from "@/lib/form";
import { buildSamplePrompt, randomScenario, sanitizeSample, validateSample, type Scenario } from "@/lib/sample/generate";

/** Детерминированный генератор для воспроизводимых тестов. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("randomScenario", () => {
  it("is deterministic for a given rng and varies between seeds", () => {
    expect(randomScenario(seeded(1))).toEqual(randomScenario(seeded(1)));
    const set = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(randomScenario(seeded(i + 1)))));
    expect(set.size).toBeGreaterThan(10);
  });

  it("always produces a calculable loan with ≥2 paid extras and an understated ГЭСВ", () => {
    for (let i = 1; i <= 200; i++) {
      const s = randomScenario(seeded(i));
      expect(s.principal).toBeGreaterThanOrEqual(600_000);
      expect(s.principal).toBeLessThanOrEqual(5_000_000);
      expect([12, 18, 24, 36, 48, 60]).toContain(s.termMonths);
      expect(s.rate).toBeGreaterThanOrEqual(14);
      expect(s.rate).toBeLessThanOrEqual(30);
      expect([s.issuanceFeePct, s.monthlyFee, s.insurance].filter(Boolean).length).toBeGreaterThanOrEqual(2);
      expect(s.statedGesv).toBeGreaterThan(s.rate);

      // и движок реально его считает и находит расхождение ставок
      const p = {
        ...emptyParams(),
        principal: s.principal,
        termMonths: s.termMonths,
        nominalRateAnnual: s.rate,
        statedEffectiveRate: s.statedGesv,
        statedMonthlyPayment: s.statedPayment,
        fees: [
          ...(s.issuanceFeePct != null ? [{ name: "f", kind: "upfront_deducted" as const, amount: null, percent: s.issuanceFeePct }] : []),
          ...(s.monthlyFee != null ? [{ name: "m", kind: "monthly" as const, amount: s.monthlyFee, percent: null }] : []),
        ],
        insurance: s.insurance
          ? { present: true, amount: s.insurance.amount, percent: null, mode: "financed" as const }
          : { present: false, amount: null, percent: null, mode: "upfront_deducted" as const },
      };
      const a = analyze(p);
      expect(a.ok).toBe(true);
      if (a.ok) {
        expect(a.effectiveRateAnnual as number).toBeGreaterThan(s.rate);
        expect(a.overpay).toBeGreaterThan(0);
      }
    }
  });

  it("the stated payment ignores fees and insurance (the demo trap)", () => {
    const s = randomScenario(seeded(7));
    const p = { ...emptyParams(), principal: s.principal, termMonths: s.termMonths, nominalRateAnnual: s.rate };
    const a = analyze(p);
    if (!a.ok) throw new Error("not ok");
    expect(Math.abs(s.statedPayment - a.firstPayment / 100)).toBeLessThanOrEqual(1);
  });

  it("some scenarios produce a daily-flag-worthy insurance rate hike, some don't", () => {
    const list = Array.from({ length: 100 }, (_, i) => randomScenario(seeded(i + 1)));
    expect(list.some((s) => s.insurance)).toBe(true);
    expect(list.some((s) => !s.insurance)).toBe(true);
    expect(list.some((s) => s.earlyFeePct)).toBe(true);
    for (const s of list) if (s.insurance) expect(s.insurance.rateWithout).toBeGreaterThan(s.rate);
  });
});

describe("buildSamplePrompt", () => {
  const s: Scenario = {
    principal: 2_400_000, termMonths: 36, rate: 19.5, issuanceFeePct: 2, monthlyFee: 1500,
    insurance: { amount: 48_000, rateWithout: 26.5 }, penaltyPctPerDay: 0.2, earlyFeePct: 1, statedGesv: 21, statedPayment: 88_582,
  };
  it("lists every term verbatim with spaced thousands and comma decimals", () => {
    const { user, system } = buildSamplePrompt(s, "ru");
    for (const part of ["2 400 000 тенге", "36 месяцев", "19,5% годовых", "21%", "88 582 тенге", "2% от суммы кредита", "1 500 тенге ежемесячно", "48 000 тенге", "26,5% годовых", "0,2%", "комиссия за досрочное погашение 1%"]) {
      expect(user).toContain(part);
    }
    expect(system).toContain("ВЫМЫШЛЕННЫЕ");
    expect(system).toContain("123456789012");
    expect(buildSamplePrompt(s, "kk").system).toContain("казахском");
  });
  it("omits absent terms", () => {
    const { user } = buildSamplePrompt({ ...s, issuanceFeePct: null, monthlyFee: null, insurance: null, earlyFeePct: null }, "ru");
    expect(user).not.toContain("Комиссия за выдачу");
    expect(user).not.toContain("ведение счёта");
    expect(user).not.toContain("Страхование");
    expect(user).toContain("в любое время без комиссий");
  });
});

describe("validateSample / sanitizeSample", () => {
  const s: Scenario = {
    principal: 2_400_000, termMonths: 36, rate: 19.5, issuanceFeePct: null, monthlyFee: 1500,
    insurance: null, penaltyPctPerDay: 0.2, earlyFeePct: null, statedGesv: 21, statedPayment: 88_582,
  };
  const good = `ДОГОВОР КРЕДИТА № 1\n${"Банк «Алмас-Тест» (вымышленный). ".repeat(10)}\n1.1. Сумма кредита — 2 400 000 тенге.\n1.2. Срок — 36 месяцев.\n1.3. Ставка — 19,5% годовых.\n1.4. ГЭСВ — 21%.\n1.5. Платёж — 88 582 тенге.\n2.1. Комиссия за ведение счёта — 1 500 тенге ежемесячно.\n${"Прочие положения. ".repeat(20)}`;

  it("accepts a text with all numbers", () => {
    expect(validateSample(good, s)).toBeNull();
  });
  it("rejects missing numbers, wrong length and real lenders", () => {
    expect(validateSample(good.replace("2 400 000", "2 500 000"), s)).toBe("missing_2400000");
    expect(validateSample(good.replace("88 582", "90 000"), s)).toBe("missing_88582");
    expect(validateSample("коротко", s)).toBe("length");
    expect(validateSample(good + " Банк Kaspi", s)).toBe("real_lender");
    expect(validateSample(good.replace("«Алмас-Тест»", "Халык Банк"), s)).toBe("real_lender");
  });
  it("forces fictional IIN and phone", () => {
    const out = sanitizeSample("ИИН 900101300123, тел. 8 (701) 234-56-78 и +7 777 123 45 67, сумма 2 400 000");
    expect(out).toBe("ИИН 123456789012, тел. +7 700 000 00 00 и +7 700 000 00 00, сумма 2 400 000");
  });
});
