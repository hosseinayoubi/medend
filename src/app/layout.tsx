import "./globals.css";
import type { Metadata } from "next";
import {
  Inter,
  Noto_Sans_Arabic,
  Noto_Sans_Hebrew,
  Noto_Sans,
} from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  display: "swap",
});

const notoHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Medend",
  description: "Medend",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={[
        inter.className,
        notoArabic.className,
        notoHebrew.className,
        notoSans.className,
      ].join(" ")}
    >
      <body>{children}</body>
    </html>
  );
}
