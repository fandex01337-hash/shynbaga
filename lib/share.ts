import { formatNumber, formatPercent, formatTenge } from "@/lib/finance/money";
import type { Analysis } from "@/lib/finance/types";
import type { Flag } from "@/lib/flags/taxonomy";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Короткий итог для мессенджера. Только цифры движка и названия флагов, без документа. */
export function buildShareText(t: T, a: Analysis, flags: Flag[]): string {
  const lines = [
    t("share.header"),
    `${t("truth.take")}: ${formatTenge(a.handed)}`,
    `${t("truth.give")}: ${formatTenge(a.totalPaid)}`,
    `${t("truth.overpay")}: ${formatTenge(a.overpay)} (+${formatPercent(a.overpayPct, 0)})`,
  ];
  if (a.effectiveRateAnnual != null) lines.push(`${t("truth.effective")}: ${formatNumber(a.effectiveRateAnnual)}% ${t("unit.per_year")}`);
  if (flags.length) lines.push(`${t("flags.title")}: ${flags.map((f) => t(`flag.${f.id}.title`)).join("; ")}`);
  lines.push(t("share.footer"));
  return lines.join("\n");
}
