/** Деньги внутри движка — целые тиыны (1 ₸ = 100 тиын). Float используется только для ставок. */
export const toTiyn = (tenge: number): number => Math.round(tenge * 100);
export const fromTiyn = (tiyn: number): number => tiyn / 100;

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("ru-RU", { minimumFractionDigits: min, maximumFractionDigits: max });

const f0 = nf(0, 0);
const f2 = nf(2, 2);

export function formatTenge(tiyn: number, opts: { decimals?: boolean } = {}): string {
  const v = tiyn / 100;
  return `${(opts.decimals ? f2 : f0).format(v)} ₸`;
}

export function formatNumber(v: number, digits = 1): string {
  return nf(0, digits).format(v);
}

export function formatPercent(v: number, digits = 1): string {
  return `${nf(0, digits).format(v)}%`;
}

/** Ставка в день (%) → простая годовая (%): ×365. */
export const dailyToAnnual = (dailyPct: number): number => dailyPct * 365;
export const annualToDaily = (annualPct: number): number => annualPct / 365;
