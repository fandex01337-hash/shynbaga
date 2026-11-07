import { NextResponse } from "next/server";
import { z } from "zod";
import { buildSamplePrompt, randomScenario, sanitizeSample, validateSample } from "@/lib/sample/generate";
import { completeWithRetry, getProvider, parseJsonLoose } from "@/lib/llm/provider";
import { getPreset } from "@/lib/presets";
import { clientIp, getLimiter } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({ lang: z.enum(["ru", "kk"]).default("ru") });
const OutSchema = z.object({ text: z.string() });

// Демо на сцене не должно ждать: короткий таймаут и сразу запасной договор
const SAMPLE_TIMEOUT_MS = 15_000;

const fixture = () => NextResponse.json({ ok: true, via: "fixture", text: getPreset("contract")?.text ?? "" });

/** ИИ пишет вымышленный договор с заданными условиями. Любой сбой → готовый пример, а не ошибка. */
export async function POST(req: Request) {
  try {
    const rl = await getLimiter().check(clientIp(req));
    if (!rl.ok) return NextResponse.json({ ok: false, code: "rate_limited" }, { status: 429 });

    const body = BodySchema.safeParse(await req.json().catch(() => ({})));
    const lang = body.success ? body.data.lang : "ru";
    const provider = getProvider();
    if (!provider) return fixture();

    const scenario = randomScenario();
    const { system, user } = buildSamplePrompt(scenario, lang);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await completeWithRetry(provider, { system, maxTokens: 3500, messages: [{ role: "user", content: user }] }, { timeoutMs: SAMPLE_TIMEOUT_MS, retries: 0 });
        const text = sanitizeSample(OutSchema.parse(parseJsonLoose(raw)).text.trim());
        const problem = validateSample(text, scenario);
        if (!problem) return NextResponse.json({ ok: true, via: "llm", text });
        console.warn("sample rejected", { attempt, problem });
      } catch {
        console.warn("sample attempt failed", { attempt });
        break; // таймаут или сеть: второй попытки на сцене не ждём
      }
    }
    return fixture();
  } catch {
    return fixture();
  }
}
