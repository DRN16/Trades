"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Screener" },
  { href: "/journal", label: "Journal" },
  { href: "/settings", label: "Settings" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border bg-panel px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <span className="font-semibold text-accent">Trading Screener & Journal</span>
      <div className="flex gap-4 text-sm">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname?.startsWith(l.href) ? "text-accent font-semibold" : "text-gray-400"}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
