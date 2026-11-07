import { LIMITS } from "@/lib/config/thresholds";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { OpenAIProvider } from "./openai";

export interface LLMRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  /** изображение прикладывается к последнему user-сообщению */
  image?: { mime: string; base64: string };
  maxTokens: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: LLMRequest, signal: AbortSignal): Promise<string>;
}

export type LLMErrorCode = "not_configured" | "timeout" | "unavailable" | "bad_response";

export class LLMError extends Error {
  constructor(
    public code: LLMErrorCode,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

/**
 * Выбор провайдера по env. Если LLM_PROVIDER не задан — берём первого, для кого есть ключ.
 * null — ключа нет, работает только ручной режим / фолбэк.
 */
export function getProvider(): LLMProvider | null {
  const env = process.env;
  const keys = {
    anthropic: env.ANTHROPIC_API_KEY,
    openai: env.OPENAI_API_KEY,
    gemini: env.GEMINI_API_KEY || env.GOOGLE_API_KEY,
  };
  const explicit = env.LLM_PROVIDER?.toLowerCase();
  const which = explicit || (["anthropic", "openai", "gemini"] as const).find((p) => keys[p]) || "anthropic";
  const model = env.LLM_MODEL;
  switch (which) {
    case "openai":
      return keys.openai ? new OpenAIProvider(keys.openai, model ?? "gpt-4o-mini") : null;
    case "gemini":
      return keys.gemini ? new GeminiProvider(keys.gemini, model ?? "gemini-3.5-flash-lite") : null;
    default:
      return keys.anthropic ? new AnthropicProvider(keys.anthropic, model ?? "claude-sonnet-5-5") : null;
  }
}

export interface RetryOptions {
  timeoutMs?: number;
  retries?: number;
}

/** Вызов с таймаутом (по умолчанию 25 с) и ретраями с backoff (по умолчанию один). */
export async function completeWithRetry(provider: LLMProvider, req: LLMRequest, opts: RetryOptions = {}): Promise<string> {
  const attempts = (opts.retries ?? 1) + 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? LIMITS.llmTimeoutMs);
    try {
      return await provider.complete(req, ctrl.signal);
    } catch (e) {
      lastErr = e;
      const aborted = ctrl.signal.aborted;
      const retryable = aborted || (e instanceof LLMError ? e.retryable : true);
      if (!retryable || attempt === attempts - 1) {
        if (aborted) throw new LLMError("timeout", "LLM timeout");
        throw e instanceof LLMError ? e : new LLMError("unavailable", "LLM request failed", true);
      }
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new LLMError("unavailable", "LLM request failed");
}

/** Достаёт первый JSON-объект из ответа (на случай ```json-ограждений). */
export function parseJsonLoose(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LLMError("bad_response", "No JSON object in response");
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new LLMError("bad_response", "Invalid JSON");
  }
}
