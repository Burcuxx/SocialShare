import { en } from "./en";
import { tr } from "./tr";

/** To add a language: create <code>.ts with `export const xx: Dict = {...}` and list it here. */
export const LOCALES = ["tr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type Dict = typeof tr;
export type ErrorCode = keyof Dict["errors"];

export const DEFAULT_LOCALE: Locale = "tr";
export const LOCALE_NAMES: Record<Locale, string> = { tr: "Türkçe", en: "English" };
export const INTL_LOCALE: Record<Locale, string> = { tr: "tr-TR", en: "en-US" };

const DICTS: Record<Locale, Dict> = { tr, en };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function getDict(locale: Locale) {
  return DICTS[locale];
}

/** SQLite datetime('now') is UTC without a zone: "2026-10-01 14:32:00". */
function parseDbDate(value: string) {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

/** "Bugün 14:32" / "Today 2:32 PM", otherwise a medium date and short time. */
export function formatDate(value: string, locale: Locale) {
  const date = parseDbDate(value);
  const intl = INTL_LOCALE[locale];
  const time = date.toLocaleTimeString(intl, { timeStyle: "short" });
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(new Date())) / 86_400_000);
  if (days === 0 || days === -1) {
    const word = new Intl.RelativeTimeFormat(intl, { numeric: "auto" }).format(days, "day");
    return `${word.charAt(0).toLocaleUpperCase(intl)}${word.slice(1)} ${time}`;
  }
  return date.toLocaleString(intl, { dateStyle: "medium", timeStyle: "short" });
}

export function formatDuration(sec: number | null) {
  if (sec == null) return null;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
