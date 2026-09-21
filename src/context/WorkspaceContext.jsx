import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ session, onLogout, children }) {
  const [currentUser, setCurrentUser] = useState({
    name: session?.name || "Saurabh",
    email: session?.email || "saurabh@us24solutions.com",
    role: session?.role || "admin",
    accessibleClients: []
  });

  const [activeRole, setActiveRole] = useState(session?.role || "admin");
  const [selectedClient, setSelectedClient] = useState("all");
  const [activeTab, setActiveTab] = useState(activeRole === "admin" ? "dashboard" : "my_dashboard");
  const [activeVobId, setActiveVobId] = useState("vob_001");
  const [toast, setToast] = useState(null);

  // Sync role if session changes
  useEffect(() => {
    if (session?.role) {
      setActiveRole(session.role);
      setActiveTab(session.role === "admin" ? "dashboard" : "my_dashboard");
      setCurrentUser(prev => ({
        ...prev,
        name: session.name,
        email: session.email,
        role: session.role
      }));
    }
  }, [session]);

  // Load user profile and accessible clients
  useEffect(() => {
    authApi.getMe(currentUser.email).then(me => {
      setCurrentUser(prev => ({
        ...prev,
        ...me
      }));
    }).catch(console.error);
  }, [currentUser.email]);

  const showToast = (message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const switchRole = (newRole) => {
    setActiveRole(newRole);
    if (newRole === "admin") {
      setActiveTab("dashboard");
      setCurrentUser(prev => ({ ...prev, role: "admin", name: "Saurabh", email: "saurabh@us24solutions.com" }));
      showToast("Switched to Administrator Workspace", "success");
    } else {
      setActiveTab("my_dashboard");
      setCurrentUser(prev => ({ ...prev, role: "user", name: "Rohit K", email: "rohit.k@us24solutions.com" }));
      showToast("Switched to Specialist Workspace (Rohit K)", "success");
    }
  };

  const openVerification = (vobId) => {
    setActiveVobId(vobId);
    setActiveTab("verification");
  };

  return (
    <WorkspaceContext.Provider
      value={{
        session,
        currentUser,
        activeRole,
        switchRole,
        selectedClient,
        setSelectedClient,
        activeTab,
        setActiveTab,
        activeVobId,
        setActiveVobId,
        openVerification,
        showToast,
        toast,
        onLogout
      }}
    >
      {children}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span className="toast-dot" />
          <span>{toast.message}</span>
        </div>
      )}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
