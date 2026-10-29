#!/usr/bin/env node
// ============================================================
// Solitude companion
//
// Uploads what the Solitude addon records (boss kills, raid
// lockouts, level and gear) to your Solitude website, every time
// WoW saves it (when you log out or type /reload).
//
// Only reads the addon's own save file. Never touches the game.
// Needs Node.js 20+ and nothing else.
//
//   node solitude-companion.mjs           run (keeps watching)
//   node solitude-companion.mjs --once    upload once and exit
//   node solitude-companion.mjs --logout  forget your login
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(HERE, 'solitude-config.json');
const LOG_FILE = path.join(HERE, 'solitude-companion.log');
const POLL_MS = 5000;
const KILL_LOOKBACK_DAYS = 14;

// ---------------------------------------------------------- utils
function log(...args) {
  const line = `[${new Date().toLocaleString()}] ${args.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}
function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); else rl.output.write('*'); };
    }
    rl.question(question, (answer) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(answer.trim()); });
  });
}

// ---------------------------------------------------------- Lua SavedVariables parser
// WoW saves addon data as Lua: SolitudeDB = { ["key"] = value, … }
export function parseSavedVariables(text) {
  let i = 0;
  const n = text.length;
  const err = (msg) => { throw new Error(`Couldn't read save file (${msg} at ${i})`); };

  function skip() {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text.startsWith('--', i)) {
        if (text.startsWith('--[[', i)) { const e = text.indexOf(']]', i); i = e < 0 ? n : e + 2; }
        else { while (i < n && text[i] !== '\n') i++; }
        continue;
      }
      break;
    }
  }
  function str() {
    const quote = text[i++];
    let out = '';
    let byteEscapes = false;
    while (i < n && text[i] !== quote) {
      let ch = text[i++];
      if (ch === '\\') {
        const e = text[i++];
        if (e === 'n') ch = '\n';
        else if (e === 't') ch = '\t';
        else if (e === 'r') ch = '\r';
        else if (e === '\n') ch = '\n';
        else if (/\d/.test(e)) {
          let num = e;
          while (num.length < 3 && /\d/.test(text[i])) num += text[i++];
          ch = String.fromCharCode(Number(num));
          byteEscapes = true;
        } else ch = e;
      }
      out += ch;
    }
    if (text[i] !== quote) err('unfinished text');
    i++;
    // \ddd escapes are raw UTF-8 bytes (e.g. accented names): turn them back into text
    if (byteEscapes && !/[^\x00-\xff]/.test(out)) {
      try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(out, 'latin1')); } catch {}
    }
    return out;
  }
  function num() {
    const m = /^-?(0x[0-9a-fA-F]+|\d*\.?\d+(?:[eE][+-]?\d+)?|inf|nan)/.exec(text.slice(i, i + 64));
    if (!m) err('bad number');
    i += m[0].length;
    return Number(m[0]);
  }
  function word() {
    const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i, i + 128));
    if (!m) err('unexpected character');
    i += m[0].length;
    return m[0];
  }
  function value() {
    skip();
    const c = text[i];
    if (c === '{') return table();
    if (c === '"' || c === "'") return str();
    if (c === '-' || /\d|\./.test(c)) return num();
    const w = word();
    if (w === 'true') return true;
    if (w === 'false') return false;
    if (w === 'nil') return null;
    err(`unknown value ${w}`);
  }
  function table() {
    i++; // {
    const arr = [];
    const obj = {};
    let hasKeys = false;
    for (;;) {
      skip();
      if (text[i] === '}') { i++; break; }
      let key;
      if (text[i] === '[') {
        i++; skip();
        key = text[i] === '"' || text[i] === "'" ? str() : num();
        skip(); if (text[i] !== ']') err('expected ]'); i++;
        skip(); if (text[i] !== '=') err('expected ='); i++;
      } else {
        const save = i;
        const m = /^[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)/.exec(text.slice(i, i + 140));
        if (m) { key = word(); skip(); i++; } else i = save;
      }
      const v = value();
      if (key === undefined) arr.push(v);
      else { obj[key] = v; hasKeys = true; }
      skip();
      if (text[i] === ',' || text[i] === ';') i++;
    }
    if (!hasKeys) return arr;
    arr.forEach((v, idx) => { obj[idx + 1] = v; });
    return obj;
  }

  const result = {};
  for (;;) {
    skip();
    if (i >= n) break;
    const name = word();
    skip();
    if (text[i] !== '=') err('expected =');
    i++;
    result[name] = value();
  }
  return result;
}

