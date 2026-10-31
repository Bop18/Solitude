'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { classColor } from '@/lib/wow';
import { clock, short } from '@/lib/wcl';

const TABS = [
  { id: 'damage', label: 'Damage', per: 'DPS' },
  { id: 'healing', label: 'Healing', per: 'HPS' },
  { id: 'deaths', label: 'Deaths' },
];

export default function LogPage() {
  const { id } = useParams();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [log, setLog] = useState(null);
  const [chars, setChars] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [fight, setFight] = useState('all');
  const [tab, setTab] = useState('damage');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [l, c] = await Promise.all([
      supabase.from('logs').select('*, events(id, title, starts_at), profiles!added_by(display_name)').eq('id', id).maybeSingle(),
      supabase.from('characters').select('id, name, class, owner'),
    ]);
    if (l.error) setError(l.error.message);
    setLog(l.data);
    setChars(c.data ?? []);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    load();
    const n = new URLSearchParams(window.location.search).get('note');
    if (n) setNote(n);
  }, [load]);

  // Match log players to our characters by name
  const charByName = useMemo(() => Object.fromEntries(chars.map((c) => [c.name.toLowerCase(), c])), [chars]);

  async function refresh() {
    setBusy(true); setError(''); setNote('');
    const { data } = await supabase.auth.getSession();
    const res = await fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ url: log.url }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) setError(body.error ?? 'Refresh failed.');
    else { setNote(body.warning ?? 'Updated from Warcraft Logs.'); await load(); }
    setBusy(false);
  }

  async function remove() {
    if (!confirm('Remove this log from the site? (It stays on Warcraft Logs.)')) return;
    const { error } = await supabase.from('logs').delete().eq('id', log.id);
    if (error) return setError(error.message);
    router.push('/logs');
  }

  if (!loaded) return <p className="muted">Loading…</p>;
  if (!log) return <p>{error ? <span className="error">{error}</span> : 'Log not found.'} <Link href="/logs">Back to logs</Link></p>;

  const d = log.data;
  const header = (
    <>
      <p style={{ margin: 0 }}><Link href="/logs" className="small">← All logs</Link></p>
      <h1>{log.title || log.zone || `Report ${log.code}`}</h1>
      <p className="muted">
        {[log.zone && log.zone !== log.title && log.zone,
          log.started_at && new Date(log.started_at).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
          d && clock(d.end - d.start),
          log.profiles?.display_name && `added by ${log.profiles.display_name}`,
        ].filter(Boolean).join(' · ')}
        {log.events && <> · Run: <Link href={`/events/${log.events.id}`}>{log.events.title}</Link></>}
      </p>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <a className="btn ghost small" href={log.url} target="_blank" rel="noreferrer">Open on Warcraft Logs ↗</a>
        <button className="btn ghost small" onClick={refresh} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh'}</button>
        {log.added_by === userId && <button className="btn danger small" onClick={remove}>Remove</button>}
      </div>
      {note && <p className="success">{note}</p>}
      {error && <p className="error">{error}</p>}
    </>
  );

  if (!d) {
    return (
      <>
        {header}
        <section className="panel">
          <p className="muted">Only the link is saved for this one. Press <strong>Refresh</strong> once the site has its Warcraft Logs keys, or if the report was private when it was added.</p>
        </section>
      </>
    );
  }

  const players = Object.fromEntries((d.players ?? []).map((p) => [p.id, p]));
  const boss = fight === 'all' ? null : d.bosses.find((b) => String(b.id) === fight);
  const view = boss ?? d.overall;
  const kills = d.bosses.filter((b) => b.kill);

  // Highlights for the whole night
  const top = (list) => list?.[0] && { p: players[list[0].id], total: list[0].total };
  const deathCount = {};
  for (const x of d.overall.deaths ?? []) deathCount[x.id] = (deathCount[x.id] ?? 0) + 1;
  const mostDeaths = Object.entries(deathCount).sort((a, b) => b[1] - a[1])[0];
  const fastest = kills.length ? kills.reduce((a, b) => (b.duration < a.duration ? b : a)) : null;

  return (
    <>
      {header}

      {fight === 'all' && (
        <div className="log-highlights">
          <Highlight label="Bosses killed" value={`${new Set(kills.map((b) => b.name)).size}/${new Set(d.bosses.map((b) => b.name)).size}`} sub={`${d.bosses.length - kills.length} wipe${d.bosses.length - kills.length === 1 ? '' : 's'}`} />
          <Highlight label="Top damage" player={top(d.overall.damage)?.p} sub={top(d.overall.damage) && short(top(d.overall.damage).total)} />
          <Highlight label="Top healing" player={top(d.overall.healing)?.p} sub={top(d.overall.healing) && short(top(d.overall.healing).total)} />
          <Highlight label="Most deaths" player={mostDeaths && players[mostDeaths[0]]} sub={mostDeaths && `${mostDeaths[1]} death${mostDeaths[1] === '1' || mostDeaths[1] === 1 ? '' : 's'}`} />
          {fastest && <Highlight label="Fastest kill" value={fastest.name} sub={clock(fastest.duration)} />}
        </div>
      )}

      <section className="panel">
        <h2>Fights</h2>
        <div className="fight-chips">
          <button className={`fight-chip ${fight === 'all' ? 'on' : ''}`} onClick={() => setFight('all')}>
            Whole night <span className="muted small">{clock(d.end - d.start)}</span>
          </button>
          {d.bosses.map((b) => (
            <button key={b.id} className={`fight-chip ${b.kill ? 'kill' : 'wipe'} ${fight === String(b.id) ? 'on' : ''}`} onClick={() => setFight(String(b.id))}>
              {b.kill ? '✓' : '✗'} {b.name}
              <span className="muted small">{clock(b.duration)}{!b.kill && b.pct != null ? ` · ${b.pct}% left` : ''}</span>
            </button>
          ))}
        </div>
        {d.bosses.length === 0 && <p className="muted small">No boss fights in this report, so you&apos;re seeing the whole log.</p>}
      </section>

      <section className="panel">
        <div className="row spread">
          <h2>{boss ? `${boss.name} · ${boss.kill ? 'Kill' : 'Wipe'} · ${clock(boss.duration)}` : 'Whole night'}</h2>
          <nav className="tabs" style={{ margin: 0 }}>
            {TABS.map((t) => (
              <a key={t.id} href="#" className={tab === t.id ? 'active' : ''} onClick={(e) => { e.preventDefault(); setTab(t.id); }}>{t.label}</a>
            ))}
          </nav>
        </div>

        {tab === 'deaths'
          ? <DeathList deaths={view.deaths} players={players} bosses={d.bosses} showFight={!boss} charByName={charByName} userId={userId} />
          : <Meter rows={view[tab] ?? []} time={view.time} per={TABS.find((t) => t.id === tab).per} players={players} charByName={charByName} userId={userId} />}
      </section>
    </>
  );
}

