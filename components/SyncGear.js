'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { applySync, parseAddonExport } from '@/lib/gearSync';
import { timeAgo } from './ActivityFeed';

// "Sync from game" panel on your own character page.
export default function SyncGear({ character, onSynced }) {
  const [mode, setMode] = useState(null); // null | 'paste'
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function summary(r, how) {
    const bits = [`${r.equipped} item${r.equipped === 1 ? '' : 's'} equipped`];
    if (r.level) bits.push(`level ${r.level}`);
    if (r.received) bits.push(`${r.received} Need${r.received === 1 ? '' : 's'} ticked off`);
    return `Synced from ${how}: ${bits.join(', ')}.`;
  }

  async function syncBattleNet() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch('/api/sync-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ characterId: character.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        throw new Error(`${body.error ?? `Sync failed (${res.status})`} (Checked ${at}${body.detail ? ` · ${body.detail.replace(/^WoW: Forever check: /, '')}` : ''})`);
      }
      setMessage(summary(body, 'Battle.net'));
      onSynced?.();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  async function importPaste(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const parsed = parseAddonExport(text);
      const first = (n) => n.trim().toLowerCase().split(/\s+/)[0]; // the game only shows the first name ("Lowkey" for "Lowkey Good")
      if (first(parsed.name) !== first(character.name)
        && !confirm(`That text is for ${parsed.name}, but this page is ${character.name}. Import it anyway?`)) {
        setBusy(false);
        return;
      }
      const r = await applySync(supabase, character.id, { level: parsed.level, items: parsed.items, source: 'addon' });
      // Remember the exact in-game realm so Battle.net Sync can find it (ignored if the column isn't there yet)
      if (parsed.realm) await supabase.from('characters').update({ server_name: parsed.realm }).eq('id', character.id).then(() => {}, () => {});
      setMessage(summary({ ...r, level: parsed.level }, 'the addon'));
      setText('');
      setMode(null);
      onSynced?.();
    } catch (err) {
      setError(err.message ?? String(err));
    }
    setBusy(false);
  }

  return (
    <div className="sync-box">
      <div className="row spread">
        <div>
          <strong>Sync from the game</strong>
          <div className="muted small">
            {character.synced_at
              ? <>Last synced {timeAgo(character.synced_at)} via {character.sync_source === 'battle.net' ? 'Battle.net' : 'the addon'}</>
              : 'Fills in your gear and level automatically'}
          </div>
        </div>
        <div className="row">
          <button className="btn small" onClick={syncBattleNet} disabled={busy} title="Needs your ruleset (or realm) set on this character">
            {busy && mode !== 'paste' ? 'Syncing…' : '⟳ Battle.net'}
          </button>
          <button className="btn ghost small" onClick={() => setMode(mode === 'paste' ? null : 'paste')} disabled={busy}>
            Paste from addon
          </button>
        </div>
      </div>

      {mode === 'paste' && (
        <form onSubmit={importPaste} className="stack" style={{ marginTop: '0.75rem' }}>
          <p className="muted small" style={{ margin: 0 }}>
            In game, type <code>/solitude</code>, press <strong>Ctrl+C</strong>, then paste here with <strong>Ctrl+V</strong>.
          </p>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="SOL1^…" autoFocus />
          <div className="row">
            <button className="btn small" type="submit" disabled={busy || !text.trim()}>{busy ? 'Importing…' : 'Import gear'}</button>
            <button className="btn ghost small" type="button" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </form>
      )}

      {message && <p className="success small" style={{ margin: '0.6rem 0 0' }}>{message}</p>}
      {error && <p className="error small" style={{ margin: '0.6rem 0 0' }}>{error}</p>}
    </div>
  );
}
