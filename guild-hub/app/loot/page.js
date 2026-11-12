'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// "Who needs what" now lives on each dungeon's page (Dungeons → open one → Needed).
// Old links to /loot land there; /loot/history is the loot record.
export default function LootRedirect() {
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const dungeon = q.get('dungeon');
    if (dungeon) router.replace(`/dungeons/${dungeon}`);
    else router.replace(q.get('game') === 'retail' ? '/dungeons?game=retail' : '/dungeons');
  }, [router]);
  return <p className="muted">Taking you to Dungeons…</p>;
}
