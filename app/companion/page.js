'use client';

import Link from 'next/link';

// Setup guide for automatic tracking (addon + companion).
export default function CompanionPage() {
  function downloadConfig() {
    const config = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      siteUrl: window.location.origin,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'solitude-config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <p><Link href="/progress">← Progress</Link></p>
      <h1>Automatic tracking</h1>
      <p className="muted" style={{ maxWidth: 720 }}>
        Once this is set up, boss kills, raid progress, your level and your gear update on the site by themselves.
        Nobody fills anything in. <strong>Only one person per group needs it</strong> for kills to count for everyone
        there, but everyone who installs it also gets their gear and level synced.
      </p>

      <div className="grid-2">
        <section className="panel">
          <h2>Set it up (5 minutes)</h2>
          <ol className="steps">
            <li>
              <strong>Install the Solitude addon</strong>
              <p className="muted small">
                Search <em>Solitude</em> in the CurseForge app, or <a href="/downloads/Solitude-addon.zip" download>download it here</a> and
                unzip the <code>Solitude</code> folder into <code>World of Warcraft\_classic_era_\Interface\AddOns</code> (or your game version&apos;s folder).
                If the game says it&apos;s out of date, tick <em>Load out of date AddOns</em>.
              </p>
            </li>
            <li>
              <strong>Make a folder for the companion</strong>
              <p className="muted small">e.g. <code>Documents\Solitude</code>. Download these three files into it:</p>
              <div className="row">
                <a className="btn small" href="/companion/solitude-companion.mjs" download>solitude-companion.mjs</a>
                <a className="btn small" href="/companion/start-solitude.bat" download>start-solitude.bat</a>
                <a className="btn small" href="/companion/add-to-startup.bat" download>add-to-startup.bat</a>
              </div>
            </li>
            <li>
              <strong>Download your setup file into the same folder</strong>
              <p className="muted small">It tells the companion where your Solitude site is. It doesn&apos;t contain your password.</p>
              <button className="btn small" onClick={downloadConfig}>solitude-config.json</button>
            </li>
            <li>
              <strong>Double-click <code>start-solitude.bat</code></strong>
              <p className="muted small">
                Log in with your Solitude email and password (only the first time). It finds your WoW folder by itself; if it can&apos;t, it asks.
                Needs <a href="https://nodejs.org" target="_blank" rel="noreferrer">Node.js</a>, which you may already have.
              </p>
            </li>
            <li>
              <strong>Double-click <code>add-to-startup.bat</code></strong>
              <p className="muted small">So it starts with Windows and you never think about it again.</p>
            </li>
          </ol>
        </section>

        <div className="stack-panels">
          <section className="panel">
            <h2>How it works</h2>
            <ul className="muted small" style={{ paddingLeft: '1.1rem', margin: 0 }}>
              <li>While you play, the addon notes boss kills (and who was there), your raid lockouts, level and gear.</li>
              <li>WoW saves that when you <strong>log out</strong> or type <strong>/reload</strong>.</li>
              <li>The companion sees the save and uploads it within a few seconds.</li>
              <li>Two people uploading the same kill is fine: it&apos;s only counted once.</li>
              <li>Characters it sees are added to your roster automatically.</li>
            </ul>
          </section>
          <section className="panel">
            <h2>Is it safe?</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Yes. The addon only uses Blizzard&apos;s normal addon features, and the companion only reads the addon&apos;s own save file
              after the game writes it, the same way Raider.IO and Warcraft Logs work. It never touches the game while it&apos;s running.
            </p>
          </section>
          <section className="panel">
            <h2>Handy commands</h2>
            <p className="muted small" style={{ margin: 0 }}>
              <code>/solitude status</code> in game shows what&apos;s been recorded.<br />
              <code>/reload</code> uploads straight away without logging out.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
