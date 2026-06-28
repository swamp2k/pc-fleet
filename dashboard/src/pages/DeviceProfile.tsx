import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfile, upsertProfile, getHardware, type Device, type UserProfile, type Hardware } from '../lib/api';

const PERF_OPTIONS = ['light', 'everyday', 'gaming', 'creative-pro'] as const;
const USE_CASE_SUGGESTIONS = ['gaming', 'video-editing', 'office', 'browsing', 'development', 'school', 'streaming'];

function HwRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

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

  if (error) return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--text)', fontSize: 13 }}>
        Error: {error}
      </div>
    </div>
  );

  if (!device) return (
    <div style={{ padding: '32px 40px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      Loading…
    </div>
  );

  const gpus: Array<{ model?: string; vram_mb?: number }> = (() => {
    try { return hardware?.gpu_json ? JSON.parse(hardware.gpu_json) : []; }
    catch { return []; }
  })();

  return (
    <div style={{ padding: '32px 40px', maxWidth: 700 }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/devices" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          ← All devices
        </Link>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Device</div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, margin: 0, fontWeight: 600 }}>
          {device.name}{device.owner ? ` — ${device.owner}` : ''}
        </h1>
      </div>

      {hardware ? (
        <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Hardware (from pcwatch)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <HwRow label="CPU" value={`${hardware.cpu_model ?? '—'} (${hardware.cpu_cores ?? '?'} cores)`} />
            <HwRow label="RAM" value={hardware.ram_total_gb != null ? `${hardware.ram_total_gb} GB` : '—'} />
            <HwRow label="GPU" value={gpus.length ? gpus.map(g => g.model ?? 'unknown').join(', ') : '—'} />
            <HwRow label="Motherboard" value={hardware.motherboard_model ?? '—'} />
          </div>
        </section>
      ) : (
        <p style={{ fontStyle: 'italic', color: 'var(--text-faint)', marginBottom: 24, fontSize: 13 }}>
          No hardware inventory collected yet.
        </p>
      )}

      {device.notes && (
        <section style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Admin notes (pcwatch)</div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{device.notes}</p>
        </section>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Fleet Profile</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
              Primary use cases
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {USE_CASE_SUGGESTIONS.map(tag => (
                <label key={tag} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: useCases.includes(tag) ? 'var(--text)' : 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={useCases.includes(tag)}
                    onChange={() => toggleUseCase(tag)}
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Performance expectation
            </div>
            <select
              value={perfExpectation}
              onChange={e => setPerfExpectation(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                background: 'var(--panel-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '9px 12px',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
              }}
            >
              <option value="">— not set —</option>
              {PERF_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              Usage notes
            </div>
            <textarea
              value={usageNotes}
              onChange={e => setUsageNotes(e.target.value)}
              rows={4}
              placeholder="Anything else the AI advisor should know about how this machine is used…"
              style={{
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--panel-raised)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                padding: '9px 12px',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save profile'}
          </button>
          <Link to={`/devices/${id}/recommendation`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
            View recommendations →
          </Link>
        </div>
      </form>
    </div>
  );
}
