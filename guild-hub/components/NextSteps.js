'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { classColor } from '@/lib/wow';
import { itemsForLevels, loadDungeons, mainsByOwner, rankDungeons } from '@/lib/suggest';
import ItemName from './ItemName';

// Dashboard: a short, personal to-do list. Everything links to where you fix it.
export default function NextSteps() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [steps, setSteps] = useState(null);
  const [upgrade, setUpgrade] = useState(null);

  const [reload, setReload] = useState(0);
  // Refresh when you sign up from the Tonight banner
  useEffect(() => {
    const again = () => setReload((n) => n + 1);
    window.addEventListener('solitude:signup', again);
    return () => window.removeEventListener('solitude:signup', again);
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const soon = new Date(Date.now() + 8 * 86400e3).toISOString();
      const [chars, events, hours, dungeons] = await Promise.all([
        supabase.from('characters').select('id, name, class, level, role, owner, is_main, synced_at, character_gear(slot, item_name, items(*)), wishlist(id, obtained)').eq('owner', userId).then((r) => r.data ?? []),
        supabase.from('events').select('id, title, starts_at, event_signups(user_id, status)').gte('starts_at', new Date().toISOString()).lte('starts_at', soon).order('starts_at').then((r) => r.data ?? []),
        supabase.from('availability_hours').select('day', { count: 'exact', head: true }).eq('user_id', userId).then((r) => r.count ?? 0, () => 0),
        loadDungeons(),
      ]);

      const out = [];
      const main = mainsByOwner(chars)[userId];

      if (!chars.length) {
        out.push({ icon: '＋', text: 'Add your character so the site can track you', href: '/roster', cta: 'Add one' });
      }

      // Runs you haven't answered
      const unanswered = events.filter((e) => !(e.event_signups ?? []).some((s) => s.user_id === userId));
      for (const e of unanswered.slice(0, 3)) {
        out.push({ icon: '?', text: <>You haven&apos;t answered <strong>{e.title}</strong> · {fmt(e.starts_at)}</>, href: `/events/${e.id}`, cta: 'Answer' });
      }
      // Runs you're going to
      const going = events.filter((e) => (e.event_signups ?? []).some((s) => s.user_id === userId && s.status === 'going'));
      for (const e of going.slice(0, 2)) {
        out.push({ icon: '✓', tone: 'ok', text: <>You&apos;re going to <strong>{e.title}</strong> · {fmt(e.starts_at)}</>, href: `/events/${e.id}`, cta: 'View' });
      }

      if (!hours) out.push({ icon: '◷', text: 'Fill in when you can play, so runs get planned around you', href: '/availability', cta: 'Fill in' });

      if (main && !main.synced_at && !(main.character_gear ?? []).length) {
        out.push({ icon: '⇅', text: <>Sync <strong style={{ color: classColor(main.class) }}>{main.name}</strong>&apos;s gear so upgrades are accurate</>, href: '/companion', cta: 'Set up' });
      }

      const openNeeds = chars.flatMap((c) => c.wishlist ?? []).filter((w) => !w.obtained).length;
      if (openNeeds) out.push({ icon: '★', text: <>{openNeeds} item{openNeeds === 1 ? '' : 's'} on your need list</>, href: '/dungeons', cta: 'See them' });
      else if (chars.length) out.push({ icon: '★', text: 'Your need list is empty. Browse a dungeon and press Need on what you want', href: '/dungeons', cta: 'Browse' });

      setSteps(out);

      // Best single upgrade for your main in the most useful dungeon
      if (main) {
        try {
          const items = await itemsForLevels(main.level, main.level);
          const top = rankDungeons({ characters: [main], items, dungeons })[0];
          if (top?.perChar[0]?.best) setUpgrade({ main, dungeon: top.dungeon, count: top.total, best: top.perChar[0].best });
        } catch { /* optional */ }
      }
    })();
  }, [userId, reload]);

  return (
    <section className="panel">
      <h2>Your next steps</h2>
      {!steps ? <p className="muted">Loading…</p> : (
        <ul className="todo">
          {upgrade && (
            <li className="todo-item todo-up">
              <span className="todo-icon">▲</span>
              <span className="todo-text">
                <strong>{upgrade.dungeon.name}</strong> has {upgrade.count} upgrade{upgrade.count === 1 ? '' : 's'} for <span style={{ color: classColor(upgrade.main.class) }}>{upgrade.main.name}</span>.
                {' '}Best: <ItemName item={upgrade.best.item} />
              </span>
              <Link className="btn ghost small" href={`/dungeons/${upgrade.dungeon.id}`}>Look</Link>
            </li>
          )}
          {steps.map((s, i) => (
            <li key={i} className={`todo-item ${s.tone === 'ok' ? 'todo-ok' : ''}`}>
              <span className="todo-icon">{s.icon}</span>
              <span className="todo-text">{s.text}</span>
              <Link className="btn ghost small" href={s.href}>{s.cta}</Link>
            </li>
          ))}
          {!upgrade && steps.length === 0 && <li className="muted">All caught up. Nice.</li>}
        </ul>
      )}
    </section>
  );
}

function fmt(iso) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
