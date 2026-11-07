import { toTiyn } from "./money";
import type { LoanParams, ResolvedCosts, ScheduleInput, ScheduleRow } from "./types";

/**
 * Переводит комиссии и страховку из формы в тиыны по категориям.
 * Проценты считаются от суммы кредита; для ежемесячных — % от суммы кредита в месяц.
 */
export function resolveCosts(p: LoanParams): ResolvedCosts {
  const principal = p.principal ?? 0;
  const amountOf = (amount: number | null, percent: number | null): number => {
    if (amount != null && amount > 0) return toTiyn(amount);
    if (percent != null && percent > 0) return toTiyn((principal * percent) / 100);
    return 0;
  };
  const c: ResolvedCosts = {
    feeDeducted: 0,
    feePaid: 0,
    feeMonthly: 0,
    insDeducted: 0,
    insPaid: 0,
    insMonthly: 0,
    insFinanced: 0,
  };
  for (const f of p.fees) {
    const v = amountOf(f.amount, f.percent);
    if (f.kind === "upfront_deducted") c.feeDeducted += v;
    else if (f.kind === "upfront_paid") c.feePaid += v;
    else c.feeMonthly += v;
  }
  if (p.insurance.present) {
    const v = amountOf(p.insurance.amount, p.insurance.percent);
    switch (p.insurance.mode) {
      case "monthly":
        c.insMonthly += v;
        break;
      case "upfront_deducted":
        c.insDeducted += v;
        break;
      case "upfront_paid":
        c.insPaid += v;
        break;
      case "financed":
        c.insFinanced += v;
        break;
    }
  }
  return c;
}

/** Аннуитетный платёж в тиынах (не округлён). */
export function annuityPayment(loan: number, rateAnnualPct: number, n: number): number {
  const r = rateAnnualPct / 100 / 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - Math.pow(1 + r, -n));
}

/**
 * График платежей. extra — добавка к платежу каждый месяц (досрочное погашение).
 * Последний платёж закрывает остаток, поэтому накопленная ошибка округления не копится.
 */
export function buildSchedule(inp: ScheduleInput, extra = 0): ScheduleRow[] {
  const { loan, termMonths: n, rateAnnual, paymentType } = inp;
  const r = rateAnnual / 100 / 12;
  const annuityT = Math.round(annuityPayment(loan, rateAnnual, n));
  const diffPrincipal = Math.round(loan / n);
  const rows: ScheduleRow[] = [];
  let balance = loan;

  for (let m = 1; m <= n && balance > 0; m++) {
    const interest = Math.round(balance * r);
    let principalPart =
      paymentType === "annuity" ? annuityT - interest : diffPrincipal;
    principalPart += extra;
    if (m === n || principalPart >= balance) principalPart = balance;
    if (principalPart < 0) principalPart = 0;
    balance -= principalPart;
    const payment = principalPart + interest;
    rows.push({
      month: m,
      principalPart,
      interest,
      payment,
      fee: inp.monthlyFee,
      insurance: inp.monthlyIns,
      total: payment + inp.monthlyFee + inp.monthlyIns,
      balance,
    });
  }
  return rows;
}

/** Ставка (% годовых), при которой аннуитетный платёж равен заданному. null — не нашлась. */
export function impliedAnnualRate(loan: number, n: number, payment: number): number | null {
  if (loan <= 0 || n < 1 || payment <= 0) return null;
  if (payment * n <= loan) return payment * n === loan ? 0 : null;
  let lo = 0;
  let hi = 1; // месячная ставка
  while (annuityPayment(loan, hi * 1200, n) < payment && hi < 1e4) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (annuityPayment(loan, mid * 1200, n) < payment) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * 1200;
}
