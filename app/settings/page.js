'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { ACCENTS, getAppearance, setAppearance, syncMainAccent } from '@/lib/theme';
import { classColor } from '@/lib/wow';

export default function SettingsPage() {
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;
  const [mode, setMode] = useState('system');
  const [accent, setAccent] = useState('main');
  const [main, setMain] = useState(null);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const a = getAppearance();
    setMode(a.mode);
    setAccent(a.accent);
  }, []);

  useEffect(() => { setName(profile?.display_name ?? ''); }, [profile]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('characters').select('*').eq('owner', userId)
      .then(({ data }) => {
        const m = (data ?? []).filter((c) => c.game !== 'retail').sort((a, b) => (b.is_main - a.is_main) || (b.level - a.level))[0] ?? null;
        setMain(m);
        if (m) syncMainAccent(m.class);
      });
  }, [userId]);

  function pickMode(m) {
    setMode(m);
    setAppearance({ mode: m });
  }
  function pickAccent(a) {
    setAccent(a);
    setAppearance({ accent: a, mainClass: main?.class });
  }

  async function saveName(e) {
    e.preventDefault();
    setError(''); setSaved('');
    const clean = name.trim();
    if (!clean) return setError('Your name can\'t be empty.');
    const { error } = await supabase.from('profiles').update({ display_name: clean }).eq('id', userId);
    if (error) return setError(error.message);
    await refreshProfile();
    setSaved('Saved!');
  }

  return (
    <>
      <h1>Settings</h1>

      <section className="panel">
        <h2>Appearance</h2>
        <p className="muted small">Only changes how the site looks for you, on this device.</p>

        <label>Light or dark</label>
        <div className="row" style={{ marginBottom: '1.2rem' }}>
          {[['system', '🖥️ Match my device'], ['dark', '☾ Dark'], ['light', '☀ Light']].map(([id, label]) => (
            <button key={id} className={`btn small ${mode === id ? '' : 'ghost'}`} onClick={() => pickMode(id)} aria-pressed={mode === id}>{label}</button>
          ))}
        </div>

        <label>Colour theme</label>
        <p className="muted small" style={{ marginTop: 0 }}>By default the site uses your main&apos;s class colour. Pick another one any time.</p>
        <div className="swatches">
          <button className={`swatch ${accent === 'main' ? 'on' : ''}`} onClick={() => pickAccent('main')} aria-pressed={accent === 'main'} disabled={!main}>
            <span className="swatch-dot" style={{ background: main ? classColor(main.class) : 'var(--muted)' }} />
            My main{main ? ` (${main.class})` : ''}
          </button>
          {ACCENTS.map((a) => (
            <button key={a.id} className={`swatch ${accent === a.id ? 'on' : ''}`} onClick={() => pickAccent(a.id)} aria-pressed={accent === a.id}>
              <span className="swatch-dot" style={{ background: a.swatch, boxShadow: `0 0 14px ${a.swatch}` }} />
              {a.name}
            </button>
          ))}
        </div>
        {!main && <p className="muted small">Add a character and the site will use your main&apos;s class colour automatically.</p>}
      </section>

      <section className="panel">
        <h2>Your name</h2>
        <p className="muted small">What your friends see next to your characters, availability and sign-ups.</p>
        <form onSubmit={saveName} className="row" style={{ maxWidth: 480 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Display name" style={{ flex: 1 }} />
          <button className="btn" type="submit">Save</button>
        </form>
        {saved && <p className="success">{saved}</p>}
        {error && <p className="error">{error}</p>}
      </section>
    </>
  );
}
