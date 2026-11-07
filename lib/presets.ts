import microloan from "@/fixtures/microloan.json";
import installment from "@/fixtures/installment.json";
import cashLoan from "@/fixtures/cash_loan.json";
import scamSms from "@/fixtures/scam_sms.json";
import honest from "@/fixtures/honest.json";
import contract from "@/fixtures/contract.json";
import { ExtractionSchema, sanitizeExtraction, type Extraction } from "@/lib/extraction/schema";

export interface Preset {
  id: string;
  text: string;
  extraction: Extraction;
}

const raw = [contract, microloan, installment, cashLoan, scamSms, honest];

/** Демо-пресеты: текст + заранее извлечённый результат (фолбэк при недоступном LLM). Кредиторы вымышленные. */
export const PRESETS: Preset[] = raw.map((r) => ({
  id: r.id,
  text: r.text,
  extraction: sanitizeExtraction(ExtractionSchema.parse(r.extraction)),
}));

export const getPreset = (id: string | undefined): Preset | undefined => PRESETS.find((p) => p.id === id);
