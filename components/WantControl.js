'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PRIORITY } from '@/lib/wow';

// The Want button used on dungeon pages and Loot needs.
// - Not wanted yet: "Want" / "Want too" → asks High / Medium / Low
// - Already wanted by your character: change priority or remove
// Everyone has their own request, so other people wanting an item never blocks you.
export default function WantControl({ itemId, wanters, charId, onChanged, onError }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const mine = charId ? wanters.find((w) => String(w.character_id) === String(charId)) : null;

  async function run(query) {
    setBusy(true);
    onError?.('');
    const { error } = await query;
    setBusy(false);
    setPicking(false);
    if (error) onError?.(error.message);
    onChanged?.();
  }

  if (!charId) {
    return (
      <button className="btn small" onClick={() => onError?.('Add a character on the Roster page first, then you can want items.')}>
        Want
      </button>
    );
  }

  if (picking) {
    return (
      <div className="prio-picker">
        <span className="muted small">How much?</span>
        {[1, 2, 3].map((p) => (
          <button
            key={p}
            disabled={busy}
            className={`btn small prio-btn prio-btn-${p}`}
            onClick={() =>
              run(
                supabase
                  .from('wishlist')
                  .upsert({ character_id: Number(charId), item_id: itemId, priority: p, obtained: false }, { onConflict: 'character_id,item_id' })
              )
            }
          >
            {PRIORITY[p]}
          </button>
        ))}
        <button className="btn ghost small" onClick={() => setPicking(false)} aria-label="Cancel">✕</button>
      </div>
    );
  }

  if (mine) {
    return (
      <div className="row" style={{ flexWrap: 'nowrap', gap: '0.4rem', display: 'inline-flex' }}>
        <select
          value={mine.priority}
          disabled={busy}
          onChange={(e) => run(supabase.from('wishlist').update({ priority: Number(e.target.value) }).eq('id', mine.id))}
          style={{ width: 'auto', padding: '0.3rem 0.5rem' }}
          aria-label="Your priority"
        >
          {[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
        </select>
        <button className="btn ghost small" disabled={busy} onClick={() => run(supabase.from('wishlist').delete().eq('id', mine.id))}>
          Remove
        </button>
      </div>
    );
  }

  return (
    <button className="btn small" onClick={() => setPicking(true)}>
      {wanters.length ? 'Want too' : 'Want'}
    </button>
  );
}
