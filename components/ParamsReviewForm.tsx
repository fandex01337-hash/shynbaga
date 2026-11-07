"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ExtractionMeta } from "@/lib/form";
import { parseNum } from "@/lib/form";
import type { FeeInput, FeeKind, InsuranceMode, LoanParams, PenaltyInput } from "@/lib/finance/types";
import { useI18n } from "@/lib/i18n/context";
import { Button, Card } from "./ui";

function NumField({
  id,
  label,
  unit,
  value,
  onChange,
  quote,
  unverified,
  highlightMissing,
  hint,
}: {
  id: string;
  label: string;
  unit?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  quote?: string;
  unverified?: boolean;
  highlightMissing: boolean;
  hint?: string;
}) {
  const { t } = useI18n();
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  const missing = highlightMissing && value == null;
  return (
    <div className={`rounded-xl border p-3 ${missing ? "border-amber-400 bg-amber-50" : "border-slate-200"}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseNum(e.target.value));
          }}
          className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-lg"
        />
        {unit && <span className="text-slate-600">{unit}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-600">{hint}</p>}
      {missing && <p className="mt-1 text-sm font-medium text-amber-900">⚠ {t("form.not_in_doc")}</p>}
      {quote && (
        <p className="mt-1 text-sm text-slate-700">
          <span aria-hidden>❝ </span>
          <q>{quote}</q>
          {unverified && <span className="ml-1 font-medium text-red-700">({t("form.quote_unverified")})</span>}
        </p>
      )}
    </div>
  );
}

const FEE_KINDS: FeeKind[] = ["upfront_deducted", "upfront_paid", "monthly"];
const INS_MODES: InsuranceMode[] = ["upfront_deducted", "upfront_paid", "monthly", "financed"];

const selectCls = "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3";

export function ParamsReviewForm({
  initial,
  meta,
  onSubmit,
  error,
}: {
  initial: LoanParams;
  meta: ExtractionMeta;
  onSubmit: (p: LoanParams) => void;
  error: string | null;
}) {
  const { t } = useI18n();
  const [p, setP] = useState<LoanParams>(initial);
  const extracted = meta.via !== "manual";
  const set = <K extends keyof LoanParams>(k: K, v: LoanParams[K]) => setP((s) => ({ ...s, [k]: v }));
  const num = (id: keyof LoanParams & string, label: string, unit?: string, hint?: string): ReactNode => (
    <NumField
      id={id}
      label={label}
      unit={unit}
      hint={hint}
      value={p[id] as number | null}
      onChange={(v) => set(id, v as never)}
      quote={meta.quotes[id]}
      unverified={meta.unverified[id]}
      highlightMissing={extracted}
    />
  );

  const updateFee = (i: number, patch: Partial<FeeInput>) =>
    set("fees", p.fees.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const updatePen = (i: number, patch: Partial<PenaltyInput>) =>
    set("penalties", p.penalties.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(p);
      }}
      className="space-y-4"
    >
      <Card>
        <h2 className="text-xl font-bold">{t("form.title")}</h2>
        <p className="mt-1 text-slate-700">{extracted ? t("form.subtitle_extracted") : t("form.subtitle_manual")}</p>
        {meta.via === "fixture" && <p className="mt-2 rounded-lg bg-slate-100 p-2 text-sm">{t("form.fixture_note")}</p>}
        {meta.currency !== "KZT" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t("form.currency_warn")}</p>}
        {error && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 font-medium text-red-800">
            ✕ {t(`err.calc.${error}`)}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {num("principal", t("form.principal"), "₸", t("form.principal_hint"))}
          {num("termMonths", t("form.term"), t("unit.months"))}
          {num("nominalRateAnnual", t("form.rate"), "%")}
          {num("dailyRate", t("form.daily_rate"), "%")}
          {num("statedEffectiveRate", t("form.gesv"), "%")}
          {num("statedMonthlyPayment", t("form.stated_payment"), "₸")}
          {num("cashPrice", t("form.cash_price"), "₸", t("form.cash_price_hint"))}
          {num("monthlyIncome", t("form.income"), "₸", t("form.income_hint"))}
          <div className="rounded-xl border border-slate-200 p-3">
            <label htmlFor="paymentType" className="block text-sm font-semibold">
              {t("form.payment_type")}
            </label>
            <select
              id="paymentType"
              className={`${selectCls} mt-1`}
              value={p.paymentType}
              onChange={(e) => set("paymentType", e.target.value as LoanParams["paymentType"])}
            >
              <option value="annuity">{t("form.annuity")}</option>
              <option value="differentiated">{t("form.differentiated")}</option>
            </select>
            {meta.quotes.paymentType && <p className="mt-1 text-sm text-slate-700">❝ <q>{meta.quotes.paymentType}</q></p>}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold">{t("form.fees")}</h3>
        {p.fees.length === 0 && <p className="mt-1 text-sm text-slate-600">{extracted ? t("form.no_fees_found") : t("form.no_fees")}</p>}
        <div className="mt-3 space-y-3">
          {p.fees.map((f, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-5">
              <input
                aria-label={t("form.fee_name")}
                value={f.name}
                onChange={(e) => updateFee(i, { name: e.target.value })}
                className="min-h-11 rounded-lg border border-slate-300 px-3 sm:col-span-2"
                placeholder={t("form.fee_name")}
              />
              <select aria-label={t("form.fee_kind")} className={selectCls} value={f.kind} onChange={(e) => updateFee(i, { kind: e.target.value as FeeKind })}>
                {FEE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`fee.${k}`)}
                  </option>
                ))}
              </select>
              <input
                aria-label={`${t("form.amount")} ₸`}
                inputMode="decimal"
                defaultValue={f.amount ?? ""}
                onChange={(e) => updateFee(i, { amount: parseNum(e.target.value) })}
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                placeholder="₸"
              />
              <input
                aria-label={`${t("form.amount")} %`}
                inputMode="decimal"
                defaultValue={f.percent ?? ""}
                onChange={(e) => updateFee(i, { percent: parseNum(e.target.value) })}
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                placeholder="%"
              />
              {meta.feeQuotes[i] && <p className="text-sm text-slate-700 sm:col-span-4">❝ <q>{meta.feeQuotes[i]}</q></p>}
              <Button variant="ghost" aria-label={t("form.remove")} onClick={() => set("fees", p.fees.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden size={18} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => set("fees", [...p.fees, { name: "", kind: "upfront_deducted", amount: null, percent: null }])}
        >
          <Plus aria-hidden size={18} /> {t("form.add_fee")}
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-bold">{t("form.insurance")}</h3>
        <label className="mt-2 flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5"
            checked={p.insurance.present}
            onChange={(e) => set("insurance", { ...p.insurance, present: e.target.checked })}
          />
          {t("form.insurance_present")}
        </label>
        {p.insurance.present && (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              aria-label={`${t("form.amount")} ₸`}
              inputMode="decimal"
              defaultValue={p.insurance.amount ?? ""}
              onChange={(e) => set("insurance", { ...p.insurance, amount: parseNum(e.target.value) })}
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              placeholder="₸"
            />
            <input
              aria-label={`${t("form.amount")} %`}
              inputMode="decimal"
              defaultValue={p.insurance.percent ?? ""}
              onChange={(e) => set("insurance", { ...p.insurance, percent: parseNum(e.target.value) })}
              className="min-h-11 rounded-lg border border-slate-300 px-3"
              placeholder="%"
            />
            <select
              aria-label={t("form.insurance_mode")}
              className={selectCls}
              value={p.insurance.mode}
              onChange={(e) => set("insurance", { ...p.insurance, mode: e.target.value as InsuranceMode })}
            >
              {INS_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`ins.${m}`)}
                </option>
              ))}
            </select>
            {meta.insuranceQuote && <p className="text-sm text-slate-700 sm:col-span-3">❝ <q>{meta.insuranceQuote}</q></p>}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-bold">{t("form.penalties")}</h3>
        <div className="mt-3 space-y-3">
          {p.penalties.map((pen, i) => (
            <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-4">
              <input
                aria-label={t("form.fee_name")}
                value={pen.description}
                onChange={(e) => updatePen(i, { description: e.target.value })}
                className="min-h-11 rounded-lg border border-slate-300 px-3"
              />
              <input
                aria-label={t("form.pen_percent")}
                inputMode="decimal"
                defaultValue={pen.percentPerDay ?? ""}
                onChange={(e) => updatePen(i, { percentPerDay: parseNum(e.target.value) })}
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                placeholder={t("form.pen_percent")}
              />
              <input
                aria-label={t("form.pen_fixed")}
                inputMode="decimal"
                defaultValue={pen.fixedAmount ?? ""}
                onChange={(e) => updatePen(i, { fixedAmount: parseNum(e.target.value) })}
                className="min-h-11 rounded-lg border border-slate-300 px-3"
                placeholder={t("form.pen_fixed")}
              />
              <Button variant="ghost" aria-label={t("form.remove")} onClick={() => set("penalties", p.penalties.filter((_, j) => j !== i))}>
                <Trash2 aria-hidden size={18} />
              </Button>
              {meta.penaltyQuotes[i] && <p className="text-sm text-slate-700 sm:col-span-4">❝ <q>{meta.penaltyQuotes[i]}</q></p>}
            </div>
          ))}
        </div>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => set("penalties", [...p.penalties, { description: "", percentPerDay: null, fixedAmount: null }])}
        >
          <Plus aria-hidden size={18} /> {t("form.add_penalty")}
        </Button>
      </Card>

      <Button type="submit" className="w-full text-lg">
        {t("form.calculate")}
      </Button>
    </form>
  );
}
