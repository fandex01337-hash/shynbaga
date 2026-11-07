"use client";

import { AlertTriangle, CheckCircle2, XOctagon } from "lucide-react";
import type { ReactNode } from "react";
import type { Zone } from "@/lib/config/thresholds";
import { formatNumber, formatPercent, formatTenge } from "@/lib/finance/money";
import type { Analysis, LoanParams } from "@/lib/finance/types";
import { humanFacts } from "@/lib/humanFacts";
import { useI18n } from "@/lib/i18n/context";
import { Card, SectionTitle } from "./ui";

const ZONE_STYLE: Record<Zone, { cls: string; icon: ReactNode }> = {
  green: { cls: "border-green-600 bg-green-50 text-green-900", icon: <CheckCircle2 aria-hidden size={22} /> },
  yellow: { cls: "border-amber-500 bg-amber-50 text-amber-900", icon: <AlertTriangle aria-hidden size={22} /> },
  red: { cls: "border-red-600 bg-red-50 text-red-900", icon: <XOctagon aria-hidden size={22} /> },
};

function Fact({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${className || "border-slate-200"}`}>
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-lg font-semibold leading-snug text-slate-900">{children}</div>
    </div>
  );
}

export function HumanFacts({ p, a }: { p: LoanParams; a: Analysis }) {
  const { t } = useI18n();
  const f = humanFacts(p, a);
  return (
    <Card>
      <SectionTitle>{t("human.title")}</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {f.overpayMonthsOfIncome != null ? (
          <Fact title={t("human.overpay_title")}>{t("human.overpay", { n: formatNumber(f.overpayMonthsOfIncome, 1) })}</Fact>
        ) : (
          <Fact title={t("human.overpay_title")}>
            <span className="text-base font-normal text-slate-700">{t("human.need_income")}</span>
          </Fact>
        )}

        {f.burden && (
          <Fact title={t("human.burden_title")} className={ZONE_STYLE[f.burden.zone].cls}>
            <span className="flex items-start gap-2">
              {ZONE_STYLE[f.burden.zone].icon}
              <span>
                {t("human.burden", { pct: formatNumber(f.burden.sharePct, 0) })} <strong>{t(`zone.${f.burden.zone}`)}</strong>
              </span>
            </span>
          </Fact>
        )}

        <Fact title={t("human.multiple_title")}>{t("human.multiple", { n: formatNumber(f.priceMultiple, 2) })}</Fact>

        {f.rate && (
          <Fact title={t("human.rate_title")}>
            {f.rate.kind === "daily_to_annual"
              ? t("human.rate_daily", { d: formatNumber(f.rate.daily, 2), y: formatNumber(f.rate.annual, 1) })
              : t("human.rate_eff", { y: formatNumber(f.rate.annual, 1), d: formatNumber(f.rate.daily, 2) })}
          </Fact>
        )}

        {f.saveMonths != null && (
          <Fact title={t("human.save_title")}>
            {t("human.save", { k: f.saveMonths, sum: formatTenge(a.base), pay: formatTenge(a.firstPaymentTotal) })}
          </Fact>
        )}

        <Fact title={t("human.day_title")}>{t("human.day", { d: formatTenge(f.costPerDayTiyn) })}</Fact>
      </div>
      <p className="mt-3 text-xs text-slate-600">{t("human.note", { pct: formatPercent(a.overpayPct, 0) })}</p>
    </Card>
  );
}
