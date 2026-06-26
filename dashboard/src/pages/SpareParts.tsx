import { useEffect, useState } from 'react';
import { listSpares, createSpare, updateSpare, deleteSpare, type SparePart } from '../lib/api';

const PART_TYPES = ['ram', 'gpu', 'cpu', 'psu', 'storage', 'motherboard', 'case', 'cooler', 'other'];
const CONDITIONS = ['new', 'used', 'unknown'] as const;

const EMPTY_FORM = { part_type: '', model: '', spec_json: '', condition: 'unknown' as string, location: '', acquired_at: '', notes: '' };

export default function SpareParts() {
  const [parts, setParts] = useState<SparePart[]>([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | 'create' | SparePart>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Spare Parts</h2>
        <button onClick={openCreate}>+ Add part</button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {parts.length === 0 && <p style={{ fontStyle: 'italic', color: '#888' }}>No spare parts recorded yet.</p>}

      {parts.length > 0 && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {['Type', 'Model', 'Spec', 'Condition', 'Location', 'Acquired', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '0.5rem' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parts.map(p => (
              <tr key={p.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{p.part_type}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{p.model ?? '—'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', fontSize: '0.85rem', color: '#555' }}>{p.spec_json ?? '—'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{p.condition ?? '—'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{p.location ?? '—'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{p.acquired_at ?? '—'}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => openEdit(p)}>Edit</button>
                  <button onClick={() => handleDelete(p.id)} style={{ color: 'red' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '2rem', minWidth: 400, maxWidth: 480 }}>
            <h3 style={{ marginTop: 0 }}>{modal === 'create' ? 'Add spare part' : 'Edit spare part'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label>
                <span>Type *</span>
                <select value={form.part_type} onChange={e => setForm(f => ({ ...f, part_type: e.target.value }))} required
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem' }}>
                  <option value="">— select —</option>
                  {PART_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label>
                Model
                <input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  placeholder="e.g. Samsung 870 EVO 500GB" style={{ display: 'block', width: '100%', marginTop: '0.2rem', boxSizing: 'border-box' }} />
              </label>
              <label>
                Spec (free text)
                <input value={form.spec_json} onChange={e => setForm(f => ({ ...f, spec_json: e.target.value }))}
                  placeholder="e.g. 16GB DDR4-3200, 2x8" style={{ display: 'block', width: '100%', marginTop: '0.2rem', boxSizing: 'border-box' }} />
              </label>
              <label>
                Condition
                <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem' }}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>
                Location
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. shelf A3, box in garage" style={{ display: 'block', width: '100%', marginTop: '0.2rem', boxSizing: 'border-box' }} />
              </label>
              <label>
                Acquired date
                <input type="date" value={form.acquired_at} onChange={e => setForm(f => ({ ...f, acquired_at: e.target.value }))}
                  style={{ display: 'block', marginTop: '0.2rem' }} />
              </label>
              <label>
                Notes
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem', boxSizing: 'border-box' }} />
              </label>
              {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
