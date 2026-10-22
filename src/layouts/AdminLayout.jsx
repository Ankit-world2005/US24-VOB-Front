import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { UI_CONTENT } from '../DB';
import { STORAGE_KEY, CLIENT_REQUESTS_SYNC_EVENT, INITIAL_REQUESTS } from '../data/clientRequests';

const AdminDashboardView = lazy(() => import('../views/admin/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const UploadAssignView = lazy(() => import('../views/admin/UploadAssignView').then(m => ({ default: m.UploadAssignView })));
const ClientRequestView = lazy(() => import('../views/admin/ClientRequestView').then(m => ({ default: m.ClientRequestView })));
const GlobalRecordsView = lazy(() => import('../views/admin/GlobalRecordsView').then(m => ({ default: m.GlobalRecordsView })));
const UserManagementView = lazy(() => import('../views/admin/UserManagementView').then(m => ({ default: m.UserManagementView })));
const CardDetailView = lazy(() => import('../views/shared/CardDetailView').then(m => ({ default: m.CardDetailView })));

export function AdminLayout() {
  const { activeTab, setActiveTab } = useWorkspace();
  const [pendingClientRequestsCount, setPendingClientRequestsCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const list = saved ? JSON.parse(saved) : INITIAL_REQUESTS;
        if (Array.isArray(list)) {
          const pending = list.filter(r => r.status !== 'Completed');
          setPendingClientRequestsCount(pending.length);
        }
      } catch (err) {
        // ignore parse error
      }
    };

    updateCount();

    const handleSync = () => updateCount();
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) updateCount();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CLIENT_REQUESTS_SYNC_EVENT, handleSync);
    const interval = setInterval(updateCount, 3000);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CLIENT_REQUESTS_SYNC_EVENT, handleSync);
      clearInterval(interval);
    };
  }, []);

  const tabs = UI_CONTENT.navigation.adminTabs.map(tab => {
    if (tab.id === 'client_requests') {
      return {
        ...tab,
        label: pendingClientRequestsCount > 0
          ? `📨 Client Requests (${pendingClientRequestsCount})`
          : '📨 Client Requests'
      };
    }
    return tab;
  });

  // A card's page belongs to the dashboard, so its tab stays highlighted there.
  const highlightedTab = activeTab === 'card_detail' ? 'dashboard' : activeTab;

  return (
    <div className="admin-layout">
      {/* Subnav Navigation Tabs */}
      <nav className="workspace-subnav">
        <div className="subnav-inner">
          <div className="subnav-tabs-group">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`workspace-tab-btn ${highlightedTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Active View Container */}
      <div className="workspace-content-area">
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--ink-soft)', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--rule)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span>Loading…</span>
          </div>
        }>
          {activeTab === 'dashboard' && <AdminDashboardView />}
          {activeTab === 'upload_assign' && <UploadAssignView />}
          {activeTab === 'client_requests' && <ClientRequestView />}
          {activeTab === 'records' && <GlobalRecordsView />}
          {activeTab === 'users' && <UserManagementView />}
          {activeTab === 'card_detail' && <CardDetailView />}
        </Suspense>
      </div>
    </div>
  );
}
