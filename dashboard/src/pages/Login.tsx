import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, requestMagicLink, verifyMagicLink } from '../lib/api';
import { setToken } from '../lib/auth';

type Tab = 'password' | 'magic-link';
type MagicState = 'form' | 'sent' | 'verify';

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
    <div style={{ maxWidth: 360, margin: '5rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>PC Fleet</h1>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {(['password', 'magic-link'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setError(''); }}
            style={{ fontWeight: tab === t ? 'bold' : 'normal' }}>
            {t === 'password' ? 'Password' : 'Magic link'}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

      {tab === 'password' && (
        <form onSubmit={handlePasswordLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</button>
        </form>
      )}

      {tab === 'magic-link' && magicState === 'form' && (
        <form onSubmit={handleMagicRequest} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Sending…' : 'Send magic link'}</button>
          <button type="button" onClick={() => setMagicState('verify')}>I have a token</button>
        </form>
      )}

      {tab === 'magic-link' && magicState === 'sent' && (
        <div>
          <p>Magic link sent (check the worker logs for now). Paste the token below:</p>
          <form onSubmit={handleMagicVerify} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
            <input type="text" placeholder="Token" value={magicToken} onChange={e => setMagicToken(e.target.value)} required />
            <button type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</button>
          </form>
        </div>
      )}

      {tab === 'magic-link' && magicState === 'verify' && (
        <form onSubmit={handleMagicVerify} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input type="text" placeholder="Paste token" value={magicToken} onChange={e => setMagicToken(e.target.value)} required />
          <button type="submit" disabled={loading}>{loading ? 'Verifying…' : 'Verify token'}</button>
          <button type="button" onClick={() => setMagicState('form')}>Back</button>
        </form>
      )}
    </div>
  );
}
