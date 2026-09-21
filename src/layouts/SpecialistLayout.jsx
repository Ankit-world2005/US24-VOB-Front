import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { SpecialistDashboardView } from '../views/specialist/SpecialistDashboardView';
import { VerificationFormView } from '../views/specialist/VerificationFormView';
import { AuthQueueView } from '../views/specialist/AuthQueueView';
import { ErrorQueueView } from '../views/specialist/ErrorQueueView';
import { SavedRecordsView } from '../views/specialist/SavedRecordsView';

export function SpecialistLayout() {
  const { activeTab, setActiveTab } = useWorkspace();

  const tabs = [
    { id: 'my_dashboard', label: '⚡ My Dashboard' },
    { id: 'verification', label: '📝 New Verification' },
    { id: 'auth_queue', label: '⏳ Auth Queue' },
    { id: 'error_queue', label: '⚠️ Error Queue' },
    { id: 'saved_records', label: '✓ Saved Records' }
  ];

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
                className={`workspace-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
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
        {activeTab === 'my_dashboard' && <SpecialistDashboardView />}
        {activeTab === 'verification' && <VerificationFormView />}
        {activeTab === 'auth_queue' && <AuthQueueView />}
        {activeTab === 'error_queue' && <ErrorQueueView />}
        {activeTab === 'saved_records' && <SavedRecordsView />}
      </div>
    </div>
  );
}
