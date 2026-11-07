"use client";

import { Bot, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "./ui";

/** Договор как документ: серифный шрифт, «бумага», заголовки разделов. Текст «печатается» за ~1,5 с. */
export function SampleContract({
  text,
  via,
  busy,
  onAnalyze,
  onRegenerate,
}: {
  text: string;
  via: "llm" | "fixture";
  busy: boolean;
  onAnalyze: () => void;
  onRegenerate: () => void;
}) {
  const { t } = useI18n();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const step = Math.max(8, Math.ceil(text.length / 70));
    const id = setInterval(() => setShown((n) => (n >= text.length ? (clearInterval(id), n) : n + step)), 22);
    return () => clearInterval(id);
  }, [text]);

  const done = shown >= text.length;
  const lines = text.slice(0, shown).split("\n");

  return (
    <section aria-label={t("sample.title")} className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-900">
        {via === "llm" ? <Bot aria-hidden size={18} /> : <FileText aria-hidden size={18} />}
        {via === "llm" ? t("sample.badge_llm") : t("sample.badge_fixture")}
      </div>

      <article
        aria-busy={!done}
        className="max-h-[26rem] overflow-auto rounded-md border border-slate-300 bg-[#fffdf7] px-5 py-6 font-serif text-[15px] leading-relaxed text-slate-900 shadow-md sm:px-8"
      >
        {lines.map((line, i) => {
          if (i === 0) return <h3 key={i} className="mb-3 text-center text-base font-bold uppercase tracking-wide">{line}</h3>;
          if (/^\d+\.\s/.test(line)) return <h4 key={i} className="mb-1 mt-4 font-bold">{line}</h4>;
          if (line.trim() === "") return null;
          return <p key={i} className="mb-1">{line}{i === lines.length - 1 && !done && <span aria-hidden className="ml-0.5 animate-pulse">▍</span>}</p>;
        })}
      </article>

      <div className="mt-3 flex flex-wrap gap-3">
        <Button disabled={busy || !done} onClick={onAnalyze}>
          {t("sample.analyze")}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onRegenerate}>
          <RefreshCw aria-hidden size={18} /> {t("sample.regenerate")}
        </Button>
      </div>
    </section>
  );
}
