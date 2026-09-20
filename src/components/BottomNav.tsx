"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, Camera, Home, Thermometer } from "lucide-react";

const LINKS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/inventory", label: "Cigars", Icon: Boxes },
  { href: "/scan", label: "Scan", Icon: Camera },
  { href: "/humidors", label: "Humidors", Icon: Thermometer },
  { href: "/analytics", label: "Stats", Icon: BarChart3 },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {LINKS.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-1 py-3 text-[11px] transition-colors"
                style={{ color: active ? "var(--accent)" : "var(--muted)" }}
              >
                <Icon size={20} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