const asList = (v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []);

// ---------------------------------------------------------- build the upload
export function buildPayload(db, { since = 0 } = {}) {
  const chars = Object.values(db?.chars ?? {}).filter((c) => c && c.name);
  const cutoff = Math.max(since, Date.now() / 1000 - KILL_LOOKBACK_DAYS * 86400);
  return {
    version: 1,
    chars: chars.map((c) => ({
      name: c.name, realm: c.realm, level: c.level, class: c.class, race: c.race, updated: c.updated,
      gear: asList(c.gear).map((g) => ({ slot: g.slot, id: g.id, q: g.q ?? null, ilvl: g.ilvl ?? null, name: g.name ?? null })),
    })),
    kills: asList(db?.kills)
      .filter((k) => k && k.boss && (k.t ?? 0) >= cutoff)
      .map((k) => ({ t: k.t, enc: k.enc ?? null, boss: k.boss, instance: k.instance ?? null, size: k.size ?? null, members: asList(k.members) })),
    lockouts: chars.flatMap((c) =>
      asList(c.lockouts)
        .filter((l) => l && l.resets && l.resets > Date.now() / 1000)
        .map((l) => ({
          char: c.name, realm: c.realm, instance: l.instance, resets: l.resets, killed: l.killed ?? 0, total: l.total ?? 0,
          bosses: asList(l.bosses).map((b) => ({ name: b.name, killed: !!b.killed })),
        }))),
  };
}

// ---------------------------------------------------------- Supabase (plain HTTP, no packages)
async function authRequest(cfg, grant, body) {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || `Login failed (${res.status})`);
  return data;
}

let accessToken = null;

async function login(cfg) {
  if (cfg.refreshToken) {
    try {
      const data = await authRequest(cfg, 'refresh_token', { refresh_token: cfg.refreshToken });
      accessToken = data.access_token;
      cfg.refreshToken = data.refresh_token; // tokens rotate: always keep the newest
      cfg.email = data.user?.email ?? cfg.email;
      saveConfig(cfg);
      return;
    } catch (e) {
      log('Saved login expired:', e.message);
      cfg.refreshToken = null;
    }
  }
  if (!process.stdin.isTTY) throw new Error('Not logged in. Run the companion once by hand to log in.');
  console.log('\nLog in with your Solitude website account (only needed once).');
  const email = await ask('Email: ');
  const password = await ask('Password: ', { hidden: true });
  const data = await authRequest(cfg, 'password', { email, password });
  accessToken = data.access_token;
  cfg.refreshToken = data.refresh_token;
  cfg.email = email;
  saveConfig(cfg);
  log(`Logged in as ${email}. You won't be asked again.`);
}

