import { kk } from "./kk";
import { ru } from "./ru";

export type Lang = "ru" | "kk";
export const LANGS: Lang[] = ["ru", "kk"];

const dicts: Record<Lang, Record<string, string>> = { ru, kk };

/** Подстановка {name}; нет перевода на казахском — берём русский; нет вовсе — сам ключ. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const tpl = dicts[lang][key] ?? ru[key] ?? key;
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export { ru, kk };
