import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "@/lib/llm/gemini";
import { getProvider, LLMError } from "@/lib/llm/provider";

const KEYS = ["LLM_PROVIDER", "LLM_MODEL", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"];
const clean = () => KEYS.forEach((k) => vi.stubEnv(k, ""));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getProvider", () => {
  it("no keys → null", () => {
    clean();
    expect(getProvider()).toBeNull();
  });
  it("autodetects the provider from whichever key is set", () => {
    clean();
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(getProvider()?.name).toBe("gemini");
    clean();
    vi.stubEnv("OPENAI_API_KEY", "k");
    expect(getProvider()?.name).toBe("openai");
    clean();
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect(getProvider()?.name).toBe("anthropic");
  });
  it("explicit LLM_PROVIDER wins, and needs its own key", () => {
    clean();
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.stubEnv("LLM_PROVIDER", "gemini");
    expect(getProvider()).toBeNull();
    vi.stubEnv("GOOGLE_API_KEY", "k");
    expect(getProvider()?.name).toBe("gemini");
  });
});

describe("GeminiProvider", () => {
  const req = {
    system: "sys",
    maxTokens: 3000,
    messages: [
      { role: "user" as const, content: "doc 1" },
      { role: "assistant" as const, content: "{}" },
      { role: "user" as const, content: "doc 2" },
    ],
    image: { mime: "image/jpeg", base64: "QUJD" },
  };

  it("sends system, roles, image and JSON mode; key goes in a header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: '{"ok":' }, { text: "true}" }] } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const out = await new GeminiProvider("secret", "gemini-3.8-flash").complete(req, new AbortController().signal);
    expect(out).toBe('{"ok":true}');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect(url).not.toContain("secret");
    expect(init.headers["x-goog-api-key"]).toBe("secret");
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(["user", "model", "user"]);
    expect(body.contents[0].parts).toHaveLength(1);
    expect(body.contents[2].parts[1].inlineData).toEqual({ mimeType: "image/jpeg", data: "QUJD" });
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(3000);
  });

  it("maps HTTP errors: 429/5xx retryable, 400 not", async () => {
    for (const [status, retryable] of [[429, true], [503, true], [400, false]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status }));
      const err = await new GeminiProvider("k", "m").complete(req, new AbortController().signal).catch((e) => e);
      expect(err).toBeInstanceOf(LLMError);
      expect(err.retryable).toBe(retryable);
    }
  });

  it("blocked or empty response → bad_response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ promptFeedback: { blockReason: "SAFETY" } }) }));
    const err = await new GeminiProvider("k", "m").complete(req, new AbortController().signal).catch((e) => e);
    expect(err.code).toBe("bad_response");
    expect(err.message).toContain("SAFETY");
  });
});
