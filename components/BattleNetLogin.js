'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { classColor } from '@/lib/wow';

const CLIENT_ID = process.env.NEXT_PUBLIC_BLIZZARD_CLIENT_ID;

async function call(action, extra = {}) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/bnet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ action, ...extra }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Battle.net (${res.status})`);
  return body;
}

/** Sends you to Blizzard's login page; you come back to /bnet/callback. */
export function startBattleNetLogin() {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try { sessionStorage.setItem('bnet-state', state); } catch { /* ok */ }
  const q = new URLSearchParams({
    client_id: CLIENT_ID ?? '',
    redirect_uri: `${window.location.origin}/bnet/callback`,
    response_type: 'code',
    scope: 'openid wow.profile',
    state,
  });
  window.location.href = `https://oauth.battle.net/authorize?${q}`;
}

export { call as bnetCall };

// Settings panel: connect, see status, add characters Blizzard knows about
export default function BattleNetLogin() {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');

  async function load() {
    setError('');
    try { setInfo(await call('refresh')); } catch (e) { setError(e.message); setInfo({ connected: false }); }
  }
  useEffect(() => { load(); }, []);

  async function add(b) {
    setBusy(true);
    try { await call('add', { bnetId: b.id }); setAdded(`${b.name} added to the roster.`); await load(); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }
  async function disconnect() {
    setBusy(true);
    try { await call('disconnect'); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <section className="panel">
      <h2>Battle.net</h2>
      <p className="muted small">
        Connect once and the site keeps your WoW: Forever characters&apos; levels up to date by itself whenever you open it.
        Blizzard only updates a character when you log out of it (or go to character select), so level up, log out, then it shows here.
        Blizzard&apos;s login lasts a day; after that, press Reconnect (one click).
      </p>
      {!CLIENT_ID && <p className="error small">The site owner needs to add NEXT_PUBLIC_BLIZZARD_CLIENT_ID in Vercel first.</p>}
      {!info ? <p className="muted">Checking…</p> : !info.connected ? (
        <button className="btn" onClick={startBattleNetLogin} disabled={!CLIENT_ID}>Log in with Battle.net</button>
      ) : (
        <div className="stack">
          <div className="row">
            <span>Connected{info.battletag ? <> as <strong>{info.battletag}</strong></> : ''}</span>
            {info.expired
              ? <button className="btn small" onClick={startBattleNetLogin}>Reconnect</button>
              : <span className="muted small">· {info.found ?? 0} WoW: Forever character{info.found === 1 ? '' : 's'} found{info.updated ? `, ${info.updated} kept up to date` : ''}</span>}
            {!info.expired && <button className="btn small" onClick={async () => { setBusy(true); await load(); setBusy(false); window.dispatchEvent(new Event('solitude:synced')); }} disabled={busy}>{busy ? 'Updating…' : '⟳ Update now'}</button>}
            <button className="btn ghost small" onClick={disconnect} disabled={busy}>Disconnect</button>
          </div>
          {info.expired && <p className="muted small" style={{ margin: 0 }}>Your Battle.net login ran out. Reconnect to keep levels updating.</p>}
          {!info.expired && info.found === 0 && (
            <p className="muted small" style={{ margin: 0 }}>Blizzard didn&apos;t list any WoW: Forever characters yet{info.apiStatus && info.apiStatus !== 200 ? ` (it answered ${info.apiStatus})` : ''}. Log out of the game once, then come back here.</p>
          )}
          {(info.unmatched ?? []).length > 0 && (
            <div>
              <p className="muted small" style={{ margin: '0 0 0.4rem' }}>On your Battle.net account but not on the roster:</p>
              <div className="row">
                {info.unmatched.map((b) => (
                  <button key={b.id} className="btn ghost small" onClick={() => add(b)} disabled={busy}>
                    ＋ <span style={{ color: classColor(b.className) }}>{b.name}</span> · {b.level} · {b.realmName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {added && <p className="success small">{added}</p>}
      {error && <p className="error small">{error}</p>}
    </section>
  );
}
