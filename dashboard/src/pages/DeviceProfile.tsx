import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfile, upsertProfile, getHardware, type Device, type UserProfile, type Hardware } from '../lib/api';

const PERF_OPTIONS = ['light', 'everyday', 'gaming', 'creative-pro'] as const;
const USE_CASE_SUGGESTIONS = ['gaming', 'video-editing', 'office', 'browsing', 'development', 'school', 'streaming'];

export default function DeviceProfile() {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<Device | null>(null);
  const [hardware, setHardware] = useState<Hardware | null>(null);
  const [useCases, setUseCases] = useState<string[]>([]);
  const [perfExpectation, setPerfExpectation] = useState('');
  const [usageNotes, setUsageNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([getProfile(id), getHardware(id)])
      .then(([profileResp, hwResp]) => {
        setDevice(profileResp.device);
        setHardware(hwResp.hardware);
        if (profileResp.profile) {
          const p: UserProfile = profileResp.profile;
          setUseCases(p.primary_use_cases ?? []);
          setPerfExpectation(p.performance_expectation ?? '');
          setUsageNotes(p.usage_notes ?? '');
        }
      })
      .catch(e => setError(e.message));
  }, [id]);

  function toggleUseCase(tag: string) {
    setUseCases(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError('');
    try {
      await upsertProfile(id, {
        primary_use_cases: useCases,
        performance_expectation: perfExpectation || undefined,
        usage_notes: usageNotes || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (error) return <div style={{ padding: '1.5rem', color: 'red' }}>Error: {error}</div>;
  if (!device) return <div style={{ padding: '1.5rem' }}>Loading…</div>;

  const gpus: Array<{ name?: string }> = (() => {
    try { return hardware?.gpu_json ? JSON.parse(hardware.gpu_json) : []; }
    catch { return []; }
  })();

  return (
    <div style={{ padding: '1.5rem', maxWidth: 700 }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/devices">← All devices</Link>
      </div>

      <h2>{device.name}{device.owner ? ` — ${device.owner}` : ''}</h2>

      {/* pcwatch hardware (read-only) */}
      {hardware ? (
        <section style={{ background: '#f9f9f9', padding: '1rem', borderRadius: 6, marginBottom: '1.5rem' }}>
          <h3 style={{ marginTop: 0 }}>Hardware (from pcwatch)</h3>
          <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem', margin: 0 }}>
            <dt>CPU</dt><dd style={{ margin: 0 }}>{hardware.cpu_model ?? '—'} ({hardware.cpu_cores ?? '?'} cores)</dd>
            <dt>RAM</dt><dd style={{ margin: 0 }}>{hardware.ram_total_gb != null ? `${hardware.ram_total_gb} GB` : '—'}</dd>
            <dt>GPU</dt><dd style={{ margin: 0 }}>{gpus.length ? gpus.map(g => g.name ?? 'unknown').join(', ') : '—'}</dd>
            <dt>Motherboard</dt><dd style={{ margin: 0 }}>{hardware.motherboard_model ?? '—'}</dd>
          </dl>
        </section>
      ) : (
        <p style={{ fontStyle: 'italic', color: '#888', marginBottom: '1.5rem' }}>No hardware inventory collected yet.</p>
      )}

      {/* pcwatch notes (read-only) */}
      {device.notes && (
        <section style={{ marginBottom: '1.5rem' }}>
          <strong>Admin notes (pcwatch):</strong>
          <p style={{ margin: '0.25rem 0 0', color: '#555' }}>{device.notes}</p>
        </section>
      )}

      {/* fleet profile (editable) */}
      <form onSubmit={handleSave}>
        <h3>Fleet Profile</h3>

        <fieldset style={{ border: 'none', padding: 0, marginBottom: '1rem' }}>
          <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Primary use cases</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {USE_CASE_SUGGESTIONS.map(tag => (
              <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={useCases.includes(tag)} onChange={() => toggleUseCase(tag)} />
                {tag}
              </label>
            ))}
          </div>
        </fieldset>

        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600 }}>Performance expectation</span>
          <select value={perfExpectation} onChange={e => setPerfExpectation(e.target.value)}
            style={{ display: 'block', marginTop: '0.25rem', width: '100%' }}>
            <option value="">— not set —</option>
            {PERF_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: '1.25rem' }}>
          <span style={{ fontWeight: 600 }}>Usage notes</span>
          <textarea value={usageNotes} onChange={e => setUsageNotes(e.target.value)} rows={3}
            placeholder="Anything else the AI advisor should know about how this machine is used…"
            style={{ display: 'block', marginTop: '0.25rem', width: '100%', boxSizing: 'border-box' }} />
        </label>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save profile'}
        </button>

        <span style={{ marginLeft: '1rem' }}>
          <Link to={`/devices/${id}/recommendation`}>View recommendations →</Link>
        </span>
      </form>
    </div>
  );
}
