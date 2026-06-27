import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, requestMagicLink, verifyMagicLink } from '../lib/api';
import { setToken } from '../lib/auth';

type Tab = 'password' | 'magic-link';
type MagicState = 'form' | 'sent' | 'verify';

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        background: active ? 'var(--panel-raised)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        border: '1px solid ' + (active ? 'var(--accent-dim)' : 'var(--border)'),
        borderRadius: 'var(--radius)',
        padding: '8px 14px',
        cursor: 'pointer',
        flex: 1,
      }}
    >
      {children}
    </button>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicToken, setMagicToken] = useState('');
  const [magicState, setMagicState] = useState<MagicState>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await login(email, password);
      setToken(token);
      navigate('/devices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestMagicLink(email);
      setMagicState('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send link');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token } = await verifyMagicLink(magicToken);
      setToken(token);
      navigate('/devices');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired token');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
          <span className="status-dot online" />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, letterSpacing: '0.02em' }}>
            PC FLEET
          </span>
        </div>

        <div
          style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 24,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <TabButton active={tab === 'password'} onClick={() => { setTab('password'); setError(''); }}>
              Password
            </TabButton>
            <TabButton active={tab === 'magic-link'} onClick={() => { setTab('magic-link'); setError(''); }}>
              Magic link
            </TabButton>
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
              {error}
            </p>
          )}

          {tab === 'password' && (
            <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Logging in…' : 'Log in'}
              </button>
            </form>
          )}

          {tab === 'magic-link' && magicState === 'form' && (
            <form onSubmit={handleMagicRequest} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
              <button type="button" className="btn" onClick={() => setMagicState('verify')}>
                I have a token
              </button>
            </form>
          )}

          {tab === 'magic-link' && magicState === 'sent' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
                Magic link sent — check the worker logs for now. Paste the token below:
              </p>
              <form onSubmit={handleMagicVerify} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="text" placeholder="Token" value={magicToken} onChange={e => setMagicToken(e.target.value)} required />
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify'}
                </button>
              </form>
            </div>
          )}

          {tab === 'magic-link' && magicState === 'verify' && (
            <form onSubmit={handleMagicVerify} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input type="text" placeholder="Paste token" value={magicToken} onChange={e => setMagicToken(e.target.value)} required />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Verifying…' : 'Verify token'}
              </button>
              <button type="button" className="btn" onClick={() => setMagicState('form')}>
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
