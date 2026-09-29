import React, { Suspense, lazy } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { UI_CONTENT } from '../DB';

const AdminDashboardView = lazy(() => import('../views/admin/AdminDashboardView').then(m => ({ default: m.AdminDashboardView })));
const UploadAssignView = lazy(() => import('../views/admin/UploadAssignView').then(m => ({ default: m.UploadAssignView })));
const MasterDataView = lazy(() => import('../views/admin/MasterDataView').then(m => ({ default: m.MasterDataView })));
const GlobalRecordsView = lazy(() => import('../views/admin/GlobalRecordsView').then(m => ({ default: m.GlobalRecordsView })));
const UserManagementView = lazy(() => import('../views/admin/UserManagementView').then(m => ({ default: m.UserManagementView })));
const AuditLogsView = lazy(() => import('../views/admin/AuditLogsView').then(m => ({ default: m.AuditLogsView })));

export function AdminLayout() {
  const { activeTab, setActiveTab } = useWorkspace();
  const tabs = UI_CONTENT.navigation.adminTabs;

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
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--ink-soft)', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--rule)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span>Loading…</span>
          </div>
        }>
          {activeTab === 'dashboard' && <AdminDashboardView />}
          {activeTab === 'upload_assign' && <UploadAssignView />}
          {activeTab === 'master_data' && <MasterDataView />}
          {activeTab === 'records' && <GlobalRecordsView />}
          {activeTab === 'users' && <UserManagementView />}
          {activeTab === 'audit_logs' && <AuditLogsView />}
        </Suspense>
      </div>
    </div>
  );
}