async function upload(cfg, payload, retried = false) {
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/solitude_upload`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload }),
  });
  if (res.status === 401 && !retried) {
    await login(cfg);
    return upload(cfg, payload, true);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.hint || `Upload failed (${res.status})`);
  return data;
}

// ---------------------------------------------------------- finding WoW
function candidateWowFolders() {
  const drives = process.platform === 'win32' ? ['C:', 'D:', 'E:', 'F:'] : [];
  const roots = [];
  for (const d of drives) {
    roots.push(
      `${d}\\Program Files (x86)\\World of Warcraft`, `${d}\\Program Files\\World of Warcraft`,
      `${d}\\World of Warcraft`, `${d}\\Games\\World of Warcraft`, `${d}\\Battle.net\\World of Warcraft`,
    );
  }
  if (process.platform === 'darwin') roots.push('/Applications/World of Warcraft');
  roots.push(path.join(os.homedir(), 'World of Warcraft'));
  return roots;
}

function findSaveFiles(wowFolder) {
  const files = [];
  let flavours = [];
  try {
    flavours = fs.readdirSync(wowFolder).filter((d) => /^_.+_$/.test(d)); // _classic_era_, _retail_, …
  } catch { return files; }
  for (const flavour of flavours) {
    const accounts = path.join(wowFolder, flavour, 'WTF', 'Account');
    let names = [];
    try { names = fs.readdirSync(accounts); } catch { continue; }
    for (const acc of names) {
      const file = path.join(accounts, acc, 'SavedVariables', 'Solitude.lua');
      if (fs.existsSync(file)) files.push(file);
    }
  }
  return files;
}

async function setup(cfg) {
  if (!cfg.supabaseUrl || !cfg.anonKey) {
    console.log('\nThis folder is missing solitude-config.json.');
    console.log('On the Solitude website, open Progress → "Set it up" (the /companion page) and download it into this folder.');
    process.exit(1);
  }
  if (!cfg.wowFolder || !fs.existsSync(cfg.wowFolder)) {
    cfg.wowFolder = candidateWowFolders().find((p) => fs.existsSync(p));
    if (!cfg.wowFolder) {
      if (!process.stdin.isTTY) throw new Error('WoW folder not found. Run the companion once by hand to set it.');
      cfg.wowFolder = await ask('Where is World of Warcraft installed? (e.g. D:\\Games\\World of Warcraft): ');
    }
    saveConfig(cfg);
  }
  log(`Watching ${cfg.wowFolder}`);
}

// ---------------------------------------------------------- main loop
async function processFile(cfg, file) {
  const text = fs.readFileSync(file, 'utf8');
  const db = parseSavedVariables(text).SolitudeDB;
  if (!db) return;
  cfg.state ??= {};
  const since = (cfg.state[file]?.lastKill ?? 0) - 3600;
  const payload = buildPayload(db, { since });
  if (!payload.chars.length && !payload.kills.length && !payload.lockouts.length) return;
  const r = await upload(cfg, payload);
  const lastKill = Math.max(cfg.state[file]?.lastKill ?? 0, ...payload.kills.map((k) => k.t));
  cfg.state[file] = { mtime: fs.statSync(file).mtimeMs, lastKill };
  saveConfig(cfg);
  const flavour = file.split(path.sep).find((p) => /^_.+_$/.test(p)) ?? '';
  log(`Uploaded ${flavour}: ${r.kills_added} new kill(s), ${r.kills_merged} already known, ${r.lockouts} lockout(s), ${r.chars_synced} character(s) synced${r.chars_added ? `, ${r.chars_added} added` : ''}.`);
}

async function main() {
  const args = process.argv.slice(2);
  const cfg = loadConfig();
  if (args.includes('--logout')) { delete cfg.refreshToken; saveConfig(cfg); console.log('Logged out.'); return; }

  console.log('☾ Solitude companion');
  await setup(cfg);
  await login(cfg);

  let files = findSaveFiles(cfg.wowFolder);
  if (!files.length) log('No Solitude save file yet. Install the addon, log in to a character, then log out or /reload.');

  const check = async (force = false) => {
    files = findSaveFiles(cfg.wowFolder);
    for (const file of files) {
      try {
        const mtime = fs.statSync(file).mtimeMs;
        if (!force && cfg.state?.[file]?.mtime === mtime) continue;
        if (Date.now() - mtime < 1500) continue; // WoW may still be writing it
        await processFile(cfg, file);
      } catch (e) {
        log('Problem:', e.message);
        if (cfg.state?.[file]) cfg.state[file].mtime = fs.statSync(file).mtimeMs; // don't retry the same broken file forever
      }
    }
  };

  await check(args.includes('--once'));
  if (args.includes('--once')) return;
  log('Running. Leave this open (or let it start with Windows). Uploads happen when WoW saves.');
  setInterval(() => { check().catch((e) => log('Problem:', e.message)); }, POLL_MS);
}

// Only run when started directly (lets tests import the functions above)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { log('Stopped:', e.message); process.exitCode = 1; });
}
