"use client";

import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Flag, Severity } from "@/lib/flags/taxonomy";
import { useI18n } from "@/lib/i18n/context";
import { Card, SectionTitle } from "./ui";

const SEV: Record<Severity, string> = {
  critical: "border-red-700 bg-red-50",
  high: "border-red-400 bg-red-50/60",
  medium: "border-amber-400 bg-amber-50",
};

export function ScamBanner() {
  const { t } = useI18n();
  return (
    <div role="alert" className="rounded-2xl border-4 border-red-700 bg-red-700 p-5 text-white">
      <div className="flex items-center gap-3 text-2xl font-extrabold">
        <ShieldAlert aria-hidden size={36} /> {t("scam.title")}
      </div>
      <p className="mt-2 text-lg">{t("scam.body")}</p>
      <ul className="mt-2 list-disc pl-5 text-base">
        <li>{t("scam.tip1")}</li>
        <li>{t("scam.tip2")}</li>
        <li>{t("scam.tip3")}</li>
      </ul>
    </div>
  );
}

export function RedFlags({ flags }: { flags: Flag[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <SectionTitle>{t("flags.title")}</SectionTitle>
      {flags.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border-2 border-green-600 bg-green-50 p-3 font-medium text-green-900">
          <ShieldCheck aria-hidden size={22} /> {t("flags.none")}
        </p>
      ) : (
        <ul className="space-y-3">
          {flags.map((f) => (
            <li key={f.id} className={`rounded-xl border-2 p-3 ${SEV[f.severity]}`}>
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle aria-hidden size={20} className={f.severity === "medium" ? "text-amber-700" : "text-red-700"} />
                {t(`flag.${f.id}.title`)}
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">{t(`sev.${f.severity}`)}</span>
              </div>
              <p className="mt-1 text-slate-800">{f.explanation ?? t(`flag.${f.id}.expl`, f.vars)}</p>
              {f.quote && (
                <p className="mt-1 text-sm text-slate-700">
                  ❝ <q>{f.quote}</q>
                  {f.vars?.unverified ? <span className="ml-1 font-medium text-red-700">({t("form.quote_unverified")})</span> : null}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
