"use client";

import { createContext, useContext } from "react";
import { getDict, type Locale } from ".";

const I18nContext = createContext<Locale>("tr");

/** Only the locale crosses the server/client boundary; dictionaries hold functions. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useT() {
  const locale = useContext(I18nContext);
  return { t: getDict(locale), locale };
}
