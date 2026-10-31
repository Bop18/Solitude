'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// On an event page: the Warcraft Logs saved for this run.
export default function EventLogs({ eventId }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    supabase.from('logs').select('id, title, zone, code, data').eq('event_id', eventId)
      .then(({ data, error }) => setLogs(error ? null : data ?? []));
  }, [eventId]);
  if (logs === null) return null; // logs not set up yet
  return (
    <section className="panel">
      <div className="row spread">
        <h2>Logs</h2>
        <Link href="/logs" className="small">Add a log →</Link>
      </div>
      {logs.length === 0 ? <p className="muted small">No Warcraft Logs report saved for this run yet.</p> : (
        <ul className="plain-list">
          {logs.map((l) => {
            const b = l.data?.bosses ?? [];
            return (
              <li key={l.id}>
                <Link href={`/logs/${l.id}`}>{l.title || l.zone || `Report ${l.code}`}</Link>
                {b.length > 0 && <span className="muted small"> · {b.filter((x) => x.kill).length} kills, {b.filter((x) => !x.kill).length} wipes</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
