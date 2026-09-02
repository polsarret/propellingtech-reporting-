import type { Metadata } from "next";
import localFont from "next/font/local";
import Navigator from "./Navigator";
import "./globals.css";

const newScience = localFont({
  src: [
    { path: "../fonts/New_Science_Regular.otf", weight: "400", style: "normal" },
    { path: "../fonts/New_Science_Medium.otf", weight: "500", style: "normal" },
    { path: "../fonts/New_Science_SemiBold.otf", weight: "600", style: "normal" },
    { path: "../fonts/New_Science_Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-newscience",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PropellingTech · Reporting",
  description: "P&L consolidado y reporting financiero · PropellingTech",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${newScience.variable} h-full antialiased`}>
      <body className="min-h-full bg-pacer text-ink">
        <header className="bg-nav">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-pacer-white.svg" alt="PropellingTech" className="h-5 w-auto" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">
              Reporting
            </span>
          </div>
        </header>
        <Navigator />
        {children}
      </body>
    </html>
  );
}
