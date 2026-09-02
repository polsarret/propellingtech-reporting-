"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigator() {
  const pathname = usePathname();
  const isPnl = pathname === "/" || pathname === "/pnl";
  const isIncomeRecognition = pathname.includes("income-recognition");

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b border-line">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 sm:py-0">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="text-lg font-semibold text-ink">Propelling</div>
            <div className="flex gap-1">
              <Link
                href="/"
                className={`px-4 py-2 text-sm font-medium rounded transition-all ${
                  isPnl
                    ? "bg-propel-primary text-white"
                    : "text-muted hover:text-ink hover:bg-pacer/50"
                }`}
              >
                P&L Matrix
              </Link>
              <Link
                href="/income-recognition"
                className={`px-4 py-2 text-sm font-medium rounded transition-all ${
                  isIncomeRecognition
                    ? "bg-propel-primary text-white"
                    : "text-muted hover:text-ink hover:bg-pacer/50"
                }`}
              >
                Income Recognition
              </Link>
            </div>
          </div>
          <div className="text-xs text-muted">Reporting • 2026</div>
        </div>
      </div>
    </nav>
  );
}
