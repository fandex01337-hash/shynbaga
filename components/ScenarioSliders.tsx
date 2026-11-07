"use client";

import { useMemo, useState } from "react";
import { formatTenge } from "@/lib/finance/money";
import { earlyRepayment, latePenalty } from "@/lib/finance/scenarios";
import type { Analysis, LoanParams } from "@/lib/finance/types";
import { useI18n } from "@/lib/i18n/context";
import { Card, SectionTitle } from "./ui";

export function ScenarioSliders({ p, a }: { p: LoanParams; a: Analysis }) {
  const { t } = useI18n();
  const [extra, setExtra] = useState(0);
  const [days, setDays] = useState(30);

  // Шаг и максимум привязаны к размеру платежа: ползунок имеет смысл для любого кредита
  const step = Math.max(1000, Math.round(a.firstPaymentTotal / 100 / 20 / 1000) * 1000);
  const max = step * 20;

  const early = useMemo(() => earlyRepayment(a, extra), [a, extra]);
  const late = useMemo(() => latePenalty(p, a, days), [p, a, days]);

  return (
    <Card>
      <SectionTitle>{t("scen.title")}</SectionTitle>

      <div>
        <label htmlFor="extra" className="block font-semibold">
          {t("scen.early_label", { sum: formatTenge(extra * 100) })}
        </label>
        <input id="extra" type="range" min={0} max={max} step={step} value={extra} onChange={(e) => setExtra(Number(e.target.value))} className="mt-2 h-8 w-full accent-blue-700" />
        <p aria-live="polite" className="mt-1 rounded-lg bg-green-50 p-3 text-lg font-semibold text-green-900">
          {extra === 0
            ? t("scen.early_hint")
            : t("scen.early_result", { saved: formatTenge(early.saved), months: early.monthsSaved })}
        </p>
      </div>

      <div className="mt-6">
        <label htmlFor="days" className="block font-semibold">
          {t("scen.late_label", { d: days })}
        </label>
        <input id="days" type="range" min={1} max={90} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-2 h-8 w-full accent-red-700" />
        <p aria-live="polite" className="mt-1 rounded-lg bg-red-50 p-3 text-lg font-semibold text-red-900">
          {late.hasPenaltyTerms ? t("scen.late_result", { d: days, sum: formatTenge(late.total) }) : t("scen.late_unknown")}
        </p>
        {late.hasPenaltyTerms && <p className="mt-1 text-xs text-slate-600">{t("scen.late_assumption")}</p>}
      </div>
    </Card>
  );
}
