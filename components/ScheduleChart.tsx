"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTenge } from "@/lib/finance/money";
import type { Analysis } from "@/lib/finance/types";
import { useI18n } from "@/lib/i18n/context";
import { CHART_COLORS } from "./MoneyBreakdown";
import { Button, Card, SectionTitle } from "./ui";

export function ScheduleChart({ a }: { a: Analysis }) {
  const { t } = useI18n();
  const [showTable, setShowTable] = useState(false);
  const data = useMemo(
    () =>
      a.schedule.map((r) => ({
        month: r.month,
        body: Math.round(r.principalPart / 100),
        interest: Math.round(r.interest / 100),
        extras: Math.round((r.fee + r.insurance) / 100),
      })),
    [a],
  );
  return (
    <Card>
      <SectionTitle>{t("schedule.title")}</SectionTitle>
      <div className="h-64" role="img" aria-label={t("schedule.title")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis width={70} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString("ru-RU")} ₸`} labelFormatter={(m) => `${t("schedule.month")} ${m}`} />
            <Legend />
            <Bar dataKey="body" stackId="a" name={t("money.body")} fill={CHART_COLORS.body} isAnimationActive={false} />
            <Bar dataKey="interest" stackId="a" name={t("money.interest")} fill={CHART_COLORS.interest} isAnimationActive={false} />
            <Bar dataKey="extras" stackId="a" name={t("schedule.extras")} fill={CHART_COLORS.fees} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Button variant="ghost" className="mt-2" onClick={() => setShowTable((s) => !s)} aria-expanded={showTable}>
        {showTable ? t("schedule.hide_table") : t("schedule.show_table")}
      </Button>
      {showTable && (
        <div className="mt-2 max-h-80 overflow-auto">
          <table className="w-full text-right text-sm">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="p-2 text-left">{t("schedule.month")}</th>
                <th className="p-2">{t("schedule.payment")}</th>
                <th className="p-2">{t("money.interest")}</th>
                <th className="p-2">{t("schedule.balance")}</th>
              </tr>
            </thead>
            <tbody>
              {a.schedule.map((r) => (
                <tr key={r.month} className="border-b border-slate-100">
                  <td className="p-2 text-left">{r.month}</td>
                  <td className="p-2">{formatTenge(r.total, { decimals: true })}</td>
                  <td className="p-2">{formatTenge(r.interest, { decimals: true })}</td>
                  <td className="p-2">{formatTenge(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
