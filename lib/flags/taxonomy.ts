export const ENGINE_FLAG_IDS = [
  "rate_gap",
  "zero_percent_markup",
  "daily_rate_masking",
  "debt_burden_high",
  "stated_mismatch",
] as const;

export const LLM_FLAG_IDS = [
  "upfront_payment_scam",
  "imposed_insurance",
  "hidden_fees",
  "rollover_trap",
  "high_penalties",
  "floating_rate",
  "collateral_or_guarantor",
  "urgency_pressure",
  "unclear_terms",
] as const;

export type EngineFlagId = (typeof ENGINE_FLAG_IDS)[number];
export type LlmFlagId = (typeof LLM_FLAG_IDS)[number];
export type FlagId = EngineFlagId | LlmFlagId;

export type Severity = "critical" | "high" | "medium";

export const FLAG_SEVERITY: Record<FlagId, Severity> = {
  upfront_payment_scam: "critical",
  rate_gap: "high",
  zero_percent_markup: "high",
  daily_rate_masking: "medium",
  debt_burden_high: "high",
  stated_mismatch: "high",
  imposed_insurance: "high",
  hidden_fees: "high",
  rollover_trap: "high",
  high_penalties: "medium",
  floating_rate: "medium",
  collateral_or_guarantor: "medium",
  urgency_pressure: "medium",
  unclear_terms: "medium",
};

export const isLlmFlagId = (s: string): s is LlmFlagId => (LLM_FLAG_IDS as readonly string[]).includes(s);

export interface Flag {
  id: FlagId;
  source: "engine" | "llm";
  severity: Severity;
  /** дословная цитата из документа (LLM-флаги) */
  quote?: string;
  /** готовое объяснение (LLM); если нет — берётся шаблон flag.<id>.expl из словаря */
  explanation?: string;
  vars?: Record<string, string | number>;
}

const ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2 };

/** Движковые и LLM-флаги в один список без дублей по id, самые тяжёлые первыми. */
export function mergeFlags(engine: Flag[], llm: Flag[]): Flag[] {
  const seen = new Set<string>();
  const out: Flag[] = [];
  for (const f of [...engine, ...llm]) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
