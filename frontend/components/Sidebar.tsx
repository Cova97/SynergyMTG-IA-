'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Colección' },
  { href: '/decks', label: 'Decks' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-surface px-5 py-6 flex flex-col gap-8">
      <div>
        <h1 className="font-display italic text-2xl text-text-primary tracking-tight">
          Synergy<span className="text-accent not-italic">MTG</span>
        </h1>
        <p className="text-xs text-text-muted mt-1">tu mesa, tus combos</p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-raised'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
