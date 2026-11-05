'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { bnetCall } from '@/components/BattleNetLogin';

// Blizzard sends you back here after "Log in with Battle.net"
export default function BattleNetCallback() {
  const { session } = useAuth();
  const [msg, setMsg] = useState('Connecting to Battle.net…');
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (!session || done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    if (q.get('error')) { setError('Battle.net login was cancelled.'); return; }
    let expected = null;
    try { expected = sessionStorage.getItem('bnet-state'); sessionStorage.removeItem('bnet-state'); } catch { /* ok */ }
    if (!q.get('code') || (expected && expected !== q.get('state'))) { setError('That login link was out of date. Try again from Settings.'); return; }
    bnetCall('finish', { code: q.get('code'), redirectUri: `${window.location.origin}/bnet/callback` })
      .then((r) => {
        setMsg(`Connected${r.battletag ? ` as ${r.battletag}` : ''}. Found ${r.found} WoW: Forever character${r.found === 1 ? '' : 's'}${r.updated ? `, updated ${r.updated}` : ''}.`);
        window.dispatchEvent(new Event('solitude:synced'));
      })
      .catch((e) => setError(e.message));
  }, [session]);

  return (
    <section className="panel">
      <h1>Battle.net</h1>
      {error ? <p className="error">{error}</p> : <p>{msg}</p>}
      <Link className="btn" href="/settings">Back to Settings</Link>
    </section>
  );
}
