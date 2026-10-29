'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function LootTabs() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      <Link href="/loot" className={pathname === '/loot' ? 'active' : ''}>Who needs what</Link>
      <Link href="/loot/history" className={pathname === '/loot/history' ? 'active' : ''}>Loot history</Link>
    </nav>
  );
}
