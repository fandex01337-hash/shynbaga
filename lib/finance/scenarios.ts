import { toTiyn } from "./money";
import { buildSchedule } from "./schedule";
import type { Analysis, LoanParams } from "./types";

export interface EarlyRepaymentResult {
  months: number;
  monthsSaved: number;
  totalPaid: number;
  saved: number;
}

/** Платить на extraTenge больше каждый месяц → срок сокращается, срок закрывается раньше. */
export function earlyRepayment(a: Analysis, extraTenge: number): EarlyRepaymentResult {
  const rows = buildSchedule(a.scheduleInput, toTiyn(Math.max(0, extraTenge)));
  let total = a.costs.feePaid + a.costs.insPaid;
  for (const r of rows) total += r.total;
  return {
    months: rows.length,
    monthsSaved: a.schedule.length - rows.length,
    totalPaid: total,
    saved: a.totalPaid - total,
  };
}

export interface LatePenaltyResult {
  /** тиыны */
  total: number;
  hasPenaltyTerms: boolean;
}

/**
 * Пени за просрочку одного (первого) платежа. Процент в день считается от суммы просроченного платежа —
 * это допущение: в договоре база может быть иной (остаток долга), поэтому в UI это сказано явно.
 */
export function latePenalty(p: LoanParams, a: Analysis, days: number): LatePenaltyResult {
  let total = 0;
  let has = false;
  for (const pen of p.penalties) {
    if (pen.percentPerDay != null && pen.percentPerDay > 0) {
      has = true;
      total += Math.round((a.firstPaymentTotal * pen.percentPerDay * days) / 100);
    }
    if (pen.fixedAmount != null && pen.fixedAmount > 0) {
      has = true;
      total += toTiyn(pen.fixedAmount);
    }
  }
  return { total, hasPenaltyTerms: has };
}

/** Через сколько месяцев накопите target, откладывая monthly (оба в тиынах). */
export function monthsToSave(target: number, monthly: number): number | null {
  if (monthly <= 0 || target <= 0) return null;
  return Math.ceil(target / monthly);
}
