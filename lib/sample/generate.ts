import { toTiyn } from "@/lib/finance/money";
import { annuityPayment } from "@/lib/finance/schedule";

/** Условия, которые ИИ обязан вписать в договор: так каждый пример разный, но всегда считается и содержит ловушки. */
export interface Scenario {
  principal: number;
  termMonths: number;
  rate: number;
  issuanceFeePct: number | null;
  monthlyFee: number | null;
  insurance: { amount: number; rateWithout: number } | null;
  penaltyPctPerDay: number;
  earlyFeePct: number | null;
  /** заниженная ГЭСВ — типичная ловушка */
  statedGesv: number;
  /** платёж «по кредиту» без комиссий и страховки */
  statedPayment: number;
}

export type Rng = () => number;

const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
const between = (rng: Rng, min: number, max: number, step: number): number =>
  min + Math.floor(rng() * (Math.floor((max - min) / step) + 1)) * step;

export function randomScenario(rng: Rng = Math.random): Scenario {
  const principal = between(rng, 600_000, 5_000_000, 100_000);
  const termMonths = pick(rng, [12, 18, 24, 36, 48, 60]);
  const rate = between(rng, 14, 30, 0.5);
  let issuanceFeePct = rng() < 0.7 ? pick(rng, [1.5, 2, 2.5, 3]) : null;
  let monthlyFee = rng() < 0.5 ? pick(rng, [1000, 1500, 2000, 2500]) : null;
  const insurance =
    rng() < 0.6
      ? {
          amount: Math.round((principal * pick(rng, [1.5, 2, 2.5])) / 100 / 1000) * 1000,
          rateWithout: rate + pick(rng, [5, 6, 7, 8]),
        }
      : null;
  // Минимум две «платные добавки», иначе пример получается скучным для демо
  if ([issuanceFeePct, monthlyFee, insurance].filter(Boolean).length < 2) {
    issuanceFeePct ??= 2;
    monthlyFee ??= 1500;
  }
  return {
    principal,
    termMonths,
    rate,
    issuanceFeePct,
    monthlyFee,
    insurance,
    penaltyPctPerDay: pick(rng, [0.1, 0.15, 0.2, 0.3, 0.5]),
    earlyFeePct: rng() < 0.5 ? 1 : null,
    statedGesv: Math.round((rate + pick(rng, [1, 1.5, 2])) * 10) / 10,
    statedPayment: Math.round(annuityPayment(toTiyn(principal), rate, termMonths) / 100),
  };
}

const spaced = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const comma = (n: number) => String(n).replace(".", ",");

export function buildSamplePrompt(s: Scenario, lang: "ru" | "kk"): { system: string; user: string } {
  const langName = lang === "kk" ? "казахском" : "русском";
  const terms = [
    `Сумма кредита: ${spaced(s.principal)} тенге.`,
    `Срок: ${s.termMonths} месяцев.`,
    `Ставка вознаграждения: ${comma(s.rate)}% годовых, фиксированная. Погашение аннуитетными платежами ежемесячно.`,
    `ГЭСВ, указанная в договоре: ${comma(s.statedGesv)}%.`,
    `Ежемесячный платёж по кредиту, указанный в договоре: ${spaced(s.statedPayment)} тенге.`,
    s.issuanceFeePct != null ? `Комиссия за выдачу кредита: ${comma(s.issuanceFeePct)}% от суммы кредита, удерживается из суммы кредита при выдаче.` : null,
    s.monthlyFee != null ? `Комиссия за ведение счёта: ${spaced(s.monthlyFee)} тенге ежемесячно, оплачивается вместе с платежом по кредиту.` : null,
    s.insurance
      ? `Страхование жизни: страховая премия ${spaced(s.insurance.amount)} тенге, единовременно, включается в сумму кредита. Кредит предоставляется по указанной ставке при условии заключения договора страхования; при отказе от страхования ставка составляет ${comma(s.insurance.rateWithout)}% годовых.`
      : null,
    `Неустойка за просрочку: ${comma(s.penaltyPctPerDay)}% от суммы просроченного платежа за каждый день просрочки.`,
    s.earlyFeePct != null
      ? `Досрочное погашение допускается после письменного уведомления банка за 30 дней, комиссия за досрочное погашение ${s.earlyFeePct}% от погашаемой суммы.`
      : "Досрочное погашение допускается в любое время без комиссий.",
  ].filter((x): x is string => x !== null);

  const system = `Ты пишешь ВЫМЫШЛЕННЫЕ учебные образцы кредитных договоров для демонстрации приложения, которое помогает людям разбирать условия кредита. Верни один JSON-объект {"text": "<полный текст договора>"} без пояснений и markdown.

Требования к тексту на ${langName} языке:
- Настоящий формальный стиль потребительского кредитного договора: заголовок с номером, преамбула, пронумерованные разделы (1. Условия кредита, 2. Комиссии, 3. Страхование, 4. Ответственность, 5. Досрочное погашение, 6. Прочее) и пункты 1.1, 1.2 …
- Банк — полностью придуманное название с пометкой «(вымышленный)». Не упоминай реальные банки, МФО и реальных людей.
- Заёмщик — придуманные ФИО, ИИН ровно 123456789012, телефон ровно +7 700 000 00 00.
- Впиши ВСЕ условия из списка дословно, с теми же числами и написанием («2 400 000 тенге», «19,5%»). Не меняй, не округляй и не пересчитывай числа, не добавляй других сумм и ставок.
- Невыгодные для заёмщика условия формулируй сухим юридическим языком, без оценок, намёков и слов вроде «ловушка» или «внимание». Добавь 2–3 нейтральных пункта (уступка прав, споры, уведомления).
- Объём 1500–3500 знаков.`;

  return {
    system,
    user: `<context>Условия, которые нужно вписать в договор:\n${terms.map((t) => `- ${t}`).join("\n")}</context>`,
  };
}

/** Названия реальных кредиторов: пример должен быть вымышленным. */
const REAL_LENDERS = /kaspi|каспи|halyk|халык|народный банк|jusan|жусан|forte|форте|bereke|береке|centercredit|центркредит|home credit|хоум кредит|евразийск|сбербанк|нурбанк|отбасы|freedom|фридом|альфа-банк|bank rbk|банк рбк/i;

/** Проверка ответа ИИ: числа из сценария на месте, нет реальных банков. null — всё в порядке. */
export function validateSample(text: string, s: Scenario): string | null {
  if (text.length < 600 || text.length > 7000) return "length";
  if (REAL_LENDERS.test(text)) return "real_lender";
  const flat = text.replace(/[\s  ]/g, "");
  const has = (n: number) => flat.includes(String(n)) || flat.includes(comma(n));
  const must = [s.principal, s.termMonths, s.rate, s.statedGesv, s.statedPayment, s.monthlyFee, s.insurance?.amount, s.insurance?.rateWithout];
  for (const n of must) if (n != null && !has(n)) return `missing_${n}`;
  return null;
}

/** Вымышленные ИИН и телефон принудительно: ИИ мог выдать правдоподобные «живые» данные. */
export function sanitizeSample(text: string): string {
  return text
    .replace(/(?<!\d)\d{12}(?!\d)/g, "123456789012")
    .replace(/(?<!\d)(?:\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g, "+7 700 000 00 00");
}
