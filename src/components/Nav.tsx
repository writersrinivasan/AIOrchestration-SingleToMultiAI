"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Session" },
  { href: "/learn", label: "1 · Concepts" },
  { href: "/usecase", label: "2 · Use Case" },
  { href: "/studio", label: "3 · Live Studio" },
  { href: "/lab", label: "4 · Hands-on Lab" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-2 text-sm">⚡</span>
          <span>
            ClaimFlow <span className="text-muted font-normal">· Agentic AI Orchestration</span>
          </span>
        </Link>
        <nav className="ml-auto flex gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition ${
                  active ? "bg-accent/20 text-white" : "text-muted hover:bg-panel-2 hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
