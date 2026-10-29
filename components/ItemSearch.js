'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ItemName from './ItemName';

// Type-to-search over all items. onPick(item) when chosen from the list,
// onFreeText(text) if they press Enter without choosing (unknown/new item).
export default function ItemSearch({ slots, initial = '', onPick, onFreeText, onCancel, autoFocus = true, placeholder = 'Start typing an item name…' }) {
  const [q, setQ] = useState(initial);
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    const text = q.trim();
    if (text.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      let query = supabase
        .from('items')
        .select('*')
        .ilike('name', `%${text.replace(/[%_]/g, '')}%`)
        .order('req_level', { ascending: false, nullsFirst: false })
        .limit(10);
      if (slots?.length) query = query.in('slot', slots);
      const { data } = await query;
      // Exact / starts-with matches first
      const lower = text.toLowerCase();
      const sorted = (data ?? []).sort((a, b) =>
        (b.name.toLowerCase().startsWith(lower) - a.name.toLowerCase().startsWith(lower)));
      setResults(sorted);
      setActive(0);
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q, slots]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Escape') onCancel?.();
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) onPick(results[active]);
      else if (q.trim()) onFreeText?.(q.trim());
    }
  }

  return (
    <div className="item-search">
      <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} autoFocus={autoFocus} placeholder={placeholder} aria-label="Search items" />
      {results.length > 0 && (
        <div className="item-search-results" role="listbox">
          {results.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
            >
              <ItemName item={item} plain />
              <span className="muted small">{[item.slot, item.req_level ? `req ${item.req_level}` : null].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
