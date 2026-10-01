import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { getLocale } from "@/i18n/server";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-display",
});
const body = Geist({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono" });

export const metadata: Metadata = { title: "Social Share", applicationName: "Social Share" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17181C" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
