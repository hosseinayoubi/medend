import "./globals.css";
import type { Metadata } from "next";
import { Vazirmatn, Noto_Sans_Arabic, Noto_Sans_Hebrew } from "next/font/google";

export const metadata: Metadata = {
  title: "medend",
  description: "Medical assistant",
};

const vazir = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-vazir",
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  display: "swap",
});

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  variable: "--font-hebrew",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${vazir.variable} ${notoArabic.variable} ${notoHebrew.variable}`}>
        {children}
      </body>
    </html>
  );
}
