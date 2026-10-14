"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "P&L", active: (p: string) => p === "/" },
  { href: "/income-recognition", label: "Income Recognition", active: (p: string) => p.startsWith("/income-recognition") },
];

// Pestañas dentro de la barra Tech Blue: activa en blanco con subrayado Propel Blue.
export default function Navigator() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full items-stretch gap-1">
      {TABS.map((t) => {
        const on = t.active(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors ${
              on ? "border-propel text-white" : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
