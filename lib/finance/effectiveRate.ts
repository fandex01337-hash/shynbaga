/** Чистая приведённая стоимость потоков по месячной ставке r (flows[0] — в момент выдачи). */
export function npv(flows: number[], r: number): number {
  let sum = 0;
  for (let t = 0; t < flows.length; t++) sum += flows[t] / Math.pow(1 + r, t);
  return sum;
}

/**
 * Месячная IRR методом бисекции (он не расходится, в отличие от Ньютона на «плохих» потоках).
 * Ожидается: flows[0] > 0 (получено на руки), дальше отрицательные платежи.
 * Если платежи в сумме не превышают полученное — ставка 0.
 */
export function irrMonthly(flows: number[]): number | null {
  if (flows.length < 2 || flows[0] <= 0) return null;
  if (!flows.slice(1).some((f) => f < 0)) return null;
  const total = flows.reduce((a, b) => a + b, 0);
  if (total >= 0) return 0;

  let lo = 0;
  let hi = 1;
  let guard = 0;
  while (npv(flows, hi) < 0 && guard++ < 40) hi *= 2;
  if (npv(flows, hi) < 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    // NPV растёт с ростом ставки: отрицательный NPV → корень правее
    if (npv(flows, mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Годовая эффективная ставка в % из месячной: (1+irr)^12 − 1. */
export function annualizeMonthly(irr: number): number {
  return (Math.pow(1 + irr, 12) - 1) * 100;
}

export function effectiveAnnualRate(flows: number[]): number | null {
  const irr = irrMonthly(flows);
  return irr == null ? null : annualizeMonthly(irr);
}
