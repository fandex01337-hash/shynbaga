import type { LoanParams } from "@/lib/finance/types";
import { emptyParams } from "@/lib/form";

/** Конструктор договора купли-продажи в рассрочку (дом, машина, техника, другое). Всё считается локально. */

export type ObjectKind = "house" | "car" | "tech" | "other";

export interface InstallmentInput {
  kind: ObjectKind;
  objectName: string;
  seller: string;
  buyer: string;
  city: string;
  price: number;
  downPayment: number;
  termMonths: number;
  /** наценка за рассрочку, % от остатка (0 — без наценки) */
  markupPct: number;
  penaltyPctPerDay: number;
  earlyAllowed: boolean;
}

export const KIND_LABEL: Record<ObjectKind, { title: string; subject: string; placeholder: string }> = {
  house: { title: "жилого дома", subject: "жилой дом", placeholder: "Жилой дом, 120 м², участок 8 соток, ул. Абая 10" },
  car: { title: "автомобиля", subject: "автомобиль", placeholder: "Toyota Camry, 2020 г.в., VIN XXXXXXXXXXXXXXXXX" },
  tech: { title: "товара (техники)", subject: "товар", placeholder: "Смартфон, 256 ГБ, новый" },
  other: { title: "имущества", subject: "имущество", placeholder: "Опишите, что покупаете" },
};

export const defaultInput = (kind: ObjectKind = "house"): InstallmentInput => ({
  kind,
  objectName: "",
  seller: "",
  buyer: "",
  city: "Тараз",
  price: kind === "house" ? 25_000_000 : kind === "car" ? 9_000_000 : kind === "tech" ? 600_000 : 1_000_000,
  downPayment: kind === "house" ? 5_000_000 : kind === "car" ? 2_000_000 : kind === "tech" ? 100_000 : 200_000,
  termMonths: kind === "house" ? 36 : kind === "car" ? 24 : 12,
  markupPct: 0,
  penaltyPctPerDay: 0.1,
  earlyAllowed: true,
});

export interface InstallmentCalc {
  rest: number;
  markup: number;
  totalToPay: number;
  monthly: number;
  lastPayment: number;
  overpay: number;
}

const r = (n: number) => Math.round(n);

export function calcInstallment(i: InstallmentInput): InstallmentCalc | string {
  if (!(i.price > 0)) return "Укажите цену";
  if (i.downPayment < 0 || i.downPayment >= i.price) return "Первый взнос должен быть меньше цены";
  if (!(i.termMonths >= 1 && i.termMonths <= 360)) return "Срок — от 1 до 360 месяцев";
  if (i.markupPct < 0 || i.markupPct > 200) return "Наценка — от 0 до 200%";
  const rest = i.price - i.downPayment;
  const markup = r((rest * i.markupPct) / 100);
  const toSpread = rest + markup;
  const monthly = Math.floor(toSpread / i.termMonths);
  const lastPayment = toSpread - monthly * (i.termMonths - 1);
  return { rest, markup, totalToPay: i.price + markup, monthly, lastPayment, overpay: markup };
}

/** Параметры для движка расчёта — разбор без ИИ: всё известно точно. */
export function installmentToParams(i: InstallmentInput): LoanParams {
  const c = calcInstallment(i);
  if (typeof c === "string") throw new Error(c);
  return {
    ...emptyParams(),
    productType: i.kind === "house" ? "mortgage" : i.kind === "car" ? "car_loan" : "installment",
    principal: c.rest + c.markup,
    cashPrice: c.rest,
    termMonths: i.termMonths,
    nominalRateAnnual: 0,
    statedMonthlyPayment: c.monthly,
    penalties: [{ description: "Неустойка за просрочку", percentPerDay: i.penaltyPctPerDay, fixedAmount: null }],
  };
}

export const money =(n: number) => `${String(r(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} тенге`;
const pct = (n: number) => String(n).replace(".", ",") + "%";

function ownershipClause(kind: ObjectKind): string[] {
  if (kind === "house")
    return [
      "4.1. Право собственности на Объект переходит к Покупателю с момента государственной регистрации перехода права в органах юстиции (НАО «Правительство для граждан»).",
      "4.2. До полной оплаты цены Объект находится в залоге у Продавца в обеспечение исполнения обязательств Покупателя (п. 4 ст. 446 ГК РК). Обременение снимается в течение 10 рабочих дней после окончательного расчёта.",
      "4.3. Покупатель не вправе отчуждать, сдавать в залог или иным образом обременять Объект до полной оплаты без письменного согласия Продавца.",
    ];
  if (kind === "car")
    return [
      "4.1. Автомобиль передаётся Покупателю по акту приёма-передачи в день подписания Договора; Покупатель вправе пользоваться им с момента передачи.",
      "4.2. Перерегистрация автомобиля на Покупателя производится в органах специализированного ЦОН. До полной оплаты автомобиль находится в залоге у Продавца.",
      "4.3. До полной оплаты Покупатель обязан застраховать гражданско-правовую ответственность владельца ТС и не вправе продавать автомобиль без согласия Продавца.",
    ];
  return [
    "4.1. Товар передаётся Покупателю по акту приёма-передачи в день подписания Договора.",
    "4.2. До полной оплаты Товар признаётся находящимся в залоге у Продавца (ст. 446 ГК РК).",
  ];
}

