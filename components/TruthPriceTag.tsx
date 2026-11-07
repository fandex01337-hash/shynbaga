"use client";

import { formatPercent, formatTenge } from "@/lib/finance/money";
import type { Analysis } from "@/lib/finance/types";
import { useI18n } from "@/lib/i18n/context";
import { Card } from "./ui";

export function TruthPriceTag({ a }: { a: Analysis }) {
  const { t } = useI18n();
  const eff = a.effectiveRateAnnual;
  return (
    <Card className="border-2 border-slate-900">
      <h2 className="text-center text-sm font-bold uppercase tracking-wide text-slate-600">{t("truth.title")}</h2>
      <div className="mt-4 grid gap-4 text-center sm:grid-cols-3">
        <div>
          <div className="text-sm font-medium text-slate-700">{t("truth.take")}</div>
          <div className="text-3xl font-extrabold text-slate-900 sm:text-4xl">{formatTenge(a.handed)}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-slate-700">{t("truth.give")}</div>
          <div className="text-3xl font-extrabold text-slate-900 sm:text-4xl">{formatTenge(a.totalPaid)}</div>
        </div>
        <div className="rounded-xl bg-red-50 p-2">
          <div className="text-sm font-medium text-red-900">{t("truth.overpay")}</div>
          <div className="text-3xl font-extrabold text-red-800 sm:text-4xl">{formatTenge(a.overpay)}</div>
          <div className="text-lg font-bold text-red-800">+{formatPercent(a.overpayPct, 0)}</div>
        </div>
      </div>
      {eff != null && (
        <p className="mt-4 text-center text-lg">
          {t("truth.effective")}: <strong className="text-2xl">{formatPercent(eff)}</strong> {t("unit.per_year")}
        </p>
      )}
      <p className="mt-1 text-center text-sm text-slate-600">
        {t(`rate_source.${a.rateSource}`, { rate: formatPercent(a.rateAnnualUsed) })}
      </p>
    </Card>
  );
}
