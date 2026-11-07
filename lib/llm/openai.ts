import { LLMError, type LLMProvider, type LLMRequest } from "./provider";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async complete(req: LLMRequest, signal: AbortSignal): Promise<string> {
    const lastIdx = req.messages.length - 1;
    const messages: unknown[] = [{ role: "system", content: req.system }];
    req.messages.forEach((m, i) => {
      if (i === lastIdx && req.image && m.role === "user") {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: `data:${req.image.mime};base64,${req.image.base64}` } },
          ],
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_completion_tokens: req.maxTokens,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      throw new LLMError("unavailable", `OpenAI HTTP ${res.status}`, res.status === 429 || res.status >= 500);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new LLMError("bad_response", "Empty response");
    return text;
  }
}
