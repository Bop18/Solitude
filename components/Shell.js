'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { supabase } from '@/lib/supabase';
import { SITE_NAME, SITE_ICON } from '@/lib/site';
import ThemeToggle from './ThemeToggle';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/roster', label: 'Roster' },
  { href: '/availability', label: 'Availability' },
  { href: '/events', label: 'Events' },
  { href: '/dungeons', label: 'Dungeons' },
  { href: '/loot', label: 'Loot needs' },
];

const PUBLIC_PATHS = ['/login'];

export default function Shell({ children }) {
  const { session, profile, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // Members-only: bounce logged-out visitors to the login page.
  useEffect(() => {
    if (!loading && !session && !isPublic) router.replace('/login');
    if (!loading && session && pathname === '/login') router.replace('/');
  }, [loading, session, isPublic, pathname, router]);

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
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand"><span className="brand-icon">{SITE_ICON}</span>{SITE_NAME}</Link>
          <nav className="nav">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href)) ? 'active' : ''}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="user">
            <span className="muted small">{profile?.display_name ?? session.user.email}</span>
            <ThemeToggle />
            <button className="btn ghost small" onClick={() => supabase.auth.signOut()}>Log out</button>
          </div>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
