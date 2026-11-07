"use client";

import { MessageCircleQuestion } from "lucide-react";
import { bankQuestionKeys } from "@/lib/bankQuestions";
import type { LoanParams } from "@/lib/finance/types";
import type { Flag } from "@/lib/flags/taxonomy";
import { useI18n } from "@/lib/i18n/context";
import { Card, SectionTitle } from "./ui";

export function BankQuestions({
  p,
  flags,
  earlyAllowed,
  extra,
  verdict,
}: {
  p: LoanParams;
  flags: Flag[];
  earlyAllowed: boolean | null;
  /** дополнительные вопросы от LLM (без цифр) */
  extra: string[];
  verdict: string | null;
}) {
  const { t } = useI18n();
  const keys = bankQuestionKeys(p, flags, earlyAllowed);
  return (
    <Card>
      <SectionTitle>{t("questions.title")}</SectionTitle>
      {verdict && <p className="mb-3 rounded-lg bg-blue-50 p-3 text-slate-900">💬 {verdict}</p>}
      <ul className="space-y-2">
        {keys.map((k) => (
          <li key={k} className="flex gap-2">
            <MessageCircleQuestion aria-hidden size={20} className="mt-0.5 shrink-0 text-blue-700" />
            {t(k)}
          </li>
        ))}
        {extra.map((q) => (
          <li key={q} className="flex gap-2">
            <MessageCircleQuestion aria-hidden size={20} className="mt-0.5 shrink-0 text-blue-700" />
            {q}
          </li>
        ))}
      </ul>
    </Card>
  );
}
