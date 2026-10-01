import React, { Suspense, lazy } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { UI_CONTENT } from '../DB';

const SpecialistDashboardView = lazy(() => import('../views/specialist/SpecialistDashboardView').then(m => ({ default: m.SpecialistDashboardView })));
const VerificationFormView = lazy(() => import('../views/specialist/VerificationFormView').then(m => ({ default: m.VerificationFormView })));
const AuthQueueView = lazy(() => import('../views/specialist/AuthQueueView').then(m => ({ default: m.AuthQueueView })));
const ErrorQueueView = lazy(() => import('../views/specialist/ErrorQueueView').then(m => ({ default: m.ErrorQueueView })));
const SavedRecordsView = lazy(() => import('../views/specialist/SavedRecordsView').then(m => ({ default: m.SavedRecordsView })));
const CardDetailView = lazy(() => import('../views/shared/CardDetailView').then(m => ({ default: m.CardDetailView })));

export function SpecialistLayout() {
  const { activeTab, setActiveTab } = useWorkspace();
  const tabs = UI_CONTENT.navigation.specialistTabs;
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
          {activeTab === 'auth_queue' && <AuthQueueView />}
          {activeTab === 'error_queue' && <ErrorQueueView />}
          {activeTab === 'saved_records' && <SavedRecordsView />}
          {activeTab === 'card_detail' && <CardDetailView />}
        </Suspense>
      </div>
    </div>
  );
}