/** Готовый текст договора. Первая строка — заголовок, разделы «N. …» — как ждёт SampleContract. */
export function buildInstallmentContract(i: InstallmentInput, today = new Date()): string {
  const c = calcInstallment(i);
  if (typeof c === "string") throw new Error(c);
  const k = KIND_LABEL[i.kind];
  const date = today.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  const seller = i.seller.trim() || "________________________ (ФИО / наименование, ИИН/БИН)";
  const buyer = i.buyer.trim() || "________________________ (ФИО, ИИН)";
  const obj = i.objectName.trim() || k.placeholder;
  const same = c.lastPayment === c.monthly;

  return [
    `ДОГОВОР КУПЛИ-ПРОДАЖИ ${k.title.toUpperCase()} С РАССРОЧКОЙ ПЛАТЕЖА`,
    `г. ${i.city || "________"}                                                    ${date}`,
    `${seller}, именуемый(ая) в дальнейшем «Продавец», с одной стороны, и ${buyer}, именуемый(ая) в дальнейшем «Покупатель», с другой стороны, заключили настоящий Договор о нижеследующем:`,
    "",
    "1. Предмет договора",
    `1.1. Продавец продаёт, а Покупатель покупает ${k.subject}: ${obj} (далее — «Объект»).`,
    "1.2. Продавец гарантирует, что Объект не продан, не заложен, в споре и под арестом не состоит, правами третьих лиц не обременён.",
    "",
    "2. Цена и порядок оплаты",
    `2.1. Цена Объекта составляет ${money(i.price)}.`,
    `2.2. Первоначальный взнос: ${money(i.downPayment)}, оплачивается в день подписания Договора.`,
    `2.3. Оставшаяся сумма ${money(c.rest)} оплачивается в рассрочку на ${i.termMonths} мес.`,
    i.markupPct > 0
      ? `2.4. За предоставление рассрочки Покупатель уплачивает наценку ${pct(i.markupPct)} от суммы рассрочки, что составляет ${money(c.markup)}. Общая сумма к оплате по Договору: ${money(c.totalToPay)}.`
      : `2.4. Рассрочка предоставляется без наценки и вознаграждения. Общая сумма к оплате по Договору: ${money(c.totalToPay)}.`,
    same
      ? `2.5. Ежемесячный платёж: ${money(c.monthly)}, не позднее 10 числа каждого месяца, начиная с месяца, следующего за месяцем подписания Договора.`
      : `2.5. Ежемесячный платёж: ${money(c.monthly)} (последний платёж — ${money(c.lastPayment)}), не позднее 10 числа каждого месяца, начиная с месяца, следующего за месяцем подписания Договора.`,
    "2.6. Оплата производится наличными под расписку или безналичным переводом на счёт Продавца. Обязанность считается исполненной с момента поступления денег Продавцу.",
    "",
    "3. Ответственность сторон",
    `3.1. За просрочку платежа Покупатель уплачивает неустойку ${pct(i.penaltyPctPerDay)} от суммы просроченного платежа за каждый день просрочки, но не более 10% от суммы просроченного платежа.`,
    "3.2. При просрочке двух и более платежей подряд Продавец вправе потребовать досрочной оплаты всей оставшейся суммы либо расторгнуть Договор с возвратом Объекта и уплаченных сумм за вычетом стоимости пользования.",
    "",
    "4. Переход права собственности",
    ...ownershipClause(i.kind),
    "",
    "5. Досрочное погашение",
    i.earlyAllowed
      ? "5.1. Покупатель вправе погасить оставшуюся сумму досрочно полностью или частично в любое время без комиссий и штрафов; наценка за неистёкшие месяцы пересчитывается пропорционально."
      : "5.1. Досрочное погашение допускается только с письменного согласия Продавца.",
    "",
    "6. Прочие условия",
    "6.1. Споры решаются путём переговоров, а при недостижении согласия — в суде по месту нахождения Объекта.",
    "6.2. Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой стороны." +
      (i.kind === "house" ? " Договор подлежит нотариальному удостоверению и государственной регистрации." : ""),
    "6.3. Приложение № 1 — график платежей — является неотъемлемой частью Договора.",
    "",
    "7. График платежей (Приложение № 1)",
    ...scheduleLines(i, c),
    "",
    "8. Подписи сторон",
    "Продавец: ____________________ / ____________________",
    "Покупатель: __________________ / ____________________",
  ].join("\n");
}

function scheduleLines(i: InstallmentInput, c: InstallmentCalc): string[] {
  const rows = [`Первоначальный взнос (при подписании): ${money(i.downPayment)}`];
  const show = i.termMonths <= 24 ? i.termMonths : 3;
  for (let m = 1; m <= show; m++) rows.push(`Платёж № ${m}: ${money(m === i.termMonths ? c.lastPayment : c.monthly)}`);
  if (show < i.termMonths) {
    rows.push(`Платежи № 4–${i.termMonths - 1}: по ${money(c.monthly)}`);
    rows.push(`Платёж № ${i.termMonths}: ${money(c.lastPayment)}`);
  }
  rows.push(`Итого: ${money(c.totalToPay)}`);
  return rows;
}

/** Скачивание как Word: HTML с типом application/msword открывается в Word без библиотек. */
export function contractToWordBlob(text: string): Blob {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = text
    .split("\n")
    .map((l, idx) =>
      idx === 0
        ? `<h2 style="text-align:center">${esc(l)}</h2>`
        : /^\d+\.\s/.test(l)
          ? `<h3>${esc(l)}</h3>`
          : l.trim() === ""
            ? ""
            : `<p>${esc(l)}</p>`,
    )
    .join("\n");
  const html = `<html><head><meta charset="utf-8"><style>body{font-family:'Times New Roman';font-size:12pt}p{margin:0 0 6pt;text-align:justify}h3{font-size:12pt;margin:12pt 0 4pt}</style></head><body>${body}</body></html>`;
  return new Blob(["﻿", html], { type: "application/msword" });
}
