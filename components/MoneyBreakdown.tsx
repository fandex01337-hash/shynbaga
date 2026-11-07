"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { formatPercent, formatTenge } from "@/lib/finance/money";
import type { Analysis } from "@/lib/finance/types";
import { useI18n } from "@/lib/i18n/context";
import { Card, SectionTitle } from "./ui";

export const CHART_COLORS = { body: "#1d4ed8", interest: "#b91c1c", fees: "#b45309", insurance: "#6d28d9" } as const;
const KEYS = ["body", "interest", "fees", "insurance"] as const;

export function MoneyBreakdown({ a }: { a: Analysis }) {
  const { t } = useI18n();
  const total = a.totalPaid;
  const items = KEYS.map((k) => ({ key: k, value: a.breakdown[k] })).filter((i) => i.value > 0);
  return (
    <Card>
      <SectionTitle>{t("money.title")}</SectionTitle>
      <div className="grid items-center gap-4 sm:grid-cols-2">
        <div className="h-56" role="img" aria-label={t("money.title")}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="value" nameKey="key" innerRadius="55%" outerRadius="90%" paddingAngle={2} isAnimationActive={false}>
                {items.map((i) => (
                  <Cell key={i.key} fill={CHART_COLORS[i.key]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Легенда — таблица: цвет дублируется текстом и цифрами */}
        <table className="w-full text-left">
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  <span aria-hidden className="mr-2 inline-block size-3 rounded-sm" style={{ background: CHART_COLORS[i.key] }} />
                  {t(`money.${i.key}`)}
                </td>
                <td className="py-2 text-right font-semibold">{formatTenge(i.value)}</td>
                <td className="py-2 pl-2 text-right text-slate-600">{formatPercent((i.value / total) * 100, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
