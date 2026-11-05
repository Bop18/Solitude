// POST /api/bnet  — "Log in with Battle.net"
//   { action: 'finish', code, redirectUri } → swap Blizzard's login code for a token, save it, update characters
//   { action: 'refresh' }                   → use the saved token to update levels (no clicks needed)
//   { action: 'add', bnetId }               → add one of your Battle.net characters to the roster
//   { action: 'disconnect' }
// Blizzard's login lasts 24 hours and can't be renewed silently, so after that the site asks
// you to press "Reconnect" (one click, no password if you're still logged in to Battle.net).
// Needs BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET / BLIZZARD_REGION, and the site's
// /bnet/callback address added as a Redirect URL on your Battle.net app.

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status });

const RULESETS = ['RP-PvP', 'Hardcore', 'PvP', 'RP', 'Normal'];
/** "CAMWOW EU5 Realm 4 PvP" → "PvP" */
function rulesetFromRealm(name = '') {
  const n = name.toLowerCase();
  if (/rp[\s-]?pvp/.test(n)) return 'RP-PvP';
  for (const r of RULESETS) if (new RegExp(`(^|\\W)${r.toLowerCase()}($|\\W)`).test(n)) return r;
  return 'Normal';
}
const first = (n = '') => n.trim().toLowerCase().split(/[\s-]+/)[0];
const CLASSES = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid'];
const pick = (v) => (typeof v === 'string' ? v : v?.en_GB ?? v?.en_US ?? null);

/** Your WoW: Forever characters from Blizzard (needs the person's own token). */
async function userCharacters(accessToken, region) {
  const namespaces = (process.env.BLIZZARD_USER_NAMESPACES || 'profile-forever').split(',').map((s) => s.trim()).filter(Boolean);
  const out = [];
  let status = null;
  for (const ns of namespaces) {
    const res = await fetch(`https://${region}.api.blizzard.com/profile/user/wow?namespace=${ns}-${region}&locale=en_GB`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    status = res.status;
    if (res.status === 401) return { expired: true, characters: [] };
    if (!res.ok) continue;
    const data = await res.json();
    for (const acc of data.wow_accounts ?? []) {
      for (const c of acc.characters ?? []) {
        const realmName = pick(c.realm?.name) ?? c.realm?.slug ?? '';
        out.push({
          id: c.id,
          name: pick(c.name) ?? c.name,
          surname: pick(c.surname) ?? null,
          level: c.level ?? null,
          className: pick(c.playable_class?.name),
          race: pick(c.playable_race?.name),
          realmSlug: c.realm?.slug ?? null,
          realmName,
          namespace: ns,
        });
      }
    }
  }
  return { characters: out, status };
}

async function updateRoster(supabase, userId, list) {
  const { data: mine, error } = await supabase.from('characters').select('*').eq('owner', userId);
  if (error) throw error;
  const forever = (mine ?? []).filter((c) => c.game !== 'retail' && c.game !== 'classic');
  let updated = 0;
  const unmatched = [];
  for (const b of list) {
    const match = forever.find((c) => c.bnet_id === b.id) ?? forever.find((c) => !c.bnet_id && first(c.name) === first(b.name));
    if (!match) { unmatched.push(b); continue; }
    const patch = { bnet_id: b.id, bnet_name: b.name.toLowerCase(), bnet_realm: b.realmSlug, server_name: b.realmName || match.server_name };
    if (b.level && b.level !== match.level) patch.level = b.level;
    if (!match.realm && b.realmName) patch.realm = rulesetFromRealm(b.realmName);
    const { error: e } = await supabase.from('characters').update(patch).eq('id', match.id);
    if (e) throw e;
    updated++;
  }
  return { updated, unmatched };
}

export async function POST(request) {
  const id = process.env.BLIZZARD_CLIENT_ID, secret = process.env.BLIZZARD_CLIENT_SECRET;
  if (!id || !secret) return json({ error: 'This needs the Battle.net keys (see README → Battle.net).' }, 501);
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Please log in again.' }, 401);
  let body = {};
  try { body = await request.json(); } catch { /* none */ }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: who } = await supabase.auth.getUser(token);
  const userId = who?.user?.id;
  if (!userId) return json({ error: 'Please log in again.' }, 401);
  const region = (process.env.BLIZZARD_REGION || 'eu').toLowerCase();

  try {
    if (body.action === 'finish') {
      const res = await fetch('https://oauth.battle.net/token', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'authorization_code', code: body.code ?? '', redirect_uri: body.redirectUri ?? '' }),
        cache: 'no-store',
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        return json({ error: /redirect/i.test(t)
          ? `Battle.net didn't accept this site's address. Add ${body.redirectUri} as a Redirect URL on your Battle.net app.`
          : `Battle.net login failed (${res.status}). Try again.` }, 400);
      }
      const tok = await res.json();
      let battletag = null;
      const info = await fetch('https://oauth.battle.net/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` }, cache: 'no-store' }).catch(() => null);
      if (info?.ok) battletag = (await info.json()).battletag ?? null;
      const { error } = await supabase.from('bnet_links').upsert({
        user_id: userId, battletag, access_token: tok.access_token,
        expires_at: new Date(Date.now() + (tok.expires_in ?? 86400) * 1000).toISOString(), updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const { characters, status } = await userCharacters(tok.access_token, region);
      const r = await updateRoster(supabase, userId, characters);
      return json({ ok: true, battletag, found: characters.length, apiStatus: status, ...r });
    }

    // Everything else uses the saved token
    const { data: link, error: linkErr } = await supabase.from('bnet_links').select('*').eq('user_id', userId).maybeSingle();
    if (linkErr) throw linkErr;

    if (body.action === 'disconnect') {
      await supabase.from('bnet_links').delete().eq('user_id', userId);
      return json({ ok: true });
    }
    if (!link) return json({ connected: false });
    if (new Date(link.expires_at).getTime() < Date.now() + 60_000) return json({ connected: true, expired: true, battletag: link.battletag });

    const { characters, expired, status } = await userCharacters(link.access_token, region);
    if (expired) return json({ connected: true, expired: true, battletag: link.battletag });

    if (body.action === 'add') {
      const b = characters.find((c) => String(c.id) === String(body.bnetId));
      if (!b) return json({ error: 'That character wasn’t found on your Battle.net account.' }, 404);
      const { data: existing } = await supabase.from('characters').select('id').eq('owner', userId);
      const row = {
        owner: userId, name: b.name, level: b.level ?? 1, game: 'forever',
        class: CLASSES.includes(b.className) ? b.className : 'Warrior', race: b.race,
        realm: rulesetFromRealm(b.realmName), server_name: b.realmName, bnet_id: b.id, bnet_name: b.name.toLowerCase(), bnet_realm: b.realmSlug,
        is_main: !(existing ?? []).length,
      };
      const { data, error } = await supabase.from('characters').insert(row).select('id').single();
      if (error) throw error;
      return json({ ok: true, characterId: data.id });
    }

    // refresh
    const r = await updateRoster(supabase, userId, characters);
    return json({ connected: true, battletag: link.battletag, expiresAt: link.expires_at, found: characters.length, apiStatus: status, ...r });
  } catch (e) {
    const msg = e.message ?? String(e);
    return json({ error: /bnet_|relation/.test(msg) ? 'Run supabase/schema-21-battlenet-login.sql in Supabase first.' : msg }, 500);
  }
}
