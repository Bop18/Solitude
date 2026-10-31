'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { QUALITY } from '@/lib/wow';

const qualityColor = (q) => QUALITY[q]?.color ?? (q === 'artifact' ? '#e6cc80' : q === 'heirloom' ? '#00ccff' : QUALITY.common?.color);

// Character page for a retail character: their gear live from Blizzard (with icons),
// instead of the Classic loot tools.
export default function RetailCharacter({ character }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(fresh = false) {
    setBusy(true);
    setError('');
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch('/api/retail-gear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token ?? ''}` },
      body: JSON.stringify({ characterId: character.id, fresh }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? `Failed (${res.status})`);
    else setData(body);
    setBusy(false);
  }

  useEffect(() => { load(); }, [character.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="panel">
      <div className="row spread">
        <h2>Gear{data?.avgIlvl ? <span className="muted small"> · item level {data.avgIlvl}</span> : null}</h2>
        <div className="row">
          <Link className="btn ghost small" href="/progress?game=retail">Progress</Link>
          <a className="btn ghost small" href="#logs">Logs</a>
          <button className="btn ghost small" onClick={() => load(true)} disabled={busy}>{busy ? 'Loading…' : 'Refresh'}</button>
        </div>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>Straight from Blizzard. It updates when {character.name} logs out.</p>
      {error ? <p className="error">{error}</p> : !data ? <p className="muted">Loading from Blizzard…</p> : (
        <div className="retail-gear">
          {data.gear.map((g) => (
            <div key={g.slot} className="retail-gear-row">
              {g.empty ? (
                <>
                  <span className="retail-icon empty" />
                  <div><div className="muted small">{g.slot}</div><div className="muted">Empty</div></div>
                </>
              ) : (
                <>
                  <a href={`https://www.wowhead.com/item=${g.id}${g.bonus ? `?bonus=${g.bonus}` : ''}`} target="_blank" rel="noreferrer"
                    data-wowhead={`item=${g.id}${g.bonus ? `&bonus=${g.bonus}` : ''}`}>
                    {g.icon
                      ? <img className="retail-icon" src={g.icon} alt="" style={{ borderColor: qualityColor(g.quality) }} />
                      : <span className="retail-icon" style={{ borderColor: qualityColor(g.quality) }} />}
                  </a>
                  <div style={{ minWidth: 0 }}>
                    <div className="muted small">{g.slot}{g.ilvl ? <> · <strong className="ilvl">{g.ilvl}</strong></> : null}</div>
                    <a className="retail-item-name" href={`https://www.wowhead.com/item=${g.id}`} target="_blank" rel="noreferrer" style={{ color: qualityColor(g.quality) }}>{g.name}</a>
                    {(g.enchant || g.gems.length > 0 || g.set) && (
                      <div className="muted small retail-extras">
                        {[g.set, g.enchant, g.gems.length ? g.gems.join(', ') : null].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
