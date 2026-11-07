import type { LoanParams } from "@/lib/finance/types";
import type { Flag } from "@/lib/flags/taxonomy";

/**
 * Детерминированные вопросы банку (ключи i18n `q.*`) — работают без LLM.
 * Вопрос появляется, если по теме нет данных или сработал соответствующий флаг.
 */
export function bankQuestionKeys(p: LoanParams, flags: Flag[], earlyAllowed: boolean | null): string[] {
  const has = (id: string) => flags.some((f) => f.id === id);
  const q: string[] = [];
  if (p.statedEffectiveRate == null) q.push("q.gesv");
  q.push("q.total_amount");
  if (p.fees.length === 0 || has("hidden_fees")) q.push("q.fees");
  if (!p.insurance.present || has("imposed_insurance")) q.push("q.insurance_optional");
  if (earlyAllowed == null) q.push("q.early");
  if (p.penalties.length === 0 || has("high_penalties")) q.push("q.penalties");
  if (has("floating_rate")) q.push("q.floating");
  if (has("rollover_trap")) q.push("q.rollover");
  if (has("daily_rate_masking")) q.push("q.daily");
  if (has("zero_percent_markup")) q.push("q.markup");
  if (has("collateral_or_guarantor")) q.push("q.collateral");
  if (has("upfront_payment_scam")) q.push("q.scam_verify");
  return q.slice(0, 8);
}
