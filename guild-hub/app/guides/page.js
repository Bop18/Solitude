'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { CLASS_NAMES, ROLES, classColor } from '@/lib/wow';
import { CLASSIC_GUIDES, RETAIL_SPECS, retailLinks, classicCalcUrl } from '@/lib/classGuides';

// Class guides: best talents and how to level, per class and spec.
export default function GuidesPage() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [game, setGame] = useState('classic');
  const [cls, setCls] = useState(null);
  const [mine, setMine] = useState([]); // my characters

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('game') === 'retail') setGame('retail');
    if (q.get('class')) setCls(q.get('class'));
  }, []);

  // Start on your main's class
  useEffect(() => {
    if (!userId) return;
    supabase.from('characters').select('*').eq('owner', userId).then(({ data }) => {
      const list = data ?? [];
      setMine(list);
      setCls((c) => {
        if (c) return c;
        const pool = list.filter((x) => (game === 'retail') === (x.game === 'retail'));
        const main = pool.find((x) => x.is_main) ?? pool.sort((a, b) => b.level - a.level)[0];
        return main?.class ?? null;
      });
    });
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const classes = game === 'retail' ? Object.keys(RETAIL_SPECS) : CLASS_NAMES;
  const current = cls && classes.includes(cls) ? cls : classes[0];
  const myChar = mine.find((c) => c.class === current && (game === 'retail') === (c.game === 'retail'));

  function pick(g, c) {
    setGame(g);
    setCls(c);
    const q = new URLSearchParams();
    if (g === 'retail') q.set('game', 'retail');
    if (c) q.set('class', c);
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
  }

  return (
    <>
      <h1>Class guides</h1>
      <nav className="tabs game-tabs">
        <a href="#" className={game === 'classic' ? 'active' : ''} onClick={(e) => { e.preventDefault(); pick('classic', current); }}>Classic</a>
        <a href="#" className={game === 'retail' ? 'active' : ''} onClick={(e) => { e.preventDefault(); pick('retail', current); }}>Retail</a>
      </nav>

      <div className="class-picker">
        {classes.map((c) => (
          <button key={c} className={`class-pick ${c === current ? 'on' : ''}`} style={{ '--cc': classColor(c) }} onClick={() => pick(game, c)}>{c}</button>
        ))}
      </div>

      {game === 'classic' ? <ClassicGuide cls={current} mySpec={myChar?.spec} /> : <RetailGuide cls={current} />}
    </>
  );
}

function ClassicGuide({ cls, mySpec }) {
  const g = CLASSIC_GUIDES[cls];
  if (!g) return null;
  return (
    <>
      <p className="muted">{g.intro}</p>

      <section className="panel guide-level">
        <div className="row spread">
          <h2 style={{ color: classColor(cls) }}>Levelling: {g.level.spec}</h2>
          <a className="btn ghost small" href={classicCalcUrl(cls)} target="_blank" rel="noreferrer">Talent calculator ↗</a>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{g.level.why}</p>
        <h3>Step by step</h3>
        <ol className="guide-steps">{g.level.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        <h3>Talents to take, in order</h3>
        <ol className="talent-order">{g.level.talents.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>

      <h2 style={{ margin: '1.5rem 0 0.75rem' }}>At max level</h2>
      <div className="guide-specs">
        {g.specs.map((s) => (
          <section key={s.spec} className={`panel guide-spec ${mySpec === s.spec ? 'mine' : ''}`}>
            <div className="row spread" style={{ flexWrap: 'nowrap' }}>
              <h3 style={{ margin: 0 }}>{s.name}</h3>
              <span className="badge">{ROLES[s.role]?.icon} {ROLES[s.role]?.label}</span>
            </div>
            {mySpec === s.spec && <span className="badge gold" style={{ marginTop: '0.4rem' }}>Your spec</span>}
            <p className="muted small">{s.build}</p>
            <div className="talent-chips">{s.talents.map((t) => <span key={t} className="talent-chip">{t}</span>)}</div>
            <p className="small" style={{ marginBottom: 0 }}>{s.tip}</p>
          </section>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: '1rem' }}>
        Based on the original Classic talent trees. WoW: Forever may change some talents, so check in game and with the talent calculator.
      </p>
    </>
  );
}

function RetailGuide({ cls }) {
  const specs = RETAIL_SPECS[cls] ?? [];
  return (
    <>
      <p className="muted">
        Retail talents change every patch, so these link to builds that are kept up to date. When levelling in retail,
        just use your endgame spec: any spec levels fine, and dungeons (Mythic 0 / Follower Dungeons) plus the campaign are the quickest way up.
      </p>
      <div className="guide-specs">
        {specs.map(([spec, role]) => (
          <section key={spec} className="panel guide-spec">
            <div className="row spread" style={{ flexWrap: 'nowrap' }}>
              <h3 style={{ margin: 0, color: classColor(cls) }}>{spec}</h3>
              <span className="badge">{ROLES[role]?.icon} {ROLES[role]?.label}</span>
            </div>
            <ul className="plain-list" style={{ marginTop: '0.7rem' }}>
              {retailLinks(cls, spec, role).map((l) => (
                <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
