import { useEffect, useState } from 'react';
import { listSpares, createSpare, updateSpare, deleteSpare, triggerSpareSync, type SparePart } from '../lib/api';

const PART_TYPES = ['ram', 'gpu', 'cpu', 'psu', 'storage', 'motherboard', 'case', 'cooler', 'other'];
const CONDITIONS = ['new', 'used', 'unknown'] as const;

const EMPTY_FORM = { part_type: '', model: '', spec_json: '', condition: 'unknown' as string, location: '', acquired_at: '', notes: '' };

const fieldLabel: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  display: 'block',
  marginBottom: 5,
};

const selectStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'var(--panel-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  padding: '9px 12px',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
};

function WhereCell({ part }: { part: SparePart }) {
  if (part.device_id && part.device_name) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>
        {part.device_name}
      </span>
    );
  }
  if (part.location) {
    return <span style={{ color: 'var(--text-muted)' }}>{part.location}</span>;
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 4,
      background: 'var(--panel-raised)', fontSize: 11, color: 'var(--text-faint)',
      fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    }}>
      in stock
    </span>
  );
}

export default function SpareParts() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | 'create' | SparePart>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  function load() {
    listSpares().then(r => setParts(r.parts)).catch(e => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setForm(EMPTY_FORM); setModal('create'); }
  function openEdit(p: SparePart) {
    setForm({
      part_type: p.part_type, model: p.model ?? '', spec_json: p.spec_json ?? '',
      condition: p.condition ?? 'unknown', location: p.location ?? '',
      acquired_at: p.acquired_at ?? '', notes: p.notes ?? '',
    });
    setModal(p);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg('');
    setError('');
    try {
      const r = await triggerSpareSync();
      setSyncMsg(`Synced ${r.synced} components · ${r.inStocked} moved to stock`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.part_type) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        part_type: form.part_type, model: form.model || null, spec_json: form.spec_json || null,
        condition: form.condition || null, location: form.location || null,
        acquired_at: form.acquired_at || null, notes: form.notes || null,
      };
      if (modal === 'create') {
        await createSpare(payload);
      } else if (modal && typeof modal === 'object') {
        await updateSpare(modal.id, payload);
      }
      load();
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this spare part?')) return;
    try {
      await deleteSpare(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const TH_STYLE: React.CSSProperties = {
    textAlign: 'left',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    padding: '0 12px 10px',
    borderBottom: '1px solid var(--border)',
  };

  const TD_STYLE: React.CSSProperties = {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border-soft)',
    fontSize: 13,
    color: 'var(--text-muted)',
  };

  const editingAuto = modal && typeof modal === 'object' && modal.source === 'auto';

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Inventory</div>
          <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, margin: 0, fontWeight: 600 }}>Spare Parts</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {syncMsg && (
            <span style={{ fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{syncMsg}</span>
          )}
          <button onClick={handleSync} className="btn" disabled={syncing}>
            {syncing ? 'Syncing…' : '⟳ Sync now'}
          </button>
          <button onClick={openCreate} className="btn btn-primary">+ Add part</button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {parts.length === 0 && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>No spare parts recorded</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>Click "Sync now" to import hardware from your devices, or add parts manually.</p>
        </div>
      )}

      {parts.length > 0 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div className="table-scroll">
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {['Type', 'Model', 'Where', 'Condition', 'Acquired', ''].map(h => (
                    <th key={h} style={TH_STYLE}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map(p => (
                  <tr key={p.id}>
                    <td style={{ ...TD_STYLE, fontFamily: 'var(--font-mono)', color: 'var(--text)', fontSize: 12 }}>
                      {p.part_type}
                    </td>
                    <td style={{ ...TD_STYLE, color: 'var(--text)' }}>
                      {p.model ?? '—'}
                      {p.source === 'auto' && (
                        <span style={{
                          display: 'inline-block', marginLeft: 7, padding: '1px 5px',
                          borderRadius: 3, background: 'var(--panel-raised)',
                          fontSize: 10, color: 'var(--text-faint)',
                          fontFamily: 'var(--font-mono)', verticalAlign: 'middle',
                        }}>auto</span>
                      )}
                    </td>
                    <td style={TD_STYLE}><WhereCell part={p} /></td>
                    <td style={TD_STYLE}>{p.condition ?? '—'}</td>
                    <td style={{ ...TD_STYLE, fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.acquired_at ?? '—'}</td>
                    <td style={{ ...TD_STYLE, display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => openEdit(p)}>Edit</button>
                      <button className="btn" style={{ padding: '6px 10px', fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger-dim)' }} onClick={() => handleDelete(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          padding: 16,
        }}>
          <div style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 28,
            minWidth: 'min(420px, 100%)',
            maxWidth: 500,
            width: '100%',
          }}>
            <div className="eyebrow" style={{ marginBottom: editingAuto ? 8 : 16 }}>
              {modal === 'create' ? 'Add spare part' : 'Edit spare part'}
            </div>
            {editingAuto && (
              <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                Type, model and spec are managed by auto-sync. Condition, location and notes are yours to set.
              </p>
            )}
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={fieldLabel}>Type *</label>
                <select value={form.part_type} onChange={e => setForm(f => ({ ...f, part_type: e.target.value }))} required style={selectStyle} disabled={!!editingAuto}>
                  <option value="">— select —</option>
                  {PART_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Model</label>
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. Samsung 870 EVO 500GB" disabled={!!editingAuto} />
              </div>
              <div>
                <label style={fieldLabel}>Spec (free text)</label>
                <input value={form.spec_json} onChange={e => setForm(f => ({ ...f, spec_json: e.target.value }))}
                  placeholder="e.g. 16GB DDR4-3200, 2×8" disabled={!!editingAuto} />
              </div>
              <div>
                <label style={fieldLabel}>Condition</label>
                <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} style={selectStyle}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Location</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. shelf A3, box in garage" />
              </div>
              <div>
                <label style={fieldLabel}>Acquired date</label>
                <input type="date" value={form.acquired_at} onChange={e => setForm(f => ({ ...f, acquired_at: e.target.value }))}
                  style={{ colorScheme: 'dark' }} />
              </div>
              <div>
                <label style={fieldLabel}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', background: 'var(--panel-raised)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '9px 12px', fontFamily: 'var(--font-body)', fontSize: 14, resize: 'vertical' }} />
              </div>
              {error && (
                <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text)', fontSize: 13 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
