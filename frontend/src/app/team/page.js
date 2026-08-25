'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { Users, Plus, UserPlus, Shield, Trash2, Mail, CheckCircle, AlertCircle, Copy, Check, LogIn } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function TeamPageContent() {
  const searchParams = useSearchParams();
  const { user, token: authContextToken } = useAuth();
  const { activeWorkspace, switchWorkspace, fetchWorkspaces: refreshGlobalWorkspaces } = useWorkspace();
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [teamScans, setTeamScans] = useState([]);
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteResult, setInviteResult] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joinTokenInput, setJoinTokenInput] = useState('');

  const getAuthHeader = () => {
    const token = authContextToken || (typeof window !== 'undefined' ? localStorage.getItem('vapt_auth_token') : null);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  useEffect(() => {
    if (user) {
      fetchTeams();
      fetchMyInvitations();
    } else {
      setLoading(false);
    }
    const tokenFromUrl = searchParams.get('joinToken');
    if (tokenFromUrl) {
      setJoinTokenInput(tokenFromUrl);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (activeTeam?._id) {
      fetchTeamScans(activeTeam._id);
    } else {
      setTeamScans([]);
    }
  }, [activeTeam]);

  const fetchTeamScans = async (teamId) => {
    try {
      const res = await fetch(`${API_BASE}/api/team/${teamId}/scans`, {
        headers: getAuthHeader(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTeamScans(data);
      }
    } catch (err) {
      console.error('Failed to fetch team scans:', err);
    }
  };

  const fetchMyInvitations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/team/my-invitations`, {
        headers: getAuthHeader(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPendingInvitations(data);
      }
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
    }
  };

  const handleAcceptInvite = async (token) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/team/join/${token}`, {
        method: 'POST',
        headers: getAuthHeader(),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        if (data.team && data.team._id) {
          await refreshGlobalWorkspaces(data.team._id);
          setActiveTeam(data.team);
        } else {
          await refreshGlobalWorkspaces();
        }
        fetchTeams();
        fetchMyInvitations();
      } else {
        setError(data.error || 'Failed to accept invitation');
      }
    } catch (err) {
      setError('Failed to accept invitation');
    }
  };

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/team/my-teams`, {
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
        if (data.length > 0) {
          const match = data.find(t => t._id === activeWorkspace.id);
          setActiveTeam(match || data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/team/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({ name: newTeamName })
      });
      const data = await res.json();
      if (res.ok) {
        setNewTeamName('');
        if (data.team && data.team._id) {
          await refreshGlobalWorkspaces(data.team._id);
          setActiveTeam(data.team);
        } else {
          await refreshGlobalWorkspaces();
        }
        fetchTeams();
      } else {
        setError(data.error || 'Failed to create team');
      }
    } catch (err) {
      setError('Failed to create team');
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeTeam) return;
    try {
      setInviteResult(null);
      setError(null);
      const res = await fetch(`${API_BASE}/api/team/${activeTeam._id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });
      const data = await res.json();
      if (res.ok) {
        setInviteResult(data);
        setInviteEmail('');
      } else {
        setError(data.error || 'Failed to send invitation');
      }
    } catch (err) {
      setError('Failed to send invitation');
    }
  };

  const handleJoinByToken = async (e) => {
    e.preventDefault();
    if (!joinTokenInput.trim()) return;
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/team/join/${joinTokenInput.trim()}`, {
        method: 'POST',
        headers: {
          ...getAuthHeader()
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setJoinTokenInput('');
        if (data.team && data.team._id) {
          await refreshGlobalWorkspaces(data.team._id);
          setActiveTeam(data.team);
        } else {
          await refreshGlobalWorkspaces();
        }
        fetchTeams();
      } else {
        setError(data.error || 'Failed to join workspace');
      }
    } catch (err) {
      setError('Failed to join workspace');
    }
  };

  if (!user && !loading) {
    return (
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 shadow-2xl space-y-6 max-w-lg mx-auto">
          <div className="h-16 w-16 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Authentication Required</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Please sign in or register an account to create and manage multi-user team workspaces.
            </p>
          </div>
          <div className="flex justify-center gap-4 pt-2">
            <Link
              href="/login"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" /> Sign In
            </Link>
            <Link
              href="/register"
              className="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
            >
              Register Account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-400" /> Multi-User Team Workspaces
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Collaborate on security audits, invite team members, and share asset vulnerability reports.
          </p>
        </div>

        <form onSubmit={handleJoinByToken} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Paste Join Token..."
            value={joinTokenInput}
            onChange={(e) => setJoinTokenInput(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl transition-all shadow-md shadow-indigo-500/20"
          >
            Join Team
          </button>
        </form>
      </div>

      {/* In-App Pending Invitations Notification Banner */}
      {pendingInvitations.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border-2 border-indigo-500/50 p-5 rounded-2xl shadow-2xl space-y-3">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm uppercase tracking-wider">
            <Mail className="h-5 w-5 text-indigo-400 animate-bounce" /> Pending Workspace Invitations ({pendingInvitations.length})
          </div>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.inviteToken} className="bg-slate-950/80 border border-indigo-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">
                    You have been invited to join <span className="text-indigo-400">{inv.teamName}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Invited by {inv.ownerName} as <span className="uppercase font-semibold text-indigo-300">{inv.role}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAcceptInvite(inv.inviteToken)}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-lg shadow-indigo-500/30 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-400" /> Accept Workspace Invitation
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 p-4 rounded-2xl flex items-center justify-between text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 dark:text-rose-400 hover:opacity-80 font-bold">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Create & Select Team Column */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Create New Workspace
            </h2>
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <input
                type="text"
                placeholder="e.g. Acme Cyber Security Team"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-indigo-500/20"
              >
                Create Workspace
              </button>
            </form>
          </div>

          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Your Workspaces</h2>
            {teams.length === 0 ? (
              <p className="text-xs text-slate-500">No team workspaces created yet.</p>
            ) : (
              <div className="space-y-2">
                {teams.map((t) => (
                  <button
                    key={t._id}
                    onClick={() => {
                      setActiveTeam(t);
                      switchWorkspace(t._id);
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-all flex items-center justify-between ${
                      activeTeam?._id === t._id
                        ? 'bg-indigo-50 dark:bg-indigo-600/20 border-indigo-500/50 text-indigo-900 dark:text-white font-bold'
                        : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span>{t.name}</span>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                      {t.members?.length || 1} members
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Active Workspace Content */}
        <div className="md:col-span-2 space-y-6">
          {activeTeam ? (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeTeam.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Created on {new Date(activeTeam.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Invite Member Section (Owners & Admins only) */}
              {(() => {
                const isOwnerOrAdmin = activeTeam.ownerId?._id === user?.id || 
                                       activeTeam.ownerId === user?.id || 
                                       activeTeam.members?.some(m => (m.userId?._id === user?.id || m.userId === user?.id) && (m.role === 'owner' || m.role === 'admin'));

                if (!isOwnerOrAdmin) {
                  return (
                    <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-indigo-500" />
                      Only workspace Owners and Admins can send invitations to new team members.
                    </div>
                  );
                }

                return (
                  <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 p-4 rounded-xl space-y-3">
                    <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                      <UserPlus className="h-4 w-4" /> Invite Team Member
                    </h3>
                    <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        required
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md shadow-indigo-500/20"
                      >
                        Send Invite
                      </button>
                    </form>

                    {inviteResult && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs space-y-2.5 shadow-lg animate-fade-in">
                        <div className="flex items-center gap-2 font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="h-5 w-5 flex-shrink-0" />
                          {inviteResult.message || 'Invitation Sent Successfully!'}
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                          An email invitation has been dispatched to the member. You can also share the direct invite link below:
                        </p>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] font-mono">
                          <span className="truncate flex-1 text-slate-800 dark:text-slate-300">{inviteResult.inviteLink}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(inviteResult.inviteLink);
                              setCopiedToken(true);
                              setTimeout(() => setCopiedToken(false), 2000);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:opacity-80 font-sans flex items-center gap-1 font-semibold"
                          >
                            {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedToken ? 'Copied Link' : 'Copy Link'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Members List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team Members</h3>
                <div className="divide-y divide-slate-200 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {(activeTeam.members || []).map((m) => (
                    <div key={m.userId?._id || m._id} className="p-3.5 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs">
                          {m.userId?.name ? m.userId.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">{m.userId?.name || 'Team User'}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{m.userId?.email || '—'}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shared Team Scans List */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Shared Workspace Scans ({teamScans.length})
                  </h3>
                  <Link href="/" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                    + Run New Security Scan
                  </Link>
                </div>

                {teamScans.length === 0 ? (
                  <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-xs text-slate-500">
                    No security scans run under this team workspace yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {teamScans.map((scan) => (
                      <div key={scan.scanId} className="p-3.5 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-3">
                        <div className="space-y-1 truncate">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {scan.url}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                            <span>Scan ID: <span className="font-mono">{scan.scanId.substring(0, 8)}...</span></span>
                            <span>•</span>
                            <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                            {scan.userId?.name && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">By {scan.userId.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            scan.grade === 'A' || scan.grade === 'A+' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            scan.grade === 'B' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' :
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                            Score {scan.score}/100 ({scan.grade})
                          </div>
                          <Link
                            href={`/results?scanId=${scan.scanId}`}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs"
                          >
                            View Audit Report
                          </Link>
                          {(scan.userId?._id === user?.id || scan.userId === user?.id) && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_BASE}/api/team/move-scan/${scan.scanId}`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...getAuthHeader()
                                    },
                                    body: JSON.stringify({ targetWorkspaceId: 'personal' })
                                  });
                                  if (res.ok) {
                                    fetchTeamScans(activeTeam._id);
                                  }
                                } catch (e) {
                                  console.error('Failed to move scan to personal:', e);
                                }
                              }}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 px-2 py-1.5 rounded-lg transition-colors"
                              title="Move scan to Personal Workspace (Private)"
                            >
                              Move to Personal
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500">
              Select or create a workspace to view team members.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar />
      <Suspense fallback={<div className="flex-1 p-10 text-center text-slate-500">Loading workspaces...</div>}>
        <TeamPageContent />
      </Suspense>
      <Footer />
    </div>
  );
}
