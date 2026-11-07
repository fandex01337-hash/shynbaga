"use client";

import { HELP_RESOURCES } from "@/lib/config/resources";
import { useI18n } from "@/lib/i18n/context";
import { Card, SectionTitle } from "./ui";

export function HelpSection() {
  const { t } = useI18n();
  return (
    <Card>
      <SectionTitle>{t("help.title")}</SectionTitle>
      <ul className="space-y-3">
        {HELP_RESOURCES.map((r) => (
          <li key={r.id} className="rounded-xl border border-slate-200 p-3">
            <div className="font-semibold">{t(r.titleKey)}</div>
            <p className="text-slate-700">{t(r.descKey)}</p>
            {r.url && (
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">
                {r.url}
              </a>
            )}
            {r.phone && <div className="font-semibold">☎ {r.phone}</div>}
            {!r.verifiedAt && <p className="mt-1 text-xs text-amber-800">{t("help.unverified")}</p>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
