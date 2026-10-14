import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/session";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const email = await readSession((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <html lang="es" className={`${newScience.variable} h-full antialiased`}>
      <body className="min-h-full bg-pacer text-ink">
        <header className="sticky top-0 z-50 bg-nav">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-3 sm:px-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-pacer-white.svg" alt="PropellingTech" className="h-5 w-auto shrink-0" />
            {email && (
              <div className="h-full min-w-0 flex-1 overflow-x-auto">
                <Navigator />
              </div>
            )}
            <div className="ml-auto flex shrink-0 items-center gap-4">
              {email ? (
                <form method="post" action="/api/logout" className="flex items-center gap-3">
                  <span className="hidden text-xs text-white/60 md:inline">{email}</span>
                  <button type="submit" className="text-xs font-medium text-white/80 hover:text-white">
                    Sign out
                  </button>
                </form>
              ) : (
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">Reporting</span>
              )}
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
