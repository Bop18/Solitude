'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { SITE_NAME, SITE_ICON } from '@/lib/site';
import ThemeToggle from './ThemeToggle';
import AutoSync from './AutoSync';
import { syncMainAccent } from '@/lib/theme';

// Side menu, grouped by what you're doing
const GROUPS = [
  { label: null, links: [{ href: '/', label: 'Dashboard' }] },
  { label: 'Group', links: [
    { href: '/roster', label: 'Roster' },
    { href: '/availability', label: 'Availability' },
    { href: '/events', label: 'Events' },
  ] },
  { label: 'Play', links: [
    { href: '/dungeons', label: 'Dungeons' },
    { href: '/progress', label: 'Progress' },
    { href: '/guides', label: 'Guides' },
  ] },
  { label: 'Records', links: [
    { href: '/loot/history', label: 'Loot history' },
    { href: '/logs', label: 'Logs' },
  ] },
];
const isActive = (pathname, href) => pathname === href || (href !== '/' && pathname.startsWith(href.replace('/history', '')));

const PUBLIC_PATHS = ['/login'];

export default function Shell({ children }) {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]); // close the phone menu after picking a page

  // Members-only: bounce logged-out visitors to the login page.
  useEffect(() => {
    if (!loading && !session && !isPublic) router.replace('/login');
    if (!loading && session && pathname === '/login') router.replace('/');
  }, [loading, session, isPublic, pathname, router]);

  useEffect(() => {
    const id = session?.user?.id;
    if (!id) return;
    supabase.from('characters').select('*').eq('owner', id).then(({ data }) => {
      const main = (data ?? []).filter((c) => c.game !== 'retail').sort((a, b) => (b.is_main - a.is_main) || (b.level - a.level))[0];
      if (main) syncMainAccent(main.class);
    });
  }, [session?.user?.id]);

  if (isPublic) {
    return (
      <>
        <ThemeToggle className="floating-toggle" />
        <main className="container narrow">{children}</main>
      </>
    );
  }

  if (loading || !session) {
    return <main className="container"><p className="muted">Loading…</p></main>;
  }

  return (
    <>
      <div className="mobile-bar">
        <Link href="/" className="brand"><span className="brand-icon">{SITE_ICON}</span>{SITE_NAME}</Link>
        <button className="menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="side-menu">
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </div>
      {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside id="side-menu" className={`sidebar${menuOpen ? ' open' : ''}`}>
        <Link href="/" className="brand"><span className="brand-icon">{SITE_ICON}</span>{SITE_NAME}</Link>
        <nav className="nav" aria-label="Main">
          {GROUPS.map((g, i) => (
            <div className="nav-group" key={g.label ?? i}>
              {g.label && <span className="nav-group-label">{g.label}</span>}
              {g.links.map((link) => (
                <Link key={link.href} href={link.href} className={isActive(pathname, link.href) ? 'active' : ''} aria-current={isActive(pathname, link.href) ? 'page' : undefined}>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="user">
          <div className="user-row">
            <Link href="/settings" className="user-link small" title="Settings: Battle.net, theme and your name">{profile?.display_name ?? session.user.email}</Link>
            <ThemeToggle />
          </div>
          <Link href="/settings" className={`small ${pathname === '/settings' ? '' : 'muted'}`}>Settings</Link>
          <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>Log out</button>
        </div>
      </aside>
      <AutoSync userId={session.user.id} />
      <div className="app-main">
        <main className="container">{children}</main>
      </div>
    </>
  );
}