function Highlight({ label, value, player, sub }) {
  return (
    <div className="log-highlight">
      <div className="muted small">{label}</div>
      <div className="log-highlight-value" style={player ? { color: classColor(player.class) } : undefined}>
        {player ? player.name : value ?? '—'}
      </div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

function PlayerName({ p, charByName, userId }) {
  if (!p) return <span className="muted">Unknown</span>;
  const ours = charByName[p.name.toLowerCase()];
  const name = <strong style={{ color: classColor(p.class) }}>{p.name}</strong>;
  return (
    <>
      {ours ? <Link href={`/characters/${ours.id}`}>{name}</Link> : name}
      {ours?.owner === userId && <span className="badge gold" style={{ marginLeft: 6 }}>You</span>}
      {p.spec && <span className="muted small"> · {p.spec}</span>}
    </>
  );
}

function Meter({ rows, time, per, players, charByName, userId }) {
  if (!rows.length) return <p className="muted">Nothing recorded here.</p>;
  const max = rows[0].total;
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <div className="meter">
      {rows.map((r, i) => {
        const p = players[r.id];
        const mine = p && charByName[p.name.toLowerCase()]?.owner === userId;
        return (
          <div key={r.id} className={`meter-row ${mine ? 'mine' : ''}`}>
            <span className="meter-rank muted">{i + 1}</span>
            <div className="meter-main">
              <div className="meter-label">
                <span><PlayerName p={p} charByName={charByName} userId={userId} /></span>
                <span className="meter-nums">
                  <strong>{short(time ? (r.total / time) * 1000 : null)}</strong> <span className="muted small">{per}</span>
                  <span className="muted small"> · {short(r.total)} · {Math.round((r.total / sum) * 100)}%</span>
                </span>
              </div>
              <div className="meter-bar"><span style={{ width: `${(r.total / max) * 100}%`, background: classColor(p?.class) }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeathList({ deaths, players, bosses, showFight, charByName, userId }) {
  if (!deaths?.length) return <p className="muted">Nobody died. 🎉</p>;
  const fightName = Object.fromEntries(bosses.map((b) => [b.id, b.name]));
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Who</th>{showFight && <th>Fight</th>}<th>Killed by</th></tr></thead>
        <tbody>
          {deaths.map((x, i) => (
            <tr key={i}>
              <td className="muted">{clock(x.at)}</td>
              <td><PlayerName p={players[x.id]} charByName={charByName} userId={userId} /></td>
              {showFight && <td className="muted">{fightName[x.fight] ?? 'Trash'}</td>}
              <td>{x.by ?? '—'}{x.killer && x.killer !== x.by ? <span className="muted small"> ({x.killer})</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
