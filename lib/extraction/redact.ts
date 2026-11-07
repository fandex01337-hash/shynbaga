/** Маскирование персональных данных ДО отправки в LLM. Работает на сервере. */

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length > 0 && sum % 10 === 0;
}

const IBAN_RE = /\bKZ\s?\d{2}(?:\s?[A-Z0-9]){16}\b/gi;
const CARD_RE = /(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])/g;
const IIN_RE = /(?<![\d])\d{12}(?![\d])/g;
const PHONE_RE = /(?<![\d])(?:\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?![\d])/g;
// После «Заёмщик»/«Қарыз алушы» маскируем до трёх слов с заглавной буквы (ФИО)
const NAME_RE =
  /((?:Заёмщик|Заемщик|Қарыз\s+алушы)\s*[:\-–—]?\s*)((?:[A-ZА-ЯЁӘІҢҒҮҰҚӨҺ][a-zа-яёәіңғүұқөһ]+(?:\s+|(?=[,.;:)]|$))){1,3})/g;

export interface RedactionResult {
  text: string;
  counts: { iin: number; card: number; iban: number; phone: number; name: number };
}

export function redact(input: string): RedactionResult {
  const counts = { iin: 0, card: 0, iban: 0, phone: 0, name: 0 };
  let text = input;

  text = text.replace(IBAN_RE, () => {
    counts.iban++;
    return "[IBAN]";
  });
  text = text.replace(CARD_RE, (m) => {
    const digits = m.replace(/[ -]/g, "");
    if (digits.length >= 13 && digits.length <= 19 && luhnValid(digits)) {
      counts.card++;
      return "[КАРТА]";
    }
    return m;
  });
  text = text.replace(PHONE_RE, () => {
    counts.phone++;
    return "[ТЕЛЕФОН]";
  });
  text = text.replace(IIN_RE, () => {
    counts.iin++;
    return "[ИИН]";
  });
  text = text.replace(NAME_RE, (_m, prefix: string) => {
    counts.name++;
    return `${prefix}[ФИО] `;
  });
  return { text, counts };
}
