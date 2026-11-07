import { LLMError, type LLMProvider, type LLMRequest } from "./provider";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async complete(req: LLMRequest, signal: AbortSignal): Promise<string> {
    const lastIdx = req.messages.length - 1;
    const contents = req.messages.map((m, i) => {
      const parts: unknown[] = [{ text: m.content }];
      if (i === lastIdx && req.image && m.role === "user") {
        parts.push({ inlineData: { mimeType: req.image.mime, data: req.image.base64 } });
      }
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

    // Ключ — в заголовке, а не в URL: URL попадает в логи
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents,
        // У моделей Gemini «размышления» тоже считаются в maxOutputTokens: берём запас, иначе JSON обрежется
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: Math.max(req.maxTokens, 8192) },
      }),
    });
    if (!res.ok) {
      throw new LLMError("unavailable", `Gemini HTTP ${res.status}`, res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      const why = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? "empty";
      throw new LLMError("bad_response", `Empty response (${why})`);
    }
    return text;
  }
}
