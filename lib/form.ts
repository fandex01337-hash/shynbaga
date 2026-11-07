import type { Extraction } from "@/lib/extraction/schema";
import type { Flag } from "@/lib/flags/taxonomy";
import { FLAG_SEVERITY } from "@/lib/flags/taxonomy";
import type { LoanParams } from "@/lib/finance/types";

export const emptyParams = (): LoanParams => ({
  productType: "unknown",
  principal: null,
  cashPrice: null,
  termMonths: null,
  nominalRateAnnual: null,
  dailyRate: null,
  statedEffectiveRate: null,
  statedMonthlyPayment: null,
  paymentType: "annuity",
  fees: [],
  insurance: { present: false, amount: null, percent: null, mode: "upfront_deducted" },
  penalties: [],
  monthlyIncome: null,
});

/** Данные об извлечении, нужные UI: цитаты, пропуски, флаги LLM. */
export interface ExtractionMeta {
  via: "llm" | "cache" | "fixture" | "manual";
  quotes: Record<string, string>;
  /** цитата не найдена в исходном тексте */
  unverified: Record<string, boolean>;
  llmFlags: Flag[];
  missingInfo: string[];
  feeQuotes: string[];
  penaltyQuotes: string[];
  insuranceQuote: string | null;
  currency: "KZT" | "USD" | "other";
  lenderName: string | null;
  earlyRepayment: Extraction["earlyRepayment"];
}

export const manualMeta = (): ExtractionMeta => ({
  via: "manual",
  quotes: {},
  unverified: {},
  llmFlags: [],
  missingInfo: [],
  feeQuotes: [],
  penaltyQuotes: [],
  insuranceQuote: null,
  currency: "KZT",
  lenderName: null,
  earlyRepayment: { allowed: null, conditions: null, quote: null },
});

/** Страховка «включается в сумму кредита» — это финансируемая страховка, а не удержание при выдаче. */
const FINANCED_RE = /включ\S*\s+в\s+(?:сумму\s+)?кредит|добавля\S*\s+к\s+(?:сумме\s+)?кредит/i;

export function extractionToParams(ex: Extraction): LoanParams {
  return {
    productType: ex.productType,
    principal: ex.principal,
    cashPrice: ex.cashPrice,
    termMonths: ex.termMonths,
    nominalRateAnnual: ex.nominalRateAnnual,
    dailyRate: ex.dailyRate,
    statedEffectiveRate: ex.statedEffectiveRate,
    statedMonthlyPayment: ex.statedMonthlyPayment,
    paymentType: ex.paymentType === "differentiated" ? "differentiated" : "annuity",
    fees: ex.fees.map((f) => ({ name: f.name, kind: f.kind, amount: f.amount, percent: f.percent })),
    insurance: {
      present: ex.insurance.present,
      amount: ex.insurance.amount,
      percent: ex.insurance.percent,
      mode: ex.insurance.monthly ? "monthly" : FINANCED_RE.test(ex.insurance.quote ?? "") ? "financed" : "upfront_deducted",
    },
    penalties: ex.penalties.map((p) => ({ description: p.description, percentPerDay: p.percentPerDay, fixedAmount: p.fixedAmount })),
    monthlyIncome: null,
  };
}

export function extractionToMeta(
  ex: Extraction,
  via: ExtractionMeta["via"],
  verified: Record<string, boolean> | null,
): ExtractionMeta {
  const unverified: Record<string, boolean> = {};
  if (verified) for (const [k, ok] of Object.entries(verified)) if (!ok) unverified[k] = true;
  return {
    via,
    quotes: ex.fieldQuotes,
    unverified,
    llmFlags: ex.redFlags.map((f, i) => ({
      id: f.id,
      source: "llm" as const,
      severity: FLAG_SEVERITY[f.id],
      quote: f.quote,
      explanation: f.explanation || undefined,
      vars: unverified[`redFlags.${i}`] ? { unverified: 1 } : undefined,
    })),
    missingInfo: ex.missingInfo,
    feeQuotes: ex.fees.map((f) => f.quote),
    penaltyQuotes: ex.penalties.map((p) => p.quote),
    insuranceQuote: ex.insurance.quote,
    currency: ex.currency,
    lenderName: ex.lenderName,
    earlyRepayment: ex.earlyRepayment,
  };
}

/** Парсинг числа из поля ввода: допускает пробелы и запятую. */
export function parseNum(s: string): number | null {
  const t = s.replace(/[\s ]/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
