import { describe, expect, it } from "vitest";
import { luhnValid, redact } from "@/lib/extraction/redact";

describe("luhn", () => {
  it("validates known numbers", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("")).toBe(false);
    expect(luhnValid("41a1")).toBe(false);
  });
});

describe("redact", () => {
  it("masks IIN (12 digits)", () => {
    const r = redact("ИИН 900101300123, сумма 1 500 000");
    expect(r.text).toContain("[ИИН]");
    expect(r.text).not.toContain("900101300123");
    expect(r.text).toContain("1 500 000");
    expect(r.counts.iin).toBe(1);
  });
  it("masks Luhn-valid cards (spaces/dashes) but not other long numbers", () => {
    const r = redact("Карта 4111 1111 1111 1111 и 4111-1111-1111-1111; номер 1234 5678 9012 3456");
    expect(r.counts.card).toBe(2);
    expect(r.text).toContain("1234 5678 9012 3456");
  });
  it("masks KZ IBAN", () => {
    const r = redact("Счёт KZ86125KZT5004100100 и kz 12 345A 1234 5678 9012");
    expect(r.counts.iban).toBeGreaterThanOrEqual(1);
    expect(r.text).not.toContain("KZ86125KZT5004100100");
  });
  it("masks phones in several formats", () => {
    const r = redact("+7 777 123 45 67, 8 (701) 234-56-78, 87012345678");
    expect(r.counts.phone).toBe(3);
    expect(r.text).not.toMatch(/\d{3}[ -]?\d{2}[ -]?\d{2}/);
  });
  it("masks borrower name after Заёмщик / Қарыз алушы", () => {
    const a = redact("Заёмщик: Иванов Иван Иванович, проживающий");
    expect(a.text).toContain("[ФИО]");
    expect(a.text).not.toContain("Иванов");
    const b = redact("Қарыз алушы Серікбаев Ерлан обязуется");
    expect(b.text).not.toContain("Серікбаев");
    expect(b.text).toContain("обязуется");
  });
  it("does not touch amounts and rates", () => {
    const s = "Сумма 2 000 000 тенге, ставка 0,3% в день, срок 24 месяца";
    expect(redact(s).text).toBe(s);
  });
  it("is idempotent on clean text", () => {
    const r = redact("");
    expect(r.text).toBe("");
    expect(r.counts).toEqual({ iin: 0, card: 0, iban: 0, phone: 0, name: 0 });
  });
});
