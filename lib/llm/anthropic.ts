import { LLMError, type LLMProvider, type LLMRequest } from "./provider";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async complete(req: LLMRequest, signal: AbortSignal): Promise<string> {
    const lastIdx = req.messages.length - 1;
    const messages = req.messages.map((m, i) => {
      if (i === lastIdx && req.image && m.role === "user") {
        return {
          role: m.role,
          content: [
            { type: "image", source: { type: "base64", media_type: req.image.mime, data: req.image.base64 } },
            { type: "text", text: m.content },
          ],
        };
      }
      return { role: m.role, content: m.content };
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: this.model, max_tokens: req.maxTokens, system: req.system, messages }),
    });
    if (!res.ok) {
      throw new LLMError("unavailable", `Anthropic HTTP ${res.status}`, res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new LLMError("bad_response", "Empty response");
    return text;
  }
}
