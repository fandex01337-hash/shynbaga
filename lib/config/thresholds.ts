/**
 * Пороги эвристик приложения. Это НЕ законодательные лимиты.
 * Законодательные нормы (предельные ставки, пени, долговая нагрузка) не хардкодим: если понадобятся —
 * добавлять сюда с полями `source` и `checkedAt` и сверять с официальными источниками.
 */
export const THRESHOLDS = {
  /** Платёж как % месячного дохода: до greenMax — зелёная зона, до yellowMax — жёлтая, выше — красная */
  debtBurden: { greenMax: 30, yellowMax: 50 },
  /** rate_gap: эффективная ставка выше заявленной больше чем на N процентных пунктов */
  rateGapPp: 5,
  /** stated_mismatch: допуск расхождения заявленного платежа, % */
  statedPaymentTolerancePct: 3,
  /** stated_mismatch: заявленная ГЭСВ ниже нашей оценки больше чем на N п.п. */
  statedEffectiveTolerancePp: 2,
  /** zero_percent_markup: наценка меньше N % цены сразу не считаем */
  priceMarkupTolerancePct: 0.5,
} as const;

export const LIMITS = {
  maxTextChars: 15_000,
  /** base64-длина фото ≈ 5 МБ бинарных данных */
  maxImageBase64Chars: 6_990_000,
  maxImageBytes: 5 * 1024 * 1024,
  maxPdfBytes: 10 * 1024 * 1024,
  maxPdfBase64Chars: 14_000_000,
  maxPdfPages: 10,
  llmTimeoutMs: 25_000,
  cacheSize: 100,
} as const;

export type Zone = "green" | "yellow" | "red";

export function burdenZone(sharePct: number): Zone {
  if (sharePct < THRESHOLDS.debtBurden.greenMax) return "green";
  if (sharePct < THRESHOLDS.debtBurden.yellowMax) return "yellow";
  return "red";
}
