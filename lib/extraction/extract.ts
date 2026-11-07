import { FEWSHOTS } from "./fewshot";
import { buildSystemPrompt, IMAGE_USER_PROMPT, repairPrompt, wrapDocument, type Lang } from "./prompt";
import { redact } from "./redact";
import { ExtractionSchema, sanitizeExtraction, type Extraction } from "./schema";
import { completeWithRetry, LLMError, parseJsonLoose, type LLMProvider, type LLMRequest } from "@/lib/llm/provider";

export class ExtractionError extends Error {
  constructor(
    public code: "invalid_output" | "llm_failed",
    message: string,
  ) {
    super(message);
  }
}

export type Source = { kind: "text"; text: string } | { kind: "image"; mime: string; base64: string };

export interface ExtractionOutcome {
  extraction: Extraction;
  /** fieldQuotes/quote, найденные в исходном тексте дословно (для изображений не проверяется) */
  quotesVerified: Record<string, boolean> | null;
  redactionCounts: ReturnType<typeof redact>["counts"] | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Проверяет, что цитаты LLM действительно есть в документе: защита от выдуманных «доказательств». */
export function verifyQuotes(ex: Extraction, doc: string): Record<string, boolean> {
  const hay = norm(doc);
  const out: Record<string, boolean> = {};
  for (const [k, q] of Object.entries(ex.fieldQuotes)) out[k] = hay.includes(norm(q));
  ex.fees.forEach((f, i) => (out[`fees.${i}`] = !f.quote || hay.includes(norm(f.quote))));
  ex.penalties.forEach((f, i) => (out[`penalties.${i}`] = !f.quote || hay.includes(norm(f.quote))));
  ex.redFlags.forEach((f, i) => (out[`redFlags.${i}`] = !f.quote || hay.includes(norm(f.quote))));
  return out;
}

export async function extractWithLLM(provider: LLMProvider, source: Source, lang: Lang): Promise<ExtractionOutcome> {
  let docText = "";
  let counts: ExtractionOutcome["redactionCounts"] = null;
  if (source.kind === "text") {
    const r = redact(source.text);
    docText = r.text;
    counts = r.counts;
  }

  const messages: LLMRequest["messages"] = [];
  for (const shot of FEWSHOTS) {
    messages.push({ role: "user", content: wrapDocument(shot.document) });
    messages.push({ role: "assistant", content: JSON.stringify(shot.output) });
  }
  messages.push({ role: "user", content: source.kind === "text" ? wrapDocument(docText) : IMAGE_USER_PROMPT });

  const base: Omit<LLMRequest, "messages"> = {
    system: buildSystemPrompt(lang),
    maxTokens: 3000,
    image: source.kind === "image" ? { mime: source.mime, base64: source.base64 } : undefined,
  };

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs =
      attempt === 0
        ? messages
        : [...messages, { role: "assistant" as const, content: "(некорректный ответ)" }, { role: "user" as const, content: repairPrompt(lastError) }];
    let raw: string;
    try {
      raw = await completeWithRetry(provider, { ...base, messages: msgs });
    } catch (e) {
      if (e instanceof LLMError && e.code === "bad_response" && attempt === 0) {
        lastError = e.message;
        continue;
      }
      throw new ExtractionError("llm_failed", e instanceof Error ? e.message : "LLM failed");
    }
    try {
      const parsed = ExtractionSchema.safeParse(parseJsonLoose(raw));
      if (parsed.success) {
        const extraction = sanitizeExtraction(parsed.data);
        return {
          extraction,
          quotesVerified: source.kind === "text" ? verifyQuotes(extraction, source.text) : null,
          redactionCounts: counts,
        };
      }
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : "invalid JSON";
    }
  }
  throw new ExtractionError("invalid_output", lastError);
}
