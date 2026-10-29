'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ImportGuides from './ImportGuides';

// "New to this dungeon?" overview: where it is, what to grab first, the route and tips.
export default function DungeonGuide({ dungeonId, compact = false }) {
  const [d, setD] = useState(null);

  useEffect(() => {
    supabase.from('dungeons').select('*').eq('id', dungeonId).maybeSingle().then(({ data }) => setD(data));
  }, [dungeonId]);

  if (!d) return null;
  if (!(d.guide_overview || d.guide_where)) {
    if (compact || !('guide_overview' in d)) return null;
    return (
      <section className="panel">
        <p className="muted" style={{ marginTop: 0 }}>No starter guide here yet. Load the ready-made guides for every Classic dungeon and raid:</p>
        <ImportGuides compact onDone={() => window.location.reload()} />
      </section>
    );
  }
  const route = Array.isArray(d.guide_route) ? d.guide_route : [];

  return (
    <section className={compact ? 'guide guide-compact' : 'panel guide'}>
      {!compact && <h2>New to {d.name}?</h2>}
      {d.guide_overview && <p className="guide-lead">{d.guide_overview}</p>}
      <div className="guide-grid">
        {d.guide_where && (
          <div className="guide-box">
            <div className="tactic-role-label">📍 Where</div>
            <div>{d.guide_where}</div>
          </div>
        )}
        {d.guide_before && (
          <div className="guide-box">
            <div className="tactic-role-label">🎒 Before you go</div>
            <div>{d.guide_before}</div>
          </div>
        )}
        {d.guide_tips && (
          <div className="guide-box">
            <div className="tactic-role-label">💡 Tips</div>
            <div>{d.guide_tips}</div>
          </div>
        )}
      </div>
      {route.length > 0 && (
        <div className="guide-route">
          <div className="tactic-role-label">🗺️ Route</div>
          <ol>{route.map((step, i) => <li key={i}>{step}</li>)}</ol>
        </div>
      )}
      {!compact && <p className="muted small" style={{ margin: '0.6rem 0 0' }}>Starter guide written for Solitude. WoW: Forever may change things, so edit the tactics below as you learn the fights.</p>}
    </section>
  );
}
