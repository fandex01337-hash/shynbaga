import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/lib/i18n/context";
import { Montserrat } from "next/font/google";
import "./globals.css";

// cyrillic-ext — для казахских букв ә, ғ, қ, ң, ө, ұ, ү, һ, і
const montserrat = Montserrat({ subsets: ["latin", "cyrillic", "cyrillic-ext"], variable: "--font-montserrat", display: "swap" });

export const metadata: Metadata = {
  title: "Шынбаға — честная цена кредита",
  description: "Покажите кредит — скажем, сколько он стоит на самом деле",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={montserrat.variable}>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
