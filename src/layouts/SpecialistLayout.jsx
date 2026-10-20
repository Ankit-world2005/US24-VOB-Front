import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { UI_CONTENT } from '../DB';
import { isAssignedToUser, STORAGE_KEY, CLIENT_REQUESTS_SYNC_EVENT, INITIAL_REQUESTS } from '../data/clientRequests';

const SpecialistDashboardView = lazy(() => import('../views/specialist/SpecialistDashboardView').then(m => ({ default: m.SpecialistDashboardView })));
const VerificationFormView = lazy(() => import('../views/specialist/VerificationFormView').then(m => ({ default: m.VerificationFormView })));
const QueueView = lazy(() => import('../views/specialist/QueueView').then(m => ({ default: m.QueueView })));
const AuthQueueView = lazy(() => import('../views/specialist/AuthQueueView').then(m => ({ default: m.AuthQueueView })));
const ErrorQueueView = lazy(() => import('../views/specialist/ErrorQueueView').then(m => ({ default: m.ErrorQueueView })));
const SavedRecordsView = lazy(() => import('../views/specialist/SavedRecordsView').then(m => ({ default: m.SavedRecordsView })));
const ClientRequestView = lazy(() => import('../views/admin/ClientRequestView').then(m => ({ default: m.ClientRequestView })));
const CardDetailView = lazy(() => import('../views/shared/CardDetailView').then(m => ({ default: m.CardDetailView })));

export function SpecialistLayout() {
  const { activeTab, setActiveTab, currentUser } = useWorkspace();
  const isAuditSpecialist = currentUser?.role === 'auth' || currentUser?.role === 'auth_specialist' || currentUser?.role === 'audit' || currentUser?.email === 'jitender.s@us24solutions.com' || currentUser?.email === 'ankit.k@us24solutions.com';

  // Live count of pending client requests assigned to this specialist
  const [assignedClientRequestsCount, setAssignedClientRequestsCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const list = saved ? JSON.parse(saved) : INITIAL_REQUESTS;
        if (Array.isArray(list)) {
          const pendingForMe = list.filter(r => isAssignedToUser(r, currentUser) && r.status !== 'Completed');
          setAssignedClientRequestsCount(pendingForMe.length);
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
  }, [currentUser]);

  // Automatically redirect regular specialists if attempting restricted views
  useEffect(() => {
    if (!isAuditSpecialist && activeTab === 'queue') {
      setActiveTab('my_dashboard');
    }
  }, [activeTab, isAuditSpecialist, setActiveTab]);

  // Navigation tabs:
  // Audit Specialists have all specialist tabs plus the Audit Queue tab.
  // Regular Specialists have all specialist tabs except the Audit Queue tab.
  const tabs = UI_CONTENT.navigation.specialistTabs
    .filter(tab => tab.id !== 'queue' || isAuditSpecialist)
    .map(tab => {
      if (tab.id === 'queue') {
        return { ...tab, label: '📋 Audit Queue' };
      }
      if (tab.id === 'client_requests') {
        return {
          ...tab,
          label: assignedClientRequestsCount > 0
            ? `📨 Client Requests (${assignedClientRequestsCount})`
            : '📨 Client Requests'
        };
      }
      return tab;
    });

  // A card's page belongs to the dashboard, so its tab stays highlighted there.
  const highlightedTab = activeTab === 'card_detail' ? 'my_dashboard' : activeTab;

  return (
    <div className="specialist-layout">
      {/* Subnav Navigation Tabs */}
      <nav className="workspace-subnav specialist-subnav">
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
          {activeTab === 'my_dashboard' && <SpecialistDashboardView />}
          {activeTab === 'verification' && <VerificationFormView />}
          {activeTab === 'queue' && isAuditSpecialist && <QueueView />}
          {activeTab === 'auth_queue' && <AuthQueueView />}
          {activeTab === 'error_queue' && <ErrorQueueView />}
          {activeTab === 'saved_records' && <SavedRecordsView />}
          {activeTab === 'client_requests' && <ClientRequestView />}
          {activeTab === 'card_detail' && <CardDetailView />}
        </Suspense>
      </div>
    </div>
  );
}
