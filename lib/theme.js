// Per-person appearance: light/dark mode and colour theme, saved in this browser.

export const ACCENTS = [
  { id: 'solitude', name: 'Solitude', swatch: '#8e9bff' },
  { id: 'mage', name: 'Mage', swatch: '#69ccf0' },
  { id: 'warlock', name: 'Warlock', swatch: '#a98bff' },
  { id: 'priest', name: 'Priest', swatch: '#e9e9f2' },
  { id: 'paladin', name: 'Paladin', swatch: '#f48cba' },
  { id: 'rogue', name: 'Rogue', swatch: '#fff468' },
  { id: 'druid', name: 'Druid', swatch: '#ff8a2a' },
  { id: 'hunter', name: 'Hunter', swatch: '#aad372' },
  { id: 'shaman', name: 'Shaman', swatch: '#3d8bff' },
  { id: 'warrior', name: 'Warrior', swatch: '#d0a77a' },
];

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

export function getAppearance() {
  return { mode: get('theme') ?? 'system', accent: get('accent') ?? 'solitude' };
}

/** Apply now and remember. mode: 'system' | 'dark' | 'light'. accent: an ACCENTS id or 'main'. */
export function setAppearance({ mode, accent, mainClass }) {
  const root = document.documentElement;
  if (mode) {
    set('theme', mode === 'system' ? null : mode);
    root.dataset.theme = mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
  }
  if (accent) {
    set('accent', accent === 'solitude' ? null : accent);
    if (accent === 'main') {
      const cls = (mainClass ?? get('accent-main') ?? 'solitude').toLowerCase();
      set('accent-main', cls);
      applyAccent(cls);
    } else {
      applyAccent(accent);
    }
  }
}

/** For "Match my main": call when we know the main's class. */
export function syncMainAccent(mainClass) {
  if (get('accent') !== 'main' || !mainClass) return;
  const cls = mainClass.toLowerCase();
  set('accent-main', cls);
  applyAccent(cls);
}

function applyAccent(id) {
  const root = document.documentElement;
  if (!id || id === 'solitude' || !ACCENTS.some((a) => a.id === id)) delete root.dataset.accent;
  else root.dataset.accent = id;
}
