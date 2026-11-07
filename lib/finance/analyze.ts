import { effectiveAnnualRate } from "./effectiveRate";
import { dailyToAnnual, toTiyn } from "./money";
import { buildSchedule, impliedAnnualRate, resolveCosts } from "./schedule";
import type { Analysis, AnalysisError, LoanParams, RateSource } from "./types";

export const MAX_TERM_MONTHS = 600;

/**
 * Главная точка входа движка: параметры → полный разбор стоимости кредита.
 * Ставка берётся по приоритету: номинальная → дневная×365 → выведенная из заявленного платежа → 0 (рассрочка с наценкой).
 */
export function analyze(p: LoanParams): Analysis | AnalysisError {
  if (p.principal == null || !(p.principal > 0)) return { ok: false, error: "principal" };
  const n = p.termMonths;
  if (n == null || !Number.isInteger(n) || n < 1 || n > MAX_TERM_MONTHS) return { ok: false, error: "term" };

  const principalT = toTiyn(p.principal);
  const costs = resolveCosts(p);
  const hasCashPrice = p.cashPrice != null && p.cashPrice > 0 && p.cashPrice <= p.principal;
  const baseT = hasCashPrice ? toTiyn(p.cashPrice as number) : principalT;
  const loanT = principalT + costs.insFinanced;

  let rate: number;
  let rateSource: RateSource;
  if (p.nominalRateAnnual != null && p.nominalRateAnnual >= 0) {
    rate = p.nominalRateAnnual;
    rateSource = "nominal";
  } else if (p.dailyRate != null && p.dailyRate >= 0) {
    rate = dailyToAnnual(p.dailyRate);
    rateSource = "daily";
  } else if (p.statedMonthlyPayment != null && p.paymentType === "annuity") {
    const implied = impliedAnnualRate(loanT, n, toTiyn(p.statedMonthlyPayment));
    if (implied == null) return { ok: false, error: "rate" };
    rate = implied;
    rateSource = "implied_from_payment";
  } else if (hasCashPrice) {
    rate = 0;
    rateSource = "zero";
  } else {
    return { ok: false, error: "rate" };
  }

  const scheduleInput = {
    loan: loanT,
    termMonths: n,
    rateAnnual: rate,
    paymentType: p.paymentType,
    monthlyFee: costs.feeMonthly,
    monthlyIns: costs.insMonthly,
  };
  const schedule = buildSchedule(scheduleInput);

  let sumPay = 0;
  let sumInterest = 0;
  let sumFee = 0;
  let sumIns = 0;
  for (const row of schedule) {
    sumPay += row.payment;
    sumInterest += row.interest;
    sumFee += row.fee;
    sumIns += row.insurance;
  }

  const handed = baseT - costs.feeDeducted - costs.insDeducted;
  const totalPaid = sumPay + sumFee + sumIns + costs.feePaid + costs.insPaid;
  const overpay = totalPaid - handed;
  const markup = hasCashPrice ? principalT - baseT : 0;

  const flows = [handed - costs.feePaid - costs.insPaid];
  for (const row of schedule) flows.push(-row.total);
  const effectiveRateAnnual = effectiveAnnualRate(flows);

  const days = (schedule.length * 365) / 12;

  return {
    ok: true,
    termMonths: n,
    rateAnnualUsed: rate,
    rateSource,
    costs,
    scheduleInput,
    schedule,
    base: baseT,
    handed,
    totalPaid,
    overpay,
    overpayPct: handed > 0 ? (overpay / handed) * 100 : 0,
    effectiveRateAnnual,
    firstPayment: schedule[0].payment,
    firstPaymentTotal: schedule[0].total,
    breakdown: {
      body: handed,
      interest: sumInterest + markup,
      fees: costs.feeDeducted + costs.feePaid + sumFee,
      insurance: costs.insDeducted + costs.insPaid + sumIns + costs.insFinanced,
    },
    priceMultiple: handed > 0 ? totalPaid / handed : 0,
    costPerDay: days > 0 ? overpay / days : 0,
    markup,
  };
}
