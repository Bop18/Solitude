// Tiny in-browser cache so pages and dashboard cards share data instead of
// each fetching the same lists. Lives until the tab is refreshed.

const store = new Map(); // key → { at, promise }

/** Run fn() once per `ttl` ms for this key; everyone asking in the meantime shares the result. */
export function cached(key, fn, ttl = 60_000) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = Promise.resolve().then(fn).catch((e) => { store.delete(key); throw e; });
  store.set(key, { at: Date.now(), promise });
  return promise;
}

/** Forget cached entries whose key starts with prefix (after you change something). */
export function invalidate(prefix = '') {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

if (typeof window !== 'undefined') {
  window.addEventListener('solitude:signup', () => invalidate('events'));
  window.addEventListener('solitude:synced', () => invalidate('chars'));
}
