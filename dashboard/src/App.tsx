import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { isLoggedIn, clearToken } from './lib/auth';
import Login from './pages/Login';
import DeviceList from './pages/DeviceList';
import DeviceProfile from './pages/DeviceProfile';
import SpareParts from './pages/SpareParts';
import Recommendation from './pages/Recommendation';

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

function Nav() {
  return (
    <nav style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid #ddd', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      <strong>PC Fleet</strong>
      <a href="/devices">Devices</a>
      <a href="/spares">Spare Parts</a>
      <span style={{ marginLeft: 'auto' }}>
        <button onClick={() => { clearToken(); window.location.href = '/login'; }}>Log out</button>
      </span>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <RequireAuth>
            <>
              <Nav />
              <Routes>
                <Route path="/devices" element={<DeviceList />} />
                <Route path="/devices/:id/profile" element={<DeviceProfile />} />
                <Route path="/devices/:id/recommendation" element={<Recommendation />} />
                <Route path="/spares" element={<SpareParts />} />
                <Route path="/" element={<Navigate to="/devices" replace />} />
              </Routes>
            </>
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
