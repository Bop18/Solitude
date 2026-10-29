'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { SITE_NAME, SITE_ICON } from '@/lib/site';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName.trim() || email.split('@')[0] },
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) setError(error.message);
      else if (!data.session) setMessage('Check your email to confirm your account, then log in.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setBusy(false);
  }

  return (
    <div className="panel">
      <h1>{SITE_ICON} {SITE_NAME}</h1>
      <p className="muted">{mode === 'login' ? 'Log in to see the roster and sign up for runs.' : 'Create your member account.'}</p>

      <form onSubmit={handleSubmit} className="stack">
        {mode === 'signup' && (
          <div>
            <label htmlFor="name">Display name</label>
            <input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="What your friends call you" />
          </div>
        )}
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      <p className="muted small" style={{ marginTop: '1rem' }}>
        {mode === 'login' ? 'New here? ' : 'Already have an account? '}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}>
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </a>
      </p>
    </div>
  );
}
