"use client";

import { PRESETS } from "@/lib/presets";
import { useI18n } from "@/lib/i18n/context";

export function PresetButtons({ onPick, disabled }: { onPick: (id: string) => void; disabled?: boolean }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{t("presets.title")}</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.filter((p) => p.id !== "contract").map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p.id)}
            className="min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {t(`preset.${p.id}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
