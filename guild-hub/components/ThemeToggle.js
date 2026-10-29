'use client';

import { useEffect, useState } from 'react';

// Switches between light and dark. Remembers the choice in this browser;
// until someone picks, it follows their device setting.
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme || 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {theme === 'light' ? '☾' : '☀'}
    </button>
  );
}
