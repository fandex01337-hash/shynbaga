export type ProductType =
  | "cash_loan"
  | "microloan"
  | "installment"
  | "credit_card"
  | "car_loan"
  | "mortgage"
  | "scam_suspected"
  | "unknown";

export type PaymentType = "annuity" | "differentiated";
export type FeeKind = "upfront_deducted" | "upfront_paid" | "monthly";
/** financed — страховка добавлена к телу кредита и растёт вместе с ним */
export type InsuranceMode = "monthly" | "upfront_deducted" | "upfront_paid" | "financed";

export interface FeeInput {
  name: string;
  kind: FeeKind;
  /** ₸ */
  amount: number | null;
  /** % от суммы кредита */
  percent: number | null;
}

export interface InsuranceInput {
  present: boolean;
  amount: number | null;
  percent: number | null;
  mode: InsuranceMode;
}

export interface PenaltyInput {
  description: string;
  /** % в день от просроченного платежа */
  percentPerDay: number | null;
  /** фиксированный штраф, ₸ */
  fixedAmount: number | null;
}

/** Все суммы — в тенге (число с ≤2 знаками), проценты — числом (24 = 24%). */
export interface LoanParams {
  productType: ProductType;
  principal: number | null;
  /** Цена товара при оплате сразу (для рассрочки) */
  cashPrice: number | null;
  termMonths: number | null;
  nominalRateAnnual: number | null;
  dailyRate: number | null;
  statedEffectiveRate: number | null;
  statedMonthlyPayment: number | null;
  paymentType: PaymentType;
  fees: FeeInput[];
  insurance: InsuranceInput;
  penalties: PenaltyInput[];
  monthlyIncome: number | null;
}

/** Все значения ниже — в тиынах (целые). */
export interface ResolvedCosts {
  feeDeducted: number;
  feePaid: number;
  feeMonthly: number;
  insDeducted: number;
  insPaid: number;
  insMonthly: number;
  insFinanced: number;
}

export interface ScheduleInput {
  /** тело долга в тиынах (с учётом финансируемой страховки) */
  loan: number;
  termMonths: number;
  rateAnnual: number;
  paymentType: PaymentType;
  monthlyFee: number;
  monthlyIns: number;
}

export interface ScheduleRow {
  month: number;
  principalPart: number;
  interest: number;
  /** principalPart + interest */
  payment: number;
  fee: number;
  insurance: number;
  /** payment + fee + insurance */
  total: number;
  balance: number;
}

export type RateSource = "nominal" | "daily" | "implied_from_payment" | "zero";

export interface Analysis {
  ok: true;
  termMonths: number;
  rateAnnualUsed: number;
  rateSource: RateSource;
  costs: ResolvedCosts;
  scheduleInput: ScheduleInput;
  schedule: ScheduleRow[];
  /** сколько стоит вещь/сколько реально «в руках» (тиыны) */
  base: number;
  handed: number;
  totalPaid: number;
  overpay: number;
  /** переплата / handed, % */
  overpayPct: number;
  /** наша оценка эффективной ставки, % годовых; null если не удалось посчитать */
  effectiveRateAnnual: number | null;
  firstPayment: number;
  firstPaymentTotal: number;
  breakdown: { body: number; interest: number; fees: number; insurance: number };
  /** Y / handed */
  priceMultiple: number;
  costPerDay: number;
  /** есть ли скрытая наценка: цена в рассрочку выше цены сразу */
  markup: number;
}

export type AnalysisErrorCode = "principal" | "term" | "rate";
export interface AnalysisError {
  ok: false;
  error: AnalysisErrorCode;
}
