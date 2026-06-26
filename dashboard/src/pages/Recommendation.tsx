import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { listRecommendations, generateRecommendation, type Recommendation } from '../lib/api';

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

  if (error && recs.length === 0) return <div style={{ padding: '1.5rem', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800 }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link to={`/devices/${id}/profile`}>← Profile</Link>
        <Link to="/devices">All devices</Link>
      </div>

      <h2>Recommendations</h2>

      <button onClick={handleGenerate} disabled={generating} style={{ marginBottom: '1.5rem' }}>
        {generating ? 'Generating… (this may take ~10s)' : 'Generate new recommendation'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {recs.length === 0 && !generating && (
        <p style={{ fontStyle: 'italic', color: '#888' }}>No recommendations yet. Click the button above to generate one.</p>
      )}

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {recs.length > 1 && (
          <aside style={{ minWidth: 200 }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>History</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recs.map(r => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r)}
                    style={{ fontWeight: selected?.id === r.id ? 'bold' : 'normal', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0' }}>
                    {new Date(r.generated_at).toLocaleString()}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {selected && (
          <article style={{ flex: 1 }}>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
              Generated {new Date(selected.generated_at).toLocaleString()}
              {selected.model_used ? ` · ${selected.model_used}` : ''}
            </p>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.recommendation_text}</div>
          </article>
        )}
      </div>
    </div>
  );
}
