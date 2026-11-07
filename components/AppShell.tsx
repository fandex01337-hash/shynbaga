"use client";

import { ArrowLeft, Loader2, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { burdenZone } from "@/lib/config/thresholds";
import type { Extraction } from "@/lib/extraction/schema";
import { analyze } from "@/lib/finance/analyze";
import type { LoanParams } from "@/lib/finance/types";
import { evaluateEngineFlags } from "@/lib/flags/rules";
import { mergeFlags } from "@/lib/flags/taxonomy";
import { emptyParams, extractionToMeta, extractionToParams, manualMeta, type ExtractionMeta } from "@/lib/form";
import { prepareImage, preparePdf } from "@/lib/clientFiles";
import { useI18n } from "@/lib/i18n/context";
import { buildShareText } from "@/lib/share";
import { toTiyn } from "@/lib/finance/money";
import { BankQuestions } from "./BankQuestions";
import { HelpSection } from "./HelpSection";
import { HumanFacts } from "./HumanFacts";
import { InputPanel, type InputHandlers } from "./InputPanel";
import { MoneyBreakdown } from "./MoneyBreakdown";
import { ParamsReviewForm } from "./ParamsReviewForm";
import { RedFlags, ScamBanner } from "./RedFlags";
import { SampleContract } from "./SampleContract";
import { ScenarioSliders } from "./ScenarioSliders";
import { ScheduleChart } from "./ScheduleChart";
import { TruthPriceTag } from "./TruthPriceTag";
import { Button, Card } from "./ui";

type Stage = "input" | "review" | "result";
interface ExtractResponse {
  ok: boolean;
  code?: string;
  via?: ExtractionMeta["via"];
  extraction?: Extraction;
  quotesVerified?: Record<string, boolean> | null;
}

export function AppShell() {
  const { t, lang, setLang } = useI18n();
  const [stage, setStage] = useState<Stage>("input");
  const [params, setParams] = useState<LoanParams>(emptyParams());
  const [meta, setMeta] = useState<ExtractionMeta>(manualMeta());
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [llm, setLlm] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<{ verdict: string; questions: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sample, setSample] = useState<{ text: string; via: "llm" | "fixture" } | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/extract")
      .then((r) => r.json())
      // Пресеты работают и без ключа (фолбэк), поэтому «LLM есть» — только про реальный ключ
      .then((j: { llm: boolean }) => setLlm(j.llm))
      .catch(() => setLlm(false));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 2200);
    return () => clearInterval(id);
  }, [busy]);

  const runExtract = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setStep(0);
      setError(null);
      try {
        let res: Response;
        try {
          res = await fetch("/api/extract", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...body, lang }),
            signal: AbortSignal.timeout(65_000),
          });
        } catch {
          setError(t("err.network"));
          return;
        }
        // Сервер ответил, но не JSON-ом — это сбой сервера, а не отсутствие интернета
        const json = (await res.json().catch(() => null)) as ExtractResponse | null;
        if (!json) {
          setError(t("err.server_error"));
          return;
        }
        if (!json.ok || !json.extraction) {
          setError(t(`err.${json.code ?? "llm_unavailable"}`));
          return;
        }
        const ex = json.extraction;
        const m = extractionToMeta(ex, json.via ?? "llm", json.quotesVerified ?? null);
        setMeta(m);
        setParams(extractionToParams(ex));
        setFormKey((k) => k + 1);
        setSummary(null);
        const isScam = ex.productType === "scam_suspected" || ex.redFlags.some((f) => f.id === "upfront_payment_scam");
        setStage(isScam ? "result" : "review");
      } finally {
        setBusy(false);
      }
    },
    [lang, t],
  );

  const generateSample = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/sample", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang }),
        signal: AbortSignal.timeout(40_000),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; code?: string; via?: "llm" | "fixture"; text?: string } | null;
      if (!json?.ok || !json.text) {
        setError(t(json?.code ? `err.${json.code}` : "err.server_error"));
        return;
      }
      setSample({ text: json.text, via: json.via ?? "fixture" });
    } catch {
      setError(t("err.network"));
    } finally {
      setGenerating(false);
    }
  }, [lang, t]);

  const handlers: InputHandlers = {
    onGenerate: () => void generateSample(),
    onText: (text, presetId) => void runExtract({ text, presetId }),
    onImage: async (file) => {
      try {
        const image = await prepareImage(file);
        await runExtract({ image });
      } catch (e) {
        setError(t(e instanceof Error && e.message === "image_too_large" ? "err.too_large" : "err.image"));
      }
    },
    onPdf: async (file) => {
      try {
        const pdf = await preparePdf(file);
        await runExtract({ pdf });
      } catch {
        setError(t("err.pdf_too_large"));
      }
    },
    onManual: () => {
      setParams(emptyParams());
      setMeta(manualMeta());
      setFormKey((k) => k + 1);
      setCalcError(null);
      setError(null);
      setStage("review");
    },
  };

  const analysis = useMemo(() => (stage === "result" ? analyze(params) : null), [stage, params]);
  const flags = useMemo(() => {
    const engine = analysis && analysis.ok ? evaluateEngineFlags(params, analysis) : [];
    return mergeFlags(engine, meta.llmFlags);
  }, [analysis, params, meta.llmFlags]);
  const isScam = params.productType === "scam_suspected" || flags.some((f) => f.id === "upfront_payment_scam");

  // Короткий вывод от LLM (без цифр) — необязательное улучшение, ошибки молча игнорируем
  const flagKey = flags.map((f) => f.id).join(",");
  useEffect(() => {
    if (stage !== "result" || !llm) return;
    const ctrl = new AbortController();
    const share = analysis && analysis.ok && params.monthlyIncome ? (analysis.firstPaymentTotal / toTiyn(params.monthlyIncome)) * 100 : null;
    fetch("/api/summary", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang,
        productType: params.productType,
        flagIds: flagKey ? flagKey.split(",") : [],
        missing: meta.missingInfo.slice(0, 10),
        zone: share == null ? null : burdenZone(share),
      }),
    })
      .then((r) => r.json())
      .then((j: { ok: boolean; verdict?: string; questions?: string[] }) => {
        if (j.ok && j.verdict) setSummary({ verdict: j.verdict, questions: j.questions ?? [] });
      })
      .catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, flagKey, lang, llm]);

  const submitForm = (p: LoanParams) => {
    const a = analyze(p);
    setParams(p);
    if (!a.ok) {
      setCalcError(a.error);
      return;
    }
    setCalcError(null);
    setStage("result");
    window.scrollTo({ top: 0 });
  };

  const share = async () => {
    if (!analysis || !analysis.ok) return;
    const text = buildShareText(t, analysis, flags);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* пользователь закрыл диалог — падаем на копирование */
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const steps = [t("loading.1"), t("loading.2"), t("loading.3")];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <span className="text-xl font-extrabold">
          {t("app.name")} <span className="hidden text-sm font-medium text-slate-600 sm:inline">· {t("app.tagline")}</span>
        </span>
        <div className="flex gap-1" role="group" aria-label="Language">
          {(["ru", "kk"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
              className={`min-h-11 min-w-11 rounded-lg px-3 font-bold ${lang === l ? "bg-slate-900 text-white" : "border border-slate-300 bg-white"}`}
            >
              {l === "ru" ? "РУС" : "ҚАЗ"}
            </button>
          ))}
        </div>
      </header>

      <main className="space-y-4">
        {stage === "input" && (
          <>
            <div className="py-4">
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("hero.title")}</h1>
              <p className="mt-2 text-lg text-slate-700">{t("hero.sub")}</p>
            </div>
            {busy ? (
              <Card>
                <div role="status" aria-live="polite" className="flex items-center gap-3 text-lg font-semibold">
                  <Loader2 aria-hidden className="animate-spin" /> {steps[step]}
                </div>
              </Card>
            ) : (
              <>
                {sample && (
                  <SampleContract
                    text={sample.text}
                    via={sample.via}
                    busy={busy || generating}
                    // Если ИИ недоступен, разбор тоже идёт по готовой фикстуре договора
                    onAnalyze={() => void runExtract({ text: sample.text, presetId: sample.via === "fixture" ? "contract" : undefined })}
                    onRegenerate={() => void generateSample()}
                  />
                )}
                <InputPanel handlers={handlers} busy={busy} generating={generating} llm={llm} />
              </>
            )}
            {error && (
              <p role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-3 font-medium text-red-900">
                ✕ {error}
              </p>
            )}
          </>
        )}

        {stage === "review" && (
          <>
            <Button variant="ghost" onClick={() => setStage("input")}>
              <ArrowLeft aria-hidden size={18} /> {t("nav.back")}
            </Button>
            <ParamsReviewForm key={formKey} initial={params} meta={meta} onSubmit={submitForm} error={calcError} />
          </>
        )}

        {stage === "result" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStage(meta.via === "manual" || !isScam ? "review" : "input")}>
                <ArrowLeft aria-hidden size={18} /> {isScam ? t("nav.new") : t("nav.edit")}
              </Button>
              {analysis?.ok && (
                <Button variant="secondary" onClick={share}>
                  <Share2 aria-hidden size={18} /> {copied ? t("share.copied") : t("share.button")}
                </Button>
              )}
            </div>

            {isScam && <ScamBanner />}

            {analysis?.ok ? (
              <>
                <TruthPriceTag a={analysis} />
                <HumanFacts p={params} a={analysis} />
                <RedFlags flags={flags} />
                <MoneyBreakdown a={analysis} />
                <ScheduleChart a={analysis} />
                <ScenarioSliders p={params} a={analysis} />
              </>
            ) : (
              <RedFlags flags={flags} />
            )}

            <BankQuestions p={params} flags={flags} earlyAllowed={meta.earlyRepayment.allowed} extra={summary?.questions ?? []} verdict={summary?.verdict ?? null} />
            {(isScam || flags.some((f) => f.id === "debt_burden_high")) && <HelpSection />}

            <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{t("disclaimer")}</p>
          </>
        )}
      </main>
    </div>
  );
}
