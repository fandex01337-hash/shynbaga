"use client";

import { Camera, FileText, FileUp, Handshake, Loader2, PencilLine, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { LIMITS } from "@/lib/config/thresholds";
import { useI18n } from "@/lib/i18n/context";
import { PRESETS } from "@/lib/presets";
import { Button, Card } from "./ui";
import { PresetButtons } from "./PresetButtons";

export interface InputHandlers {
  onText: (text: string, presetId?: string) => void;
  onImage: (file: File) => void;
  onPdf: (file: File) => void;
  /** Возвращает текст из Word или null при ошибке */
  onDocx: (file: File) => Promise<string | null>;
  onInstallment: () => void;
  onManual: () => void;
  onGenerate: () => void;
}

export function InputPanel({
  handlers,
  busy,
  generating,
  llm,
}: {
  handlers: InputHandlers;
  busy: boolean;
  generating: boolean;
  /** null — ещё не знаем, false — ключа нет */
  llm: boolean | null;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"none" | "text">("none");
  const [text, setText] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const docxRef = useRef<HTMLInputElement>(null);
  const tooLong = text.length > LIMITS.maxTextChars;

  const pickPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setText(p.text);
    setMode("text");
    handlers.onText(p.text, id);
  };

  return (
    <Card>
      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant={mode === "text" ? "primary" : "secondary"} onClick={() => setMode("text")} disabled={busy}>
          <FileText aria-hidden size={20} /> {t("input.paste")}
        </Button>
        <Button variant="secondary" onClick={() => cameraRef.current?.click()} disabled={busy || llm === false}>
          <Camera aria-hidden size={20} /> {t("input.photo")}
        </Button>
        <Button variant="secondary" onClick={handlers.onManual} disabled={busy}>
          <PencilLine aria-hidden size={20} /> {t("input.manual")}
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handlers.onImage(f);
        }}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handlers.onPdf(f);
        }}
      />

      <input
        ref={docxRef}
        type="file"
        accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          void handlers.onDocx(f).then((doc) => {
            if (!doc) return;
            // Текст всегда виден в поле; разбор — только если ИИ доступен
            setText(doc);
            setMode("text");
            if (llm !== false) handlers.onText(doc);
          });
        }}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => docxRef.current?.click()} disabled={busy}>
          <FileUp aria-hidden size={20} /> {t("input.docx")}
        </Button>
        <Button variant="secondary" onClick={handlers.onInstallment} disabled={busy}>
          <Handshake aria-hidden size={20} /> {t("input.installment")}
        </Button>
      </div>

      <button
        type="button"
        disabled={busy || generating}
        onClick={handlers.onGenerate}
        className="mt-3 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-700 bg-blue-50 px-4 py-3 text-left font-semibold text-blue-900 hover:bg-blue-100 disabled:opacity-60"
      >
        {generating ? <Loader2 aria-hidden size={24} className="shrink-0 animate-spin" /> : <Sparkles aria-hidden size={24} className="shrink-0" />}
        <span>
          {generating ? t("sample.generating") : t("input.generate")}
          <span className="block text-sm font-normal text-blue-800">{t("input.generate_hint")}</span>
        </span>
      </button>

      <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">🔒 {t("input.privacy_photo")}</p>
      {llm === false && <p className="mt-3 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{t("input.no_llm")}</p>}

      {mode === "text" && (
        <div className="mt-4">
          <label htmlFor="doc-text" className="mb-1 block font-semibold">
            {t("input.text_label")}
          </label>
          <textarea
            id="doc-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-slate-300 p-3 text-base"
            placeholder={t("input.text_placeholder")}
          />
          <div className="mt-1 flex justify-between text-sm text-slate-600">
            <span className={tooLong ? "font-semibold text-red-700" : ""}>
              {text.length} / {LIMITS.maxTextChars}
            </span>
            <span>{t("input.redact_note")}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button disabled={busy || !text.trim() || tooLong || llm === false} onClick={() => handlers.onText(text)}>
              {t("input.analyze")}
            </Button>
            <Button variant="secondary" disabled={busy || llm === false} onClick={() => pdfRef.current?.click()}>
              <Upload aria-hidden size={18} /> {t("input.pdf")}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-slate-200 pt-4">
        <PresetButtons onPick={pickPreset} disabled={busy} />
      </div>
    </Card>
  );
}
