'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// Loads this season's retail dungeons and raids (bosses + loot) from Blizzard, one at a time.
export default function ImportRetail({ onDone }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');

  async function call(body) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/retail-journal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? `Failed (${res.status})`);
    return out;
  }

  async function run() {
    setBusy(true); setError(''); setLog([]);
    try {
      const { season, instances } = await call({ step: 'list' });
      setLog([`${season}: ${instances.length} dungeons and raids`]);
      for (const inst of instances) {
        setLog((l) => [...l, `Loading ${inst.name}…`]);
        const r = await call({ step: 'instance', id: inst.id, kind: inst.kind });
        setLog((l) => [...l.slice(0, -1), `✓ ${r.name}: ${r.bosses} bosses, ${r.items} items`]);
      }
      setLog((l) => [...l, 'All done.']);
      onDone?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  return (
    <div style={{ marginTop: '0.6rem' }}>
      <button className="btn" onClick={run} disabled={busy}>{busy ? 'Loading from Blizzard…' : 'Load this season’s dungeons & raids'}</button>
      {log.length > 0 && <ul className="plain-list muted small" style={{ marginTop: '0.75rem' }}>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
