import React, { Suspense, lazy } from 'react';
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext';
import { PortalHeader } from '../layouts/PortalHeader';
import { Footer } from '../components/Footer';

// Dynamic code splitting: Admin and Specialist bundles only load for their respective roles
const AdminLayout = lazy(() => import('../layouts/AdminLayout').then(m => ({ default: m.AdminLayout })));
const SpecialistLayout = lazy(() => import('../layouts/SpecialistLayout').then(m => ({ default: m.SpecialistLayout })));

const WorkspaceRoleLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    color: 'var(--ink-soft, #64748b)',
    gap: '10px'
  }}>
    <span style={{
      display: 'inline-block',
      width: '18px',
      height: '18px',
      border: '2px solid rgba(249, 115, 22, 0.25)',
      borderTopColor: '#f97316',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <span style={{ fontSize: '13px', fontWeight: 500 }}>Loading workspace view…</span>
  </div>
);

function WorkspaceShell() {
  const { activeRole } = useWorkspace();

  return (
    <div className="portal-app-shell">
      <PortalHeader />

      <main className="portal-main-container">
        <Suspense fallback={<WorkspaceRoleLoader />}>
          {activeRole === 'admin' ? (
            <AdminLayout />
          ) : (
            <SpecialistLayout />
          )}
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}

export function HomePage({ session, onLogout }) {
  return (
    <WorkspaceProvider session={session} onLogout={onLogout}>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}

export default HomePage;
