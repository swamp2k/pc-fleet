import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { isLoggedIn, clearToken } from './lib/auth';
import Login from './pages/Login';
import DeviceList from './pages/DeviceList';
import DeviceProfile from './pages/DeviceProfile';
import SpareParts from './pages/SpareParts';
import Recommendation from './pages/Recommendation';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: '8px 12px',
        borderRadius: 'var(--radius)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        background: active ? 'var(--panel-raised)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  );
}

function Sidebar({ open }: { open: boolean }) {
  return (
    <aside
      className={`sidebar${open ? ' open' : ''}`}
      style={{
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        background: 'var(--panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 24px' }}>
        <span className="status-dot online" />
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>
          PC FLEET
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <NavLink to="/devices" label="Devices" />
        <NavLink to="/spares" label="Spare Parts" />
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={() => { clearToken(); window.location.href = '/login'; }}
        >
          Log out
        </button>
      </div>
    </aside>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      <Sidebar open={sidebarOpen} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar">
          <button
            className="hamburger-btn"
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>
            PC FLEET
          </span>
        </div>
        <main className="shell-main">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RequireAuth>
            <Shell>
              <Routes>
                <Route path="/devices" element={<DeviceList />} />
                <Route path="/devices/:id/profile" element={<DeviceProfile />} />
                <Route path="/devices/:id/recommendation" element={<Recommendation />} />
                <Route path="/spares" element={<SpareParts />} />
                <Route path="/" element={<Navigate to="/devices" replace />} />
              </Routes>
            </Shell>
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
