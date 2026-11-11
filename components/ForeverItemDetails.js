'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// WoW: Forever dungeon pages: fetch icons, quality and stats for its loot from Battle.net.
// Runs by itself once per visit when some items are missing them; there's also a button.
export default function ForeverItemDetails({ dungeon, items, onDone }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const started = useRef(false);
  const isForever = /forever/i.test(dungeon?.notes ?? '');
  const missing = items.filter((i) => !i.icon).length;

  async function run() {
    setBusy(true); setErr(''); setMsg('Getting item icons and stats from Battle.net…');
    try {
      const { data } = await supabase.auth.getSession();
      let after = 0, filled = 0, identified = 0, notFound = 0;
      for (let n = 0; n < 15; n++) {
        const r = await fetch('/api/forever-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
          body: JSON.stringify({ after }),
        });
        const b = await r.json().catch(() => ({}));
        if (!r.ok || b.ok === false) throw new Error(b.error ?? `Battle.net (${r.status})`);
        filled += b.filled ?? 0; identified += b.identified ?? 0; notFound += b.notFound ?? 0;
        if (b.done || !b.after) break;
        after = b.after;
      }
      setMsg(`Done: ${filled} item${filled === 1 ? '' : 's'} updated${identified ? `, ${identified} matched by name` : ''}${notFound ? `, ${notFound} Blizzard doesn't list yet` : ''}.`);
      onDone?.();
    } catch (e) {
      setErr(e.message); setMsg('');
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!isForever || !missing || started.current) return;
    started.current = true;
    const key = `forever-items-${dungeon.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* ok */ }
    run();
  }, [isForever, missing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isForever || (!missing && !msg && !err)) return null;
  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="small">
          {busy || msg ? msg : `${missing} item${missing === 1 ? '' : 's'} here ${missing === 1 ? 'has' : 'have'} no icon or stats yet.`}
          {err && <span className="error"> {err}</span>}
        </span>
        {!busy && missing > 0 && <button className="btn ghost small" onClick={run}>Get from Battle.net</button>}
      </div>
    </section>
  );
}
