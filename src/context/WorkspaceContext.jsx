import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ session, onLogout, children }) {
  // App only renders this provider once a session exists, so the session is the
  // authoritative identity here — there is no signed-out case to cover for.
  const [currentUser, setCurrentUser] = useState({
    name: session.name,
    email: session.email,
    role: session.role,
    accessibleClients: []
  });

  const [activeRole, setActiveRole] = useState(session.role);
  const [selectedClient, setSelectedClient] = useState("all");
  const [activeTab, setActiveTab] = useState(session.role === "admin" ? "dashboard" : "my_dashboard");
  const [activeVobId, setActiveVobId] = useState(null);
  // Which dashboard card's page is open (see src/data/dashboardCards.js).
  const [activeCard, setActiveCard] = useState(null);
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

  // Load user profile and accessible clients.
  //
  // Keyed on the session token rather than currentUser.email: /auth/me resolves the
  // caller from the token and writes the answer back into currentUser, so keying it
  // on a field it sets would make the effect re-trigger itself.
  useEffect(() => {
    authApi.getMe().then(me => {
      setCurrentUser(prev => ({
        ...prev,
        ...me,
        // GET /auth/me returns the caller's client access as `clients`; the workspace
        // reads it as `accessibleClients`.
        accessibleClients: me.clients ?? me.accessibleClients ?? prev.accessibleClients
      }));
    }).catch((err) => {
      // Not fatal: the session from login already carries name, email and role.
      console.error('[Workspace] Could not load profile from /auth/me:', err.message);
    });
  }, [session.token]);

  const showToast = (message, type = "info") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
  };

  const openVerification = (vobId) => {
    setActiveVobId(vobId);
    setActiveTab("verification");
  };

  // The Queue tab: the VOB cross-checked against its existing document.
  const openQueue = (vobId) => {
    setActiveVobId(vobId);
    setActiveTab("queue");
  };

  const openCardPage = (cardId) => {
    setActiveCard(cardId);
    setActiveTab("card_detail");
  };

  return (
    <WorkspaceContext.Provider
      value={{
        session,
        currentUser,
        activeRole,
        selectedClient,
        setSelectedClient,
        activeTab,
        setActiveTab,
        activeVobId,
        setActiveVobId,
        openVerification,
        openQueue,
        activeCard,
        openCardPage,
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
