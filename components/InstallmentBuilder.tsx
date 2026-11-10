"use client";

import { Car, Download, Home, Laptop, Package, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  buildInstallmentContract,
  calcInstallment,
  contractToWordBlob,
  defaultInput,
  KIND_LABEL,
  money,
  type InstallmentInput,
  type ObjectKind,
} from "@/lib/installment";
import { Button, Card } from "./ui";

const KINDS: { id: ObjectKind; label: string; Icon: typeof Home }[] = [
  { id: "house", label: "Дом / квартира", Icon: Home },
  { id: "car", label: "Машина", Icon: Car },
  { id: "tech", label: "Техника", Icon: Laptop },
  { id: "other", label: "Другое", Icon: Package },
];

const field = "w-full rounded-xl border border-slate-300 p-3 text-base";

export function InstallmentBuilder({ onAnalyze, onClose }: { onAnalyze: (v: InstallmentInput) => void; onClose: () => void }) {
  const [v, setV] = useState<InstallmentInput>(defaultInput());
  const set = <K extends keyof InstallmentInput>(k: K, val: InstallmentInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const calc = useMemo(() => calcInstallment(v), [v]);
  const text = useMemo(() => (typeof calc === "string" ? null : buildInstallmentContract(v)), [v, calc]);

  const num = (k: "price" | "downPayment" | "termMonths" | "markupPct" | "penaltyPctPerDay", label: string, step = 1) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input type="number" inputMode="decimal" min={0} step={step} className={field} value={Number.isFinite(v[k]) ? v[k] : ""} onChange={(e) => set(k, e.target.valueAsNumber)} />
    </label>
  );
  const str = (k: "objectName" | "seller" | "buyer" | "city", label: string, ph?: string) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input className={field} value={v[k]} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
    </label>
  );

  const download = () => {
    if (!text) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(contractToWordBlob(text));
    a.download = `dogovor-rassrochki-${v.kind}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">Договор покупки в рассрочку</h2>
        <button type="button" aria-label="Закрыть" onClick={onClose} className="min-h-11 min-w-11 rounded-lg hover:bg-slate-100">
          <X aria-hidden className="mx-auto" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Что покупаете">
        {KINDS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={v.kind === id}
            onClick={() => setV((p) => ({ ...defaultInput(id), seller: p.seller, buyer: p.buyer, city: p.city }))}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-2 font-semibold ${v.kind === id ? "border-blue-700 bg-blue-50 text-blue-900" : "border-slate-200 bg-white"}`}
          >
            <Icon aria-hidden size={20} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">{str("objectName", "Что покупаете (описание)", KIND_LABEL[v.kind].placeholder)}</div>
        {str("seller", "Продавец (ФИО / компания)", "можно оставить пустым")}
        {str("buyer", "Покупатель (ФИО)", "можно оставить пустым")}
        {num("price", "Цена, тенге", 1000)}
        {num("downPayment", "Первый взнос, тенге", 1000)}
        {num("termMonths", "Срок, месяцев")}
        {num("markupPct", "Наценка за рассрочку, %", 0.5)}
        {num("penaltyPctPerDay", "Пеня за день просрочки, %", 0.05)}
        {str("city", "Город")}
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" className="h-5 w-5" checked={v.earlyAllowed} onChange={(e) => set("earlyAllowed", e.target.checked)} />
          Можно погасить досрочно без штрафа
        </label>
      </div>

      {typeof calc === "string" ? (
        <p role="alert" className="mt-4 rounded-xl border-2 border-red-600 bg-red-50 p-3 font-medium text-red-900">✕ {calc}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4">
          <div><div className="text-slate-600">В рассрочку</div><b>{money(calc.rest)}</b></div>
          <div><div className="text-slate-600">Платёж в месяц</div><b>{money(calc.monthly)}</b></div>
          <div><div className="text-slate-600">Переплата</div><b className={calc.overpay > 0 ? "text-red-700" : "text-green-700"}>{money(calc.overpay)}</b></div>
          <div><div className="text-slate-600">Всего заплатите</div><b>{money(calc.totalToPay)}</b></div>
        </div>
      )}

      {text && (
        <>
          <article className="mt-4 max-h-[24rem] overflow-auto whitespace-pre-wrap rounded-md border border-slate-300 bg-[#fffdf7] px-5 py-6 font-serif text-[15px] leading-relaxed text-slate-900 shadow-md">
            {text}
          </article>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button onClick={download}>
              <Download aria-hidden size={18} /> Скачать Word
            </Button>
            <Button variant="secondary" onClick={() => onAnalyze(v)}>
              <Search aria-hidden size={18} /> Проверить этот договор
            </Button>
          </div>
          <p className="mt-3 text-sm text-slate-600">Шаблон для ориентира, не юридическая консультация. Сделку с домом заверяет нотариус.</p>
        </>
      )}
    </Card>
  );
}
