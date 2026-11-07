import { NextResponse } from "next/server";
import { LRUCache, sha256 } from "@/lib/cache";
import { LIMITS } from "@/lib/config/thresholds";
import { ExtractionError, extractWithLLM, type ExtractionOutcome, type Source } from "@/lib/extraction/extract";
import { ExtractRequestSchema } from "@/lib/extraction/schema";
import { getProvider } from "@/lib/llm/provider";
import { getPreset } from "@/lib/presets";
import { clientIp, getLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const g = globalThis as unknown as { __extractCache?: LRUCache<ExtractionOutcome> };
const cache = (g.__extractCache ??= new LRUCache<ExtractionOutcome>(LIMITS.cacheSize));

type ErrorCode = "rate_limited" | "bad_request" | "too_large" | "pdf_too_long" | "pdf_unreadable" | "llm_unavailable" | "invalid_output" | "server_error";

const fail = (code: ErrorCode, status: number, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, code, ...extra }, { status });

/** Возможности сервера для UI: есть ли LLM. */
export async function GET() {
  return NextResponse.json({ llm: getProvider() !== null, demoFallback: process.env.DEMO_FALLBACK === "true" });
}

async function pdfToText(base64: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  if (bytes.byteLength > LIMITS.maxPdfBytes) throw new Error("too_large");
  const doc = await getDocumentProxy(bytes);
  if (doc.numPages > LIMITS.maxPdfPages) throw new Error("pdf_too_long");
  const { text } = await extractText(doc, { mergePages: true });
  return text;
}

export async function POST(req: Request) {
  try {
    return await handle(req);
  } catch {
    // Любая непредвиденная ошибка — JSON-ответ, а не пустой 500: клиент не должен принимать его за обрыв связи
    console.error("extract: unexpected error");
    return fail("server_error", 500);
  }
}

async function handle(req: Request) {
  const started = Date.now();
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 16_000_000) return fail("too_large", 413);

  const rl = await getLimiter().check(clientIp(req));
  if (!rl.ok) return fail("rate_limited", 429, { retryAfterSec: rl.retryAfterSec });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  const parsed = ExtractRequestSchema.safeParse(body);
  if (!parsed.success) return fail("bad_request", 400);
  const input = parsed.data;

  let source: Source;
  if (input.image) {
    source = { kind: "image", mime: input.image.mime, base64: input.image.base64 };
  } else if (input.pdf) {
    try {
      const text = (await pdfToText(input.pdf.base64)).slice(0, LIMITS.maxTextChars);
      if (text.trim().length < 20) return fail("pdf_unreadable", 422);
      source = { kind: "text", text };
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      if (m === "pdf_too_long" || m === "too_large") return fail(m as ErrorCode, 413);
      return fail("pdf_unreadable", 422);
    }
  } else {
    source = { kind: "text", text: input.text as string };
  }

  const key = sha256(JSON.stringify([source, input.lang]));
  const hit = cache.get(key);
  if (hit) {
    console.info("extract", { cached: true, ms: Date.now() - started });
    return NextResponse.json({ ok: true, via: "cache", ...hit });
  }

  const provider = getProvider();
  const fallbackAllowed = process.env.DEMO_FALLBACK === "true";
  const preset = getPreset(input.presetId);
  const useFixture = (): NextResponse | null =>
    fallbackAllowed && preset
      ? NextResponse.json({ ok: true, via: "fixture", extraction: preset.extraction, quotesVerified: null, redactionCounts: null })
      : null;

  if (!provider) {
    return useFixture() ?? fail("llm_unavailable", 503);
  }

  try {
    const outcome = await extractWithLLM(provider, source, input.lang);
    cache.set(key, outcome);
    // В логах только метаданные — никакого содержимого документа
    console.info("extract", { ms: Date.now() - started, kind: source.kind, len: source.kind === "text" ? source.text.length : source.base64.length });
    return NextResponse.json({ ok: true, via: "llm", ...outcome });
  } catch (e) {
    const code = e instanceof ExtractionError ? e.code : "llm_failed";
    console.warn("extract failed", { ms: Date.now() - started, code });
    const fx = useFixture();
    if (fx) return fx;
    return fail(code === "invalid_output" ? "invalid_output" : "llm_unavailable", code === "invalid_output" ? 502 : 503);
  }
}
