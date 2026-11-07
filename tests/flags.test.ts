import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/finance/analyze";
import type { Analysis } from "@/lib/finance/types";
import { evaluateEngineFlags } from "@/lib/flags/rules";
import { FLAG_SEVERITY, isLlmFlagId, mergeFlags, type Flag } from "@/lib/flags/taxonomy";
import { extractionToParams } from "@/lib/form";
import { PRESETS, getPreset } from "@/lib/presets";
import { burdenZone } from "@/lib/config/thresholds";
import { loan } from "./helpers";

const run = (p = loan()) => {
  const a = analyze(p) as Analysis;
  expect(a.ok).toBe(true);
  return evaluateEngineFlags(p, a).map((f) => f.id);
};

describe("engine flags", () => {
  it("clean loan → no flags", () => {
    expect(run()).toEqual([]);
  });
  it("rate_gap when fee pushes effective rate far above stated", () => {
    expect(run(loan({ fees: [{ name: "f", kind: "upfront_deducted", amount: null, percent: 3 }] }))).toContain("rate_gap");
  });
  it("zero_percent_markup", () => {
    expect(run(loan({ principal: 348_000, cashPrice: 300_000, nominalRateAnnual: 0 }))).toContain("zero_percent_markup");
    expect(run(loan({ principal: 300_000, cashPrice: 300_000, nominalRateAnnual: 0 }))).not.toContain("zero_percent_markup");
  });
  it("daily_rate_masking", () => {
    expect(run(loan({ nominalRateAnnual: null, dailyRate: 0.3, principal: 100_000, termMonths: 3 }))).toContain("daily_rate_masking");
  });
  it("debt_burden_high only with income and ≥ red threshold", () => {
    expect(run(loan({ monthlyIncome: 150_000 }))).toContain("debt_burden_high");
    expect(run(loan({ monthlyIncome: 1_000_000 }))).not.toContain("debt_burden_high");
    expect(run(loan({ monthlyIncome: null }))).not.toContain("debt_burden_high");
  });
  it("stated_mismatch: payment and ГЭСВ", () => {
    expect(run(loan({ statedMonthlyPayment: 70_000 }))).toContain("stated_mismatch");
    expect(run(loan({ statedMonthlyPayment: 94_560 }))).not.toContain("stated_mismatch");
    expect(run(loan({ statedEffectiveRate: 20 }))).toContain("stated_mismatch");
    expect(run(loan({ statedEffectiveRate: 26.8 }))).not.toContain("stated_mismatch");
  });
});

describe("zones", () => {
  it("green / yellow / red thresholds", () => {
    expect(burdenZone(10)).toBe("green");
    expect(burdenZone(30)).toBe("yellow");
    expect(burdenZone(49.9)).toBe("yellow");
    expect(burdenZone(50)).toBe("red");
  });
});

describe("taxonomy", () => {
  it("merge dedupes by id and sorts by severity", () => {
    const e: Flag[] = [{ id: "daily_rate_masking", source: "engine", severity: "medium" }];
    const l: Flag[] = [
      { id: "upfront_payment_scam", source: "llm", severity: "critical" },
      { id: "daily_rate_masking", source: "llm", severity: "medium" },
    ];
    const m = mergeFlags(e, l);
    expect(m.map((f) => f.id)).toEqual(["upfront_payment_scam", "daily_rate_masking"]);
    expect(m[1].source).toBe("engine");
  });
  it("isLlmFlagId", () => {
    expect(isLlmFlagId("hidden_fees")).toBe(true);
    expect(isLlmFlagId("rate_gap")).toBe(false);
    expect(FLAG_SEVERITY.upfront_payment_scam).toBe("critical");
  });
});

