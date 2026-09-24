import React from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { AdminDashboardView } from '../views/admin/AdminDashboardView';
import { UploadAssignView } from '../views/admin/UploadAssignView';
import { MasterDataView } from '../views/admin/MasterDataView';
import { GlobalRecordsView } from '../views/admin/GlobalRecordsView';
import { UserManagementView } from '../views/admin/UserManagementView';
import { AuditLogsView } from '../views/admin/AuditLogsView';
import { UI_CONTENT } from '../DB';

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
        {activeTab === 'dashboard' && <AdminDashboardView />}
        {activeTab === 'upload_assign' && <UploadAssignView />}
        {activeTab === 'master_data' && <MasterDataView />}
        {activeTab === 'records' && <GlobalRecordsView />}
        {activeTab === 'users' && <UserManagementView />}
        {activeTab === 'audit_logs' && <AuditLogsView />}
      </div>
    </div>
  );
}
