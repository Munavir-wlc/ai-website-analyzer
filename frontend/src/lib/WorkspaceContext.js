'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext();

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function WorkspaceProvider({ children }) {
  const { user, token } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState({
    id: 'personal',
    name: 'Personal Workspace',
    type: 'personal'
  });
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  useEffect(() => {
    if (user && token) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspace({ id: 'personal', name: 'Personal Workspace', type: 'personal' });
      setLoadingWorkspaces(false);
    }
  }, [user, token]);

  const fetchWorkspaces = async () => {
    try {
      setLoadingWorkspaces(true);
      const res = await fetch(`${API_BASE}/api/team/my-teams`, {
        headers: { 'Authorization': `Bearer ${token}` },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);

        // Restore saved workspace from localStorage if valid
        const savedWsId = localStorage.getItem('vapt_active_workspace_id');
        if (savedWsId && savedWsId !== 'personal') {
          const found = data.find(w => w._id === savedWsId);
          if (found) {
            setActiveWorkspace({
              id: found._id,
              name: found.name,
              type: 'team',
              teamData: found
            });
            return;
          }
        }
      }
    } catch (err) {
      console.error('[WorkspaceContext] Error fetching workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  };

  const switchWorkspace = (workspaceId) => {
    if (workspaceId === 'personal') {
      const personalWs = { id: 'personal', name: 'Personal Workspace', type: 'personal' };
      setActiveWorkspace(personalWs);
      localStorage.setItem('vapt_active_workspace_id', 'personal');
    } else {
      const found = workspaces.find(w => w._id === workspaceId);
      if (found) {
        const teamWs = {
          id: found._id,
          name: found.name,
          type: 'team',
          teamData: found
        };
        setActiveWorkspace(teamWs);
        localStorage.setItem('vapt_active_workspace_id', found._id);
      }
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      switchWorkspace,
      fetchWorkspaces,
      loadingWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
