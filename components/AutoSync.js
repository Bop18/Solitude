'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Quietly refreshes your own characters from Battle.net when you open the site,
// if they haven't been updated for a while. Nobody has to press Sync.
const STALE_HOURS = 3;

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default function AutoSync({ userId }) {
  useEffect(() => {
    if (!userId) return;
    // Battle.net not set up on this site: don't keep asking (checked again after a day)
    const off = Number(get('bnet-off') ?? 0);
    if (off && Date.now() - off < 86400e3) return;
    // Only check once per stale window per browser
    const last = Number(get('autosync-at') ?? 0);
    if (Date.now() - last < STALE_HOURS * 3600e3) return;
    set('autosync-at', String(Date.now()));

    (async () => {
      const { data: chars } = await supabase.from('characters').select('*').eq('owner', userId);
      const cutoff = Date.now() - STALE_HOURS * 3600e3;
      // Retail gear is read live on its character page, so only sync WoW: Forever / Classic here
      const due = (chars ?? []).filter((c) => c.game !== 'retail' && c.realm && (!c.synced_at || new Date(c.synced_at).getTime() < cutoff));
      if (!due.length) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      let changed = false;
      for (const c of due) {
        const res = await fetch('/api/sync-character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ characterId: c.id }),
        }).catch(() => null);
        if (!res) break;
        if (res.status === 501) { set('bnet-off', String(Date.now())); break; }
        if (res.ok) changed = true;
      }
      if (changed) window.dispatchEvent(new Event('solitude:synced'));
    })();
  }, [userId]);

  return null;
}
