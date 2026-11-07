import { describe, expect, it } from "vitest";
import { LRUCache, sha256 } from "@/lib/cache";
import { FEWSHOTS } from "@/lib/extraction/fewshot";
import { verifyQuotes } from "@/lib/extraction/extract";
import { buildSystemPrompt } from "@/lib/extraction/prompt";
import {
  ExtractRequestSchema,
  ExtractionSchema,
  SummaryResponseSchema,
  sanitizeExtraction,
} from "@/lib/extraction/schema";
import { parseJsonLoose } from "@/lib/llm/provider";
import { MemoryRateLimiter } from "@/lib/rateLimit";
import { ru, kk } from "@/lib/i18n";
import { translate } from "@/lib/i18n";

describe("extraction schema", () => {
  it("fills defaults for a minimal object", () => {
    const e = ExtractionSchema.parse({});
    expect(e.productType).toBe("unknown");
    expect(e.principal).toBeNull();
    expect(e.fees).toEqual([]);
    expect(e.insurance.present).toBe(false);
  });
  it("rejects wrong types", () => {
    expect(ExtractionSchema.safeParse({ principal: "много" }).success).toBe(false);
    expect(ExtractionSchema.safeParse({ productType: "bank" }).success).toBe(false);
    expect(ExtractionSchema.safeParse({ fees: [{ name: "x", kind: "weird" }] }).success).toBe(false);
  });
  it("drops unknown red flag ids instead of failing", () => {
    const raw = ExtractionSchema.parse({ redFlags: [{ id: "hidden_fees", quote: "q" }, { id: "made_up", quote: "q" }, { id: "rate_gap", quote: "q" }] });
    expect(sanitizeExtraction(raw).redFlags.map((f) => f.id)).toEqual(["hidden_fees"]);
  });
  it("all few-shot outputs satisfy the schema, and there are 5–8 of them", () => {
    expect(FEWSHOTS.length).toBeGreaterThanOrEqual(5);
    expect(FEWSHOTS.length).toBeLessThanOrEqual(8);
    for (const s of FEWSHOTS) expect(ExtractionSchema.safeParse(JSON.parse(JSON.stringify(s.output))).success).toBe(true);
  });
  it("few-shots include the honest offer and the scam SMS", () => {
    expect(FEWSHOTS.some((s) => s.output.productType === "scam_suspected")).toBe(true);
    expect(FEWSHOTS.some((s) => s.output.redFlags.length === 0 && s.output.principal != null)).toBe(true);
  });
  it("few-shot quotes are verbatim in their documents", () => {
    for (const s of FEWSHOTS) {
      const ex = sanitizeExtraction(s.output);
      for (const [k, ok] of Object.entries(verifyQuotes(ex, s.document))) expect(ok, k).toBe(true);
    }
  });
});

describe("request schema", () => {
  const img = { mime: "image/jpeg", base64: "A".repeat(200) };
  it("accepts exactly one source", () => {
    expect(ExtractRequestSchema.safeParse({ text: "кредит" }).success).toBe(true);
    expect(ExtractRequestSchema.safeParse({ image: img }).success).toBe(true);
    expect(ExtractRequestSchema.safeParse({ pdf: { base64: "A".repeat(200) } }).success).toBe(true);
    expect(ExtractRequestSchema.safeParse({}).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ text: "x", image: img }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ text: "   " }).success).toBe(false);
  });
  it("enforces limits and MIME", () => {
    expect(ExtractRequestSchema.safeParse({ text: "a".repeat(15_001) }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ text: "a".repeat(15_000) }).success).toBe(true);
    expect(ExtractRequestSchema.safeParse({ image: { mime: "image/gif", base64: "A".repeat(200) } }).success).toBe(false);
    expect(ExtractRequestSchema.safeParse({ image: { mime: "image/png", base64: "A".repeat(7_000_000) } }).success).toBe(false);
  });
});