describe("demo presets end-to-end (fixtures → engine)", () => {
  const flagsOf = (id: string) => {
    const p = extractionToParams(getPreset(id)!.extraction);
    const a = analyze(p);
    return { a, flags: a.ok ? evaluateEngineFlags(p, a).map((f) => f.id) : [] };
  };
  it("has the six presets", () => {
    expect(PRESETS.map((p) => p.id).sort()).toEqual(["cash_loan", "contract", "honest", "installment", "microloan", "scam_sms"]);
  });
  it("sample contract: calculable, fee+insurance+monthly fee priced in, ГЭСВ understated", () => {
    const p = extractionToParams(getPreset("contract")!.extraction);
    expect(p.insurance.mode).toBe("financed"); // «включается в сумму кредита»
    const a = analyze(p);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.handed).toBe(235_200_000); // 2 400 000 − 2% комиссии
    expect(a.schedule).toHaveLength(36);
    expect(a.schedule[0].fee).toBe(150_000);
    expect(Math.abs(a.firstPayment - 9_035_399)).toBeLessThanOrEqual(100);
    expect(a.effectiveRateAnnual as number).toBeGreaterThan(25);
    expect(a.effectiveRateAnnual as number).toBeLessThan(28);
    const flags = evaluateEngineFlags(p, a).map((f) => f.id);
    expect(flags).toEqual(expect.arrayContaining(["rate_gap", "stated_mismatch"]));
    expect(getPreset("contract")!.extraction.redFlags.map((f) => f.id)).toEqual(["imposed_insurance", "hidden_fees"]);
  });
  it("the sample contract text contains personal data, so redaction has something to mask", async () => {
    const { redact } = await import("@/lib/extraction/redact");
    const r = redact(getPreset("contract")!.text);
    expect(r.counts.iin).toBe(1);
    expect(r.counts.phone).toBe(1);
    expect(r.counts.name).toBe(1);
    expect(r.text).not.toContain("123456789012");
    expect(r.text).toContain("2 400 000 тенге");
  });
  it("insurance mode inference from the quote", () => {
    const base = getPreset("contract")!.extraction;
    const mode = (quote: string | null, monthly: boolean | null) =>
      extractionToParams({ ...base, insurance: { ...base.insurance, quote, monthly } }).insurance.mode;
    expect(mode("премия 5 000, включается в сумму кредита", false)).toBe("financed");
    expect(mode("премия 5 000 добавляется к сумме кредита", null)).toBe("financed");
    expect(mode("премия 5 000 оплачивается при выдаче", false)).toBe("upfront_deducted");
    expect(mode("премия 5 000 ежемесячно", true)).toBe("monthly");
    expect(mode(null, null)).toBe("upfront_deducted");
  });
  it("honest offer is the control: no engine flags, no LLM flags", () => {
    const { a, flags } = flagsOf("honest");
    expect(a.ok).toBe(true);
    expect(flags).toEqual([]);
    expect(getPreset("honest")!.extraction.redFlags).toEqual([]);
  });
  it("microloan: daily rate masking", () => {
    expect(flagsOf("microloan").flags).toContain("daily_rate_masking");
  });
  it("installment: zero percent markup", () => {
    expect(flagsOf("installment").flags).toContain("zero_percent_markup");
  });
  it("cash loan: effective rate gap from fee and insurance", () => {
    const { a, flags } = flagsOf("cash_loan");
    expect(a.ok && a.handed < 150_000_000).toBe(true);
    expect(flags).toContain("rate_gap");
  });
  it("scam SMS: cannot be priced, carries upfront_payment_scam", () => {
    const ex = getPreset("scam_sms")!.extraction;
    expect(ex.productType).toBe("scam_suspected");
    expect(ex.redFlags.map((f) => f.id)).toContain("upfront_payment_scam");
    expect(analyze(extractionToParams(ex)).ok).toBe(false);
  });
  it("every fixture quote is a verbatim substring of its text", () => {
    for (const p of PRESETS) {
      const hay = p.text.toLowerCase().replace(/\s+/g, " ");
      const quotes = [
        ...Object.values(p.extraction.fieldQuotes),
        ...p.extraction.redFlags.map((f) => f.quote),
        ...p.extraction.fees.map((f) => f.quote),
        ...p.extraction.penalties.map((f) => f.quote),
      ];
      for (const q of quotes) expect(hay, `${p.id}: ${q}`).toContain(q.toLowerCase().replace(/\s+/g, " "));
    }
  });
});
