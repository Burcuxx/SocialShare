import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, getDict, isLocale, LOCALES, type Locale } from ".";

/** cookie "lang" → Accept-Language → "tr". */
export async function getLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get("lang")?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.split(";")[0].trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return LOCALES.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : LOCALES[0];
}

export async function getT() {
  const locale = await getLocale();
  return { t: getDict(locale), locale };
}
