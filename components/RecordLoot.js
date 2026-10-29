'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// "Looted" button: record who got an item. Anyone can record for anyone
// (e.g. whoever's handing out loot). Ticks it off their Need list automatically.
export default function RecordLoot({ itemId, roster, suggestedIds = [], eventId = null, onDone, onError, label = 'Looted' }) {
  const [open, setOpen] = useState(false);
  const [charId, setCharId] = useState('');
  const [busy, setBusy] = useState(false);

  // People who need it first, then everyone else
  const sorted = [
    ...roster.filter((c) => suggestedIds.includes(c.id)),
    ...roster.filter((c) => !suggestedIds.includes(c.id)),
  ];

  async function save() {
    const id = charId || sorted[0]?.id;
    if (!id) return;
    setBusy(true);
    const { error } = await supabase.from('loot_history').insert({ item_id: itemId, character_id: Number(id), event_id: eventId });
    setBusy(false);
    if (error) return onError?.(error.message);
    setOpen(false);
    setCharId('');
    onDone?.();
  }

  if (!open) {
    return (
      <button className="btn ghost small" onClick={() => setOpen(true)} title="Record who got this item">
        {label}
      </button>
    );
  }

  return (
    <div className="prio-picker">
      <select value={charId || sorted[0]?.id || ''} onChange={(e) => setCharId(e.target.value)} style={{ width: 'auto', padding: '0.3rem 0.5rem' }} aria-label="Who got it">
        {sorted.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{suggestedIds.includes(c.id) ? ' (needs it)' : ''}
          </option>
        ))}
      </select>
      <button className="btn small" onClick={save} disabled={busy || !sorted.length}>Save</button>
      <button className="btn ghost small" onClick={() => setOpen(false)} aria-label="Cancel">✕</button>
    </div>
  );
}
