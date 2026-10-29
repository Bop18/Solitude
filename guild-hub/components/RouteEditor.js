'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from './ActivityFeed';

export const STEP_KINDS = {
  pull: { label: 'Pull', icon: '⚔️' },
  boss: { label: 'Boss', icon: '💀' },
  skip: { label: 'Skip', icon: '⏭️' },
  note: { label: 'Note', icon: '📝' },
};
const MAX_MAP_MB = 8;

// Tank routes for one dungeon: a map with numbered pulls and a step list.
// readOnly + routeId: just show one route (used on event pages)
export default function RouteEditor({ dungeonId, userId, readOnly = false, onlyDefault = false }) {
  const [routes, setRoutes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  const [placing, setPlacing] = useState(null);     // step id waiting for a click on the map
  const [mapUrlDraft, setMapUrlDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const mapRef = useRef(null);
  const dragging = useRef(null);

  const loadRoutes = useCallback(async () => {
    const { data, error } = await supabase
      .from('routes')
      .select('*, profiles(display_name)')
      .eq('dungeon_id', dungeonId)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) {
      setError('Routes need the latest database update: run supabase/schema-8-tactics-routes.sql in Supabase.');
      setLoaded(true);
      return [];
    }
    setRoutes(data ?? []);
    setLoaded(true);
    return data ?? [];
  }, [dungeonId]);

  const loadSteps = useCallback(async (routeId) => {
    if (!routeId) return setSteps([]);
    const { data, error } = await supabase.from('route_steps').select('*').eq('route_id', routeId).order('position');
    if (error) setError(error.message);
    setSteps(data ?? []);
  }, []);

  useEffect(() => {
    loadRoutes().then((list) => setSelectedId((cur) => cur ?? list[0]?.id ?? null));
  }, [loadRoutes]);
  useEffect(() => { loadSteps(selectedId); }, [selectedId, loadSteps]);

  const route = routes.find((r) => r.id === selectedId);
  const canEdit = !readOnly;
  const editing = canEdit && editMode;

  // ---------- Routes ----------
  async function newRoute() {
    setError('');
    const { data, error } = await supabase
      .from('routes')
      .insert({ dungeon_id: dungeonId, name: routes.length ? `Route ${routes.length + 1}` : 'Full clear', is_default: routes.length === 0 })
      .select()
      .single();
    if (error) return setError(error.message);
    await loadRoutes();
    setSelectedId(data.id);
    setEditMode(true);
  }

  async function updateRoute(changes) {
    const { error } = await supabase.from('routes').update(changes).eq('id', route.id);
    if (error) setError(error.message);
    loadRoutes();
  }

  async function deleteRoute() {
    if (!confirm(`Delete the route "${route.name}"?`)) return;
    const { error } = await supabase.from('routes').delete().eq('id', route.id);
    if (error) return setError(error.message);
    const list = await loadRoutes();
    setSelectedId(list[0]?.id ?? null);
    setEditMode(false);
  }

  // ---------- Map ----------
  async function uploadMap(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file (PNG or JPG).');
    if (file.size > MAX_MAP_MB * 1024 * 1024) return setError(`That image is over ${MAX_MAP_MB} MB. Try a smaller screenshot.`);
    setBusy(true);
    setError('');
    const path = `${dungeonId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, '-').toLowerCase()}`;
    const { error } = await supabase.storage.from('maps').upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setBusy(false);
      return setError(`Upload failed: ${error.message}`);
    }
    const { data } = supabase.storage.from('maps').getPublicUrl(path);
    await updateRoute({ map_url: data.publicUrl });
    setBusy(false);
  }

  function pointOnMap(e) {
    const rect = mapRef.current.getBoundingClientRect();
    const clamp = (v) => Math.min(1, Math.max(0, v));
    return { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) };
  }

  async function onMapClick(e) {
    if (!editing || dragging.current?.moved) return;
    const { x, y } = pointOnMap(e);
    setError('');
    if (placing) {
      await supabase.from('route_steps').update({ x, y }).eq('id', placing);
      setPlacing(null);
    } else {
      const position = (steps.at(-1)?.position ?? 0) + 1;
      const pulls = steps.filter((s) => s.kind === 'pull').length;
      const { data, error } = await supabase
        .from('route_steps')
        .insert({ route_id: route.id, position, kind: 'pull', title: `Pull ${pulls + 1}`, x, y })
        .select()
        .single();
      if (error) setError(error.message);
      else setActiveStep(data.id);
    }
    touch();
    loadSteps(route.id);
  }

  // Drag pins to move them
  function onPinDown(e, step) {
    e.stopPropagation();
    setActiveStep(step.id);
    if (!editing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { id: step.id, moved: false };
  }
  function onPinMove(e) {
    const d = dragging.current;
    if (!d) return;
    const { x, y } = pointOnMap(e);
    d.moved = true;
    setSteps((list) => list.map((s) => (s.id === d.id ? { ...s, x, y } : s)));
  }
  async function onPinUp(e) {
    const d = dragging.current;
    if (!d) return;
    if (d.moved) {
      const { x, y } = pointOnMap(e);
      await supabase.from('route_steps').update({ x, y }).eq('id', d.id);
      touch();
    }
    // Let the map's click handler see "moved" before clearing it
    setTimeout(() => { dragging.current = null; }, 0);
  }

  // ---------- Steps ----------
  async function addStep() {
    const position = (steps.at(-1)?.position ?? 0) + 1;
    const { data, error } = await supabase
      .from('route_steps')
      .insert({ route_id: route.id, position, kind: 'note', title: 'New step' })
      .select()
      .single();
    if (error) return setError(error.message);
    setActiveStep(data.id);
    touch();
    loadSteps(route.id);
  }

  async function updateStep(id, changes) {
    setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...changes } : s)));
    const { error } = await supabase.from('route_steps').update(changes).eq('id', id);
    if (error) setError(error.message);
    touch();
  }

  async function removeStep(id) {
    const { error } = await supabase.from('route_steps').delete().eq('id', id);
    if (error) setError(error.message);
    touch();
    loadSteps(route.id);
  }

  async function move(index, dir) {
    const a = steps[index];
    const b = steps[index + dir];
    if (!a || !b) return;
    await Promise.all([
      supabase.from('route_steps').update({ position: b.position }).eq('id', a.id),
      supabase.from('route_steps').update({ position: a.position }).eq('id', b.id),
    ]);
    // Same position on both? Spread them out.
    if (a.position === b.position) await supabase.from('route_steps').update({ position: a.position + dir }).eq('id', a.id);
    touch();
    loadSteps(route.id);
  }

  // Bump the route's "updated" time so people see it's been changed
  function touch() {
    if (route) supabase.from('routes').update({ description: route.description }).eq('id', route.id).then(() => {});
  }

  if (!loaded) return <p className="muted">Loading…</p>;

  const visibleRoutes = onlyDefault ? routes.slice(0, 1) : routes;
  const pinned = steps.filter((s) => s.x != null && s.y != null);
  const numberOf = (step) => steps.findIndex((s) => s.id === step.id) + 1;

  // ---------- No routes yet ----------
  if (!routes.length) {
    if (readOnly) return <p className="muted small">No route for this dungeon yet. Make one on the dungeon&apos;s Routes tab.</p>;
    return (
      <section className="panel">
        {error && <p className="error">{error}</p>}
        <h2>No routes yet</h2>
        <p className="muted">
          Make a tank route: upload a map of the dungeon (any screenshot works), then click on it to drop numbered pulls and
          write a note for each one, like &quot;pull back to the corner&quot; or &quot;skip this pack&quot;.
        </p>
        {!error && <button className="btn" onClick={newRoute}>+ New route</button>}
      </section>
    );
  }

  return (
    <div className="route-wrap">
      {error && <p className="error">{error}</p>}

      {/* ---------- Route picker ---------- */}
      {!onlyDefault && (
        <div className="row spread" style={{ marginBottom: '0.9rem' }}>
          <div className="tabs" style={{ margin: 0, flexWrap: 'wrap' }}>
            {visibleRoutes.map((r) => (
              <a key={r.id} href="#" className={r.id === selectedId ? 'active' : ''} onClick={(e) => { e.preventDefault(); setSelectedId(r.id); setEditMode(false); setPlacing(null); }}>
                {r.is_default && '★ '}{r.name}
              </a>
            ))}
          </div>
          {canEdit && <button className="btn ghost small" onClick={newRoute}>+ New route</button>}
        </div>
      )}

      {route && (
        <section className="panel">
          {/* ---------- Header ---------- */}
          <div className="row spread">
            {editing ? (
              <input
                className="route-name-input"
                defaultValue={route.name}
                key={route.id}
                onBlur={(e) => e.target.value.trim() && e.target.value !== route.name && updateRoute({ name: e.target.value.trim() })}
                aria-label="Route name"
              />
            ) : (
              <h2 style={{ marginBottom: 0 }}>{route.is_default && <span title="Default route">★ </span>}{route.name}</h2>
            )}
            {canEdit && (
              <div className="row">
                {editing && !route.is_default && <button className="btn ghost small" onClick={() => updateRoute({ is_default: true })}>★ Make default</button>}
                {editing && route.created_by === userId && <button className="btn danger small" onClick={deleteRoute}>Delete route</button>}
                <button className={`btn small ${editing ? '' : 'ghost'}`} onClick={() => { setEditMode(!editMode); setPlacing(null); }}>
                  {editing ? '✓ Done' : '✎ Edit route'}
                </button>
              </div>
            )}
          </div>
          {editing ? (
            <textarea
              rows={2}
              defaultValue={route.description ?? ''}
              key={`d${route.id}`}
              placeholder="Any general notes, e.g. 'Mage sheeps casters, rogue saps the patrol'"
              onBlur={(e) => e.target.value !== (route.description ?? '') && updateRoute({ description: e.target.value })}
              style={{ marginTop: '0.6rem' }}
            />
          ) : (
            route.description && <p style={{ whiteSpace: 'pre-wrap' }}>{route.description}</p>
          )}
          <p className="muted small" style={{ marginTop: '0.4rem' }}>
            {steps.length} step{steps.length === 1 ? '' : 's'} · updated {timeAgo(route.updated_at)}
            {route.profiles?.display_name ? ` · made by ${route.profiles.display_name}` : ''}
          </p>

          <div className="route-layout">
            {/* ---------- Map ---------- */}
            <div className="route-map-col">
              {route.map_url ? (
                <>
                  <div
                    ref={mapRef}
                    className={`route-map ${editing ? 'editing' : ''} ${placing ? 'placing' : ''}`}
                    onClick={onMapClick}
                    onPointerMove={onPinMove}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={route.map_url} alt={`${route.name} map`} draggable={false} />
                    <svg className="route-path" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        points={pinned.filter((s) => s.kind !== 'note').map((s) => `${s.x * 100},${s.y * 100}`).join(' ')}
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                    {pinned.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`pin pin-${s.kind} ${activeStep === s.id ? 'active' : ''}`}
                        style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%` }}
                        onPointerDown={(e) => onPinDown(e, s)}
                        onPointerUp={onPinUp}
                        onClick={(e) => e.stopPropagation()}
                        title={s.title ?? ''}
                      >
                        {s.kind === 'boss' ? '💀' : numberOf(s)}
                      </button>
                    ))}
                  </div>
                  {editing && (
                    <p className="muted small">
                      {placing ? <strong>Click on the map to place that step.</strong> : 'Click the map to add a pull. Drag pins to move them.'}{' '}
                      <label className="link-like">
                        Change map
                        <input type="file" accept="image/*" hidden onChange={(e) => uploadMap(e.target.files?.[0])} />
                      </label>
                      {' · '}
                      <a href="#" onClick={(e) => { e.preventDefault(); if (confirm('Remove the map? Pins keep their notes.')) updateRoute({ map_url: null }); }}>Remove map</a>
                    </p>
                  )}
                </>
              ) : editing ? (
                <div className="map-empty">
                  <p><strong>Add a map</strong></p>
                  <p className="muted small">A screenshot of the dungeon map (press M in game) or any map image.</p>
                  <label className="btn small">
                    {busy ? 'Uploading…' : 'Upload image'}
                    <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => uploadMap(e.target.files?.[0])} />
                  </label>
                  <div className="row" style={{ marginTop: '0.75rem' }}>
                    <input value={mapUrlDraft} onChange={(e) => setMapUrlDraft(e.target.value)} placeholder="…or paste an image link" style={{ flex: 1 }} />
                    <button className="btn ghost small" disabled={!mapUrlDraft.trim()} onClick={() => { updateRoute({ map_url: mapUrlDraft.trim() }); setMapUrlDraft(''); }}>Use link</button>
                  </div>
                </div>
              ) : (
                <div className="map-empty muted small">No map for this route yet.</div>
              )}
            </div>

            {/* ---------- Steps ---------- */}
            <div className="route-steps">
              {steps.length === 0 && <p className="muted small">{editing ? 'Click the map to add pulls, or add a step below.' : 'No steps yet.'}</p>}
              <ol className="step-list">
                {steps.map((s, i) => (
                  <li key={s.id} className={`step ${activeStep === s.id ? 'active' : ''}`} onClick={() => setActiveStep(s.id)}>
                    <span className={`step-num pin-${s.kind}`}>{s.kind === 'boss' ? '💀' : i + 1}</span>
                    <div className="step-body">
                      {editing ? (
                        <div className="stack" style={{ gap: '0.4rem' }}>
                          <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <select value={s.kind} onChange={(e) => updateStep(s.id, { kind: e.target.value })} style={{ width: 'auto', padding: '0.3rem' }} aria-label="Step type">
                              {Object.entries(STEP_KINDS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                            </select>
                            <input defaultValue={s.title ?? ''} key={`t${s.id}`} onBlur={(e) => e.target.value !== (s.title ?? '') && updateStep(s.id, { title: e.target.value })} placeholder="Title" />
                          </div>
                          <textarea rows={2} defaultValue={s.note ?? ''} key={`n${s.id}`} onBlur={(e) => e.target.value !== (s.note ?? '') && updateStep(s.id, { note: e.target.value })} placeholder="What to do here…" />
                          <div className="row" style={{ gap: '0.3rem' }}>
                            <button className="btn ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                            <button className="btn ghost small" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down">↓</button>
                            {route.map_url && (
                              s.x != null
                                ? <button className="btn ghost small" onClick={() => updateStep(s.id, { x: null, y: null })}>Unpin</button>
                                : <button className="btn ghost small" onClick={() => setPlacing(s.id)}>{placing === s.id ? 'Click the map…' : '📍 Place on map'}</button>
                            )}
                            <button className="btn danger small" onClick={() => removeStep(s.id)} aria-label="Delete step">✕</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="step-title">{s.title || STEP_KINDS[s.kind].label}{s.kind === 'skip' && <span className="badge" style={{ marginLeft: 6 }}>Skip</span>}</div>
                          {s.note && <div className="step-note">{s.note}</div>}
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {editing && <button className="btn ghost small" onClick={addStep}>+ Add a step without a pin</button>}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
