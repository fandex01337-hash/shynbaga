import { emptyParams } from "@/lib/form";
import type { LoanParams } from "@/lib/finance/types";

export const loan = (patch: Partial<LoanParams> = {}): LoanParams => ({
  ...emptyParams(),
  principal: 1_000_000,
  termMonths: 12,
  nominalRateAnnual: 24,
  ...patch,
});
