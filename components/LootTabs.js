'use client';

import Link from 'next/link';

// Loot history header: who needs what is now on each dungeon's page.
export default function LootTabs() {
  return (
    <p className="muted small" style={{ marginTop: 0 }}>
      Who needs what is on each dungeon&apos;s page: <Link href="/dungeons">Dungeons</Link> → open one → <strong>Needed</strong>.
    </p>
  );
}
