import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listRecommendations, generateRecommendation, type Recommendation } from '../lib/api';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function RecommendationPage() {
  const { id } = useParams<{ id: string }>();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [selected, setSelected] = useState<Recommendation | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    listRecommendations(id)
      .then(r => {
        setRecs(r.recommendations);
        if (r.recommendations.length) setSelected(r.recommendations[0]);
      })
      .catch(e => setError(e.message));
  }, [id]);

  async function handleGenerate() {
    if (!id) return;
    setGenerating(true);
    setError('');
    try {
      const result = await generateRecommendation(id);
      const newRec: Recommendation = {
        id: result.id,
        device_id: id,
        generated_at: new Date().toISOString(),
        recommendation_text: result.recommendation_text,
        model_used: result.model_used,
      };
      setRecs(prev => [newRec, ...prev]);
      setSelected(newRec);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  if (error && recs.length === 0) return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--text)', fontSize: 13 }}>
        Error: {error}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: 860 }}>
      <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
        <Link to={`/devices/${id}/profile`} style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          ← Profile
        </Link>
        <Link to="/devices" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
          All devices
        </Link>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>AI Advisor</div>
        <h1 style={{ fontFamily: 'var(--font-mono)', fontSize: 22, margin: 0, fontWeight: 600 }}>Recommendations</h1>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="btn btn-primary"
        style={{ marginBottom: 24 }}
      >
        {generating ? 'Generating… (~10s)' : 'Generate new recommendation'}
      </button>

      {error && (
        <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {recs.length === 0 && !generating && (
        <div style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>No recommendations yet</p>
          <p style={{ margin: '8px 0 0', fontSize: 13 }}>Generate one above to get AI-powered hardware advice for this device.</p>
        </div>
      )}

      {recs.length > 0 && (
        <div style={{ display: 'flex', gap: 20 }}>
          {recs.length > 1 && (
            <aside style={{ minWidth: 180, flexShrink: 0 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recs.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      textAlign: 'left',
                      background: selected?.id === r.id ? 'var(--panel-raised)' : 'transparent',
                      border: '1px solid ' + (selected?.id === r.id ? 'var(--border)' : 'transparent'),
                      borderRadius: 'var(--radius)',
                      color: selected?.id === r.id ? 'var(--text)' : 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      padding: '7px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    {relativeTime(r.generated_at)}
                  </button>
                ))}
              </div>
            </aside>
          )}

          {selected && (
            <article style={{ flex: 1, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)', marginBottom: 16 }}>
                {new Date(selected.generated_at).toLocaleString()}
                {selected.model_used ? ` · ${selected.model_used}` : ''}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14, color: 'var(--text)' }}>
                {selected.recommendation_text}
              </div>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
