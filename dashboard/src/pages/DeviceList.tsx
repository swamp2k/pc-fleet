import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDevices, type Device } from '../lib/api';

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listDevices().then(r => setDevices(r.devices)).catch(e => setError(e.message));
  }, []);

  if (error) return <div style={{ padding: '1.5rem', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>Devices</h2>
      {devices.length === 0 && <p>No active devices found in pcwatch.</p>}
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Name', 'Owner', 'Last seen', 'Actions'].map(h => (
              <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '0.5rem' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devices.map(d => (
            <tr key={d.id}>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{d.name}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{d.owner ?? '—'}</td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}
              </td>
              <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', display: 'flex', gap: '0.75rem' }}>
                <Link to={`/devices/${d.id}/profile`}>Profile</Link>
                <Link to={`/devices/${d.id}/recommendation`}>Recommendations</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
