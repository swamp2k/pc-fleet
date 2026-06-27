import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDevices, type Device } from '../lib/api';

const STALE_AFTER_MS = 15 * 60 * 1000; // 15 min — matches agent heartbeat assumption

function deviceStatus(d: Device): 'online' | 'stale' | 'offline' {
  if (!d.last_seen_at) return 'offline';
  const age = Date.now() - new Date(d.last_seen_at).getTime();
  if (age < STALE_AFTER_MS) return 'online';
  if (age < STALE_AFTER_MS * 4) return 'stale';
  return 'offline';
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function DeviceCard({ d }: { d: Device }) {
  const status = deviceStatus(d);
  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span className={`status-dot ${status}`} style={{ marginTop: 2 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.name}
          </span>
        </div>
        <span className="eyebrow" style={{ flexShrink: 0 }}>{status}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Row label="Owner" value={d.owner ?? '—'} />
        <Row label="Last seen" value={relativeTime(d.last_seen_at)} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Link to={`/devices/${d.id}/profile`} className="btn" style={{ textDecoration: 'none', flex: 1, textAlign: 'center' }}>
          Profile
        </Link>
        <Link to={`/devices/${d.id}/recommendation`} className="btn" style={{ textDecoration: 'none', flex: 1, textAlign: 'center' }}>
          Recommendations
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ color: 'var(--text-muted)' }}>{value}</span>
    </div>
  );
}

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDevices()
      .then(r => setDevices(r.devices))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Fleet</div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, margin: 0, fontWeight: 600 }}>Devices</h1>
      </div>

      {loading && (
        <p style={{ color: 'var(--text-muted)' }}>Loading devices…</p>
      )}

      {error && (
        <div
          style={{
            background: 'var(--danger-dim)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius)',
            padding: '12px 16px',
            color: 'var(--text)',
            fontSize: 13,
          }}
        >
          Couldn't load devices: {error}
        </div>
      )}

      {!loading && !error && devices.length === 0 && (
        <div
          style={{
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius)',
            padding: '40px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>No active devices</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>
            Nothing has reported in from pcwatch yet. Once an agent checks in, it'll show up here.
          </p>
        </div>
      )}

      {!loading && !error && devices.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {devices.map(d => <DeviceCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  );
}
