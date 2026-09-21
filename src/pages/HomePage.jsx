import React from 'react';
import { WorkspaceProvider, useWorkspace } from '../context/WorkspaceContext';
import { PortalHeader } from '../layouts/PortalHeader';
import { AdminLayout } from '../layouts/AdminLayout';
import { SpecialistLayout } from '../layouts/SpecialistLayout';
import { Footer } from '../components/Footer';

function WorkspaceShell({ isDark, toggleTheme }) {
  const { activeRole } = useWorkspace();

  return (
    <div className="portal-app-shell">
      <PortalHeader isDark={isDark} toggleTheme={toggleTheme} />

      <main className="portal-main-container">
        {activeRole === 'admin' ? (
          <AdminLayout />
        ) : (
          <SpecialistLayout />
        )}
      </main>

      <Footer />
    </div>
  );
}

export function HomePage({ session, onLogout, isDark, toggleTheme }) {
  return (
    <WorkspaceProvider session={session} onLogout={onLogout}>
      <WorkspaceShell isDark={isDark} toggleTheme={toggleTheme} />
    </WorkspaceProvider>
  );
}

export default HomePage;