describe("summary schema", () => {
  it("validates", () => {
    expect(SummaryResponseSchema.safeParse({ verdict: "Осторожно", questions: ["Что?"] }).success).toBe(true);
    expect(SummaryResponseSchema.safeParse({ verdict: "" }).success).toBe(false);
  });
});

describe("prompt", () => {
  it("states the data-not-instructions rule and lists the taxonomy", () => {
    const p = buildSystemPrompt("ru");
    expect(p).toContain("<document>");
    expect(p).toContain("upfront_payment_scam");
    expect(p).toContain("ДАННЫЕ");
    expect(buildSystemPrompt("kk")).toContain("казахском");
  });
});

describe("llm helpers", () => {
  it("parseJsonLoose strips fences", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => parseJsonLoose("no json")).toThrow();
    expect(() => parseJsonLoose("{oops}")).toThrow();
  });
});

describe("cache and rate limit", () => {
  it("LRU evicts the least recently used", () => {
    const c = new LRUCache<number>(2);
    c.set("a", 1);
    c.set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.size).toBe(2);
  });
  it("sha256 is stable", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("rate limiter blocks the 11th request within a minute", async () => {
    const rl = new MemoryRateLimiter(10);
    for (let i = 0; i < 10; i++) expect((await rl.check("ip")).ok).toBe(true);
    const blocked = await rl.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect((await rl.check("other")).ok).toBe(true);
  });
});

describe("i18n", () => {
  it("kk has every ru key and vice versa", () => {
    expect(Object.keys(kk).sort()).toEqual(Object.keys(ru).sort());
  });
  it("placeholders match between languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(ru)) expect(ph(kk[k]), k).toBe(ph(ru[k]));
  });
  it("interpolates and falls back to the key", () => {
    expect(translate("ru", "human.day", { d: "5 ₸" })).toBe("Каждый день кредита стоит вам 5 ₸.");
    expect(translate("ru", "nope.key")).toBe("nope.key");
  });
  it("every key the UI builds dynamically exists", () => {
    const keys = [
      ...["contract", "microloan", "installment", "cash_loan", "scam_sms", "honest"].map((x) => `preset.${x}`),
      ...["input.generate", "input.generate_hint", "sample.generating", "sample.title", "sample.badge_llm", "sample.badge_fixture", "sample.analyze", "sample.regenerate"],
      ...["rate_gap", "zero_percent_markup", "daily_rate_masking", "debt_burden_high", "stated_mismatch", "upfront_payment_scam", "imposed_insurance", "hidden_fees", "rollover_trap", "high_penalties", "floating_rate", "collateral_or_guarantor", "urgency_pressure", "unclear_terms"].flatMap((x) => [`flag.${x}.title`, `flag.${x}.expl`]),
      ...["rate_limited", "bad_request", "too_large", "pdf_too_long", "pdf_unreadable", "llm_unavailable", "invalid_output", "network", "server_error", "image", "pdf_too_large", "calc.principal", "calc.term", "calc.rate"].map((x) => `err.${x}`),
      ...["nominal", "daily", "implied_from_payment", "zero"].map((x) => `rate_source.${x}`),
      ...["gesv", "total_amount", "fees", "insurance_optional", "early", "penalties", "floating", "rollover", "daily", "markup", "collateral", "scam_verify"].map((x) => `q.${x}`),
      ...["body", "interest", "fees", "insurance"].map((x) => `money.${x}`),
      ...["critical", "high", "medium"].map((x) => `sev.${x}`),
      ...["green", "yellow", "red"].map((x) => `zone.${x}`),
      ...["upfront_deducted", "upfront_paid", "monthly"].map((x) => `fee.${x}`),
      ...["upfront_deducted", "upfront_paid", "monthly", "financed"].map((x) => `ins.${x}`),
      ...["restructuring", "regulator", "police"].flatMap((x) => [`help.${x}.title`, `help.${x}.desc`]),
    ];
    for (const k of keys) expect(ru[k], k).toBeTruthy();
  });
});
