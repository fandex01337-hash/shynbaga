import { burdenZone, type Zone } from "@/lib/config/thresholds";
import { annualToDaily, dailyToAnnual, toTiyn } from "@/lib/finance/money";
import { monthsToSave } from "@/lib/finance/scenarios";
import type { Analysis, LoanParams } from "@/lib/finance/types";

/** Данные карточек «на человеческом языке»; тексты собирает UI из словаря. */
export interface HumanFacts {
  overpayMonthsOfIncome: number | null;
  burden: { sharePct: number; zone: Zone } | null;
  priceMultiple: number;
  /** либо заявленная дневная → годовая, либо эквивалент эффективной ставки в день */
  rate: { kind: "daily_to_annual"; daily: number; annual: number } | { kind: "effective_as_daily"; daily: number; annual: number } | null;
  saveMonths: number | null;
  costPerDayTiyn: number;
}

export function humanFacts(p: LoanParams, a: Analysis): HumanFacts {
  const income = p.monthlyIncome != null && p.monthlyIncome > 0 ? toTiyn(p.monthlyIncome) : null;
  const sharePct = income ? (a.firstPaymentTotal / income) * 100 : null;

  let rate: HumanFacts["rate"] = null;
  if (p.dailyRate != null && p.dailyRate > 0) {
    rate = { kind: "daily_to_annual", daily: p.dailyRate, annual: dailyToAnnual(p.dailyRate) };
  } else if (a.effectiveRateAnnual != null && a.effectiveRateAnnual > 0) {
    rate = { kind: "effective_as_daily", daily: annualToDaily(a.effectiveRateAnnual), annual: a.effectiveRateAnnual };
  }

  return {
    overpayMonthsOfIncome: income ? a.overpay / income : null,
    burden: sharePct != null ? { sharePct, zone: burdenZone(sharePct) } : null,
    priceMultiple: a.priceMultiple,
    rate,
    saveMonths: monthsToSave(a.base, a.firstPaymentTotal),
    costPerDayTiyn: a.costPerDay,
  };
}
