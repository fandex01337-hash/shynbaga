import { THRESHOLDS } from "@/lib/config/thresholds";
import { dailyToAnnual, formatNumber, formatTenge, toTiyn } from "@/lib/finance/money";
import type { Analysis, LoanParams } from "@/lib/finance/types";
import { FLAG_SEVERITY, type Flag } from "./taxonomy";

const flag = (id: Flag["id"], vars?: Flag["vars"]): Flag => ({
  id,
  source: "engine",
  severity: FLAG_SEVERITY[id],
  vars,
});

/** Красные флаги, которые считает движок без LLM. */
export function evaluateEngineFlags(p: LoanParams, a: Analysis): Flag[] {
  const out: Flag[] = [];
  const eff = a.effectiveRateAnnual;

  // rate_gap: сравниваем с максимальной из заявленных ставок
  const declared = Math.max(p.statedEffectiveRate ?? 0, p.nominalRateAnnual ?? 0);
  if (eff != null && declared > 0 && eff - declared > THRESHOLDS.rateGapPp) {
    out.push(flag("rate_gap", { declared: formatNumber(declared), effective: formatNumber(eff) }));
  }

  // zero_percent_markup
  if (
    p.cashPrice != null &&
    p.principal != null &&
    p.principal > p.cashPrice * (1 + THRESHOLDS.priceMarkupTolerancePct / 100) &&
    (p.nominalRateAnnual == null || p.nominalRateAnnual === 0)
  ) {
    out.push(
      flag("zero_percent_markup", {
        markup: formatTenge(a.markup),
        pct: formatNumber((a.markup / a.base) * 100),
      }),
    );
  }

  // daily_rate_masking
  if (p.dailyRate != null && p.dailyRate > 0) {
    out.push(flag("daily_rate_masking", { daily: formatNumber(p.dailyRate, 2), annual: formatNumber(dailyToAnnual(p.dailyRate)) }));
  }

  // debt_burden_high
  if (p.monthlyIncome != null && p.monthlyIncome > 0) {
    const share = (a.firstPaymentTotal / toTiyn(p.monthlyIncome)) * 100;
    if (share >= THRESHOLDS.debtBurden.yellowMax) out.push(flag("debt_burden_high", { share: formatNumber(share, 0) }));
  }

  // stated_mismatch
  if (p.statedMonthlyPayment != null && p.statedMonthlyPayment > 0) {
    const stated = toTiyn(p.statedMonthlyPayment);
    const diff = (x: number) => Math.abs(stated - x) / x;
    const tol = THRESHOLDS.statedPaymentTolerancePct / 100;
    if (diff(a.firstPayment) > tol && diff(a.firstPaymentTotal) > tol) {
      out.push(
        flag("stated_mismatch", {
          stated: formatTenge(stated),
          calc: formatTenge(a.firstPaymentTotal),
        }),
      );
    }
  }
  if (
    !out.some((f) => f.id === "stated_mismatch") &&
    p.statedEffectiveRate != null &&
    eff != null &&
    eff - p.statedEffectiveRate > THRESHOLDS.statedEffectiveTolerancePp
  ) {
    out.push(
      flag("stated_mismatch", {
        stated: `${formatNumber(p.statedEffectiveRate)}%`,
        calc: `${formatNumber(eff)}%`,
      }),
    );
  }
  return out;
}
