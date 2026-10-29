import Link from 'next/link';
import { EVENT_KINDS } from '@/lib/wow';

export function formatWhen(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function EventCard({ event }) {
  const going = (event.event_signups ?? []).filter((s) => s.status === 'going').length;
  const full = going >= event.max_size;
  return (
    <Link href={`/events/${event.id}`} className="event-card">
      <div className="row spread">
        <strong>{event.title}</strong>
        <span className={`badge ${full ? 'gold' : ''}`}>{going}/{event.max_size}{full ? ' · Full' : ''}</span>
      </div>
      <div className="muted small">
        {EVENT_KINDS[event.kind]?.label ?? event.kind} · {formatWhen(event.starts_at)}
      </div>
    </Link>
  );
}
