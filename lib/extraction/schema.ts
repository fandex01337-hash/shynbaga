import { z } from "zod";
import { LIMITS } from "@/lib/config/thresholds";
import { isLlmFlagId, type LlmFlagId } from "@/lib/flags/taxonomy";

const num = z.number().nullable().default(null);
const str = z.string().nullable().default(null);

export const FeeSchema = z.object({
  name: z.string(),
  kind: z.enum(["upfront_deducted", "upfront_paid", "monthly"]),
  amount: num,
  percent: num,
  quote: z.string().default(""),
});

export const ExtractionSchema = z.object({
  productType: z
    .enum(["cash_loan", "microloan", "installment", "credit_card", "car_loan", "mortgage", "scam_suspected", "unknown"])
    .default("unknown"),
  lenderName: str,
  currency: z.enum(["KZT", "USD", "other"]).default("KZT"),
  principal: num,
  cashPrice: num,
  termMonths: num,
  nominalRateAnnual: num,
  statedEffectiveRate: num,
  dailyRate: num,
  paymentType: z.enum(["annuity", "differentiated", "unknown"]).default("unknown"),
  statedMonthlyPayment: num,
  fees: z.array(FeeSchema).default([]),
  insurance: z
    .object({
      present: z.boolean().default(false),
      amount: num,
      percent: num,
      monthly: z.boolean().nullable().default(null),
      quote: str,
    })
    .default({ present: false, amount: null, percent: null, monthly: null, quote: null }),
  penalties: z
    .array(
      z.object({
        description: z.string(),
        percentPerDay: num,
        fixedAmount: num,
        quote: z.string().default(""),
      }),
    )
    .default([]),
  earlyRepayment: z
    .object({ allowed: z.boolean().nullable().default(null), conditions: str, quote: str })
    .default({ allowed: null, conditions: null, quote: null }),
  // id — строка: неизвестные id отбрасываем в sanitize, а не валим весь ответ
  redFlags: z.array(z.object({ id: z.string(), quote: z.string().default(""), explanation: z.string().default("") })).default([]),
  missingInfo: z.array(z.string()).default([]),
  fieldQuotes: z.record(z.string(), z.string()).default({}),
});

export type RawExtraction = z.infer<typeof ExtractionSchema>;
export type Extraction = Omit<RawExtraction, "redFlags"> & {
  redFlags: { id: LlmFlagId; quote: string; explanation: string }[];
};

export function sanitizeExtraction(raw: RawExtraction): Extraction {
  return {
    ...raw,
    redFlags: raw.redFlags.filter((f): f is { id: LlmFlagId; quote: string; explanation: string } => isLlmFlagId(f.id)),
  };
}

/** Вход /api/extract: ровно один источник — текст, фото или PDF. */
export const ExtractRequestSchema = z
  .object({
    lang: z.enum(["ru", "kk"]).default("ru"),
    text: z.string().max(LIMITS.maxTextChars).optional(),
    image: z
      .object({
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64: z.string().min(100).max(LIMITS.maxImageBase64Chars),
      })
      .optional(),
    pdf: z.object({ base64: z.string().min(100).max(LIMITS.maxPdfBase64Chars) }).optional(),
    presetId: z.string().max(50).optional(),
  })
  .refine((v) => [v.text?.trim() ? 1 : 0, v.image ? 1 : 0, v.pdf ? 1 : 0].reduce((a, b) => a + b, 0) === 1, {
    message: "Provide exactly one of: text, image, pdf",
  });

export type ExtractRequest = z.infer<typeof ExtractRequestSchema>;

export const SummaryRequestSchema = z.object({
  lang: z.enum(["ru", "kk"]).default("ru"),
  productType: z.string().max(30),
  flagIds: z.array(z.string().max(40)).max(20),
  missing: z.array(z.string().max(60)).max(20),
  zone: z.enum(["green", "yellow", "red"]).nullable(),
});

export const SummaryResponseSchema = z.object({
  verdict: z.string().min(1).max(400),
  questions: z.array(z.string().min(1).max(250)).max(6).default([]),
});
