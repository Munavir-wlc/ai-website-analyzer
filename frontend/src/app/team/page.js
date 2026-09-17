'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { 
  Users, Plus, UserPlus, Shield, Trash2, Mail, CheckCircle, 
  AlertCircle, Copy, Check, LogIn, ExternalLink, RefreshCw, Globe
} from 'lucide-react';

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
      <AppShell activePath="/team">
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="max-w-md w-full p-8 text-center space-y-4">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-lg flex items-center justify-center mx-auto">
              <Users className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-foreground">Authentication Required</h2>
              <p className="text-muted-foreground text-xs">
                Please sign in or register an account to create and manage multi-user team workspaces.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button asChild>
                <Link href="/login" className="gap-2">
                  <LogIn className="h-4 w-4" /> Sign In
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/register">Register</Link>
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath="/team">
      <div className="space-y-6">
        <PageHeader
          title="Multi-User Team Workspaces"
          description="Collaborate on security audits, invite team members, and share asset vulnerability reports."
          breadcrumbs={[
            { label: 'Console', href: '/dashboard' },
            { label: 'Team Workspaces' }
          ]}
          actions={
            <form onSubmit={handleJoinByToken} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste Join Token..."
                value={joinTokenInput}
                onChange={(e) => setJoinTokenInput(e.target.value)}
                className="bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-mono w-44"
              />
              <Button type="submit" size="sm">
                Join Team
              </Button>
            </form>
          }
        />

        {/* Pending Invitations Banner */}
        {pendingInvitations.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <Mail className="h-4 w-4" /> Pending Workspace Invitations ({pendingInvitations.length})
            </div>
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div key={inv.inviteToken} className="bg-card border border-border p-3 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      You have been invited to join <span className="text-primary">{inv.teamName}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Invited by {inv.ownerName} as <span className="uppercase font-semibold text-primary">{inv.role}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(inv.inviteToken)}
                    className="gap-1.5"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Accept Invitation
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3.5 rounded-lg flex items-center justify-between text-xs font-medium">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-destructive hover:opacity-80 font-bold cursor-pointer">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Create & Select Team Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" /> Create New Workspace
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTeam} className="space-y-3">
                  <input
                    type="text"
                    placeholder="e.g. Acme Cyber Security Team"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    size="sm"
                  >
                    Create Workspace
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Workspaces
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {teams.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No team workspaces created yet.</p>
                ) : (
                  teams.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => {
                        setActiveTeam(t);
                        switchWorkspace(t._id);
                      }}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer ${
                        activeTeam?._id === t._id
                          ? 'bg-primary/10 border-primary text-foreground font-semibold'
                          : 'bg-muted/30 border-border text-foreground hover:bg-muted/60'
                      }`}
                    >
                      <span className="truncate">{t.name}</span>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded border border-border text-muted-foreground font-mono">
                        {t.members?.length || 1} members
                      </span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Team Active Workspace Content */}
          <div className="md:col-span-2 space-y-6">
            {activeTeam ? (
              <Card>
                <CardHeader className="pb-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground">{activeTeam.name}</CardTitle>
                      <CardDescription className="text-xs font-mono mt-0.5">
                        Created on {new Date(activeTeam.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Invite Member Section (Owners & Admins only) */}
                  {(() => {
                    const isOwnerOrAdmin = activeTeam.ownerId?._id === user?.id || 
                                           activeTeam.ownerId === user?.id || 
                                           activeTeam.members?.some(m => (m.userId?._id === user?.id || m.userId === user?.id) && (m.role === 'owner' || m.role === 'admin'));

                    if (!isOwnerOrAdmin) {
                      return (
                        <div className="bg-muted/40 border border-border p-3.5 rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary shrink-0" />
                          Only workspace Owners and Admins can send invitations to new team members.
                        </div>
                      );
                    }

                    return (
                      <div className="bg-muted/30 border border-border p-4 rounded-lg space-y-3">
                        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <UserPlus className="h-4 w-4" /> Invite Team Member
                        </h3>
                        <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="email"
                            required
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                          <select
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value)}
                            className="bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none cursor-pointer"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                          <Button
                            type="submit"
                            size="sm"
                          >
                            Send Invite
                          </Button>
                        </form>

                        {inviteResult && (
                          <div className="bg-ok/10 border border-ok/30 text-ok p-3.5 rounded-lg text-xs space-y-2">
                            <div className="flex items-center gap-1.5 font-semibold">
                              <CheckCircle className="h-4 w-4 shrink-0" />
                              {inviteResult.message || 'Invitation Sent Successfully!'}
                            </div>
                            <p className="text-muted-foreground text-[11px]">
                              An email invitation has been dispatched. You can also share the direct invite link below:
                            </p>
                            <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border text-[11px] font-mono">
                              <span className="truncate flex-1 text-foreground">{inviteResult.inviteLink}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(inviteResult.inviteLink);
                                  setCopiedToken(true);
                                  setTimeout(() => setCopiedToken(false), 2000);
                                }}
                                className="text-primary hover:opacity-80 flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                {copiedToken ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedToken ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Members List */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team Members</h3>
                    <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                      {(activeTeam.members || []).map((m) => (
                        <div key={m.userId?._id || m._id} className="p-3.5 bg-card flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                              {m.userId?.name ? m.userId.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-foreground">{m.userId?.name || 'Team User'}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">{m.userId?.email || '—'}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-muted text-foreground border border-border font-mono">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shared Team Scans List */}
                  <div className="space-y-3 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" /> Shared Workspace Scans ({teamScans.length})
                      </h3>
                      <Link href="/" className="text-xs text-primary font-medium hover:underline">
                        + Run New Security Scan
                      </Link>
                    </div>

                    {teamScans.length === 0 ? (
                      <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">
                        No security scans run under this team workspace yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                        {teamScans.map((scan) => (
                          <div key={scan.scanId} className="p-3.5 bg-card flex items-center justify-between gap-3">
                            <div className="space-y-1 truncate">
                              <div className="text-xs font-semibold text-foreground truncate font-mono">
                                {scan.url}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-2 font-mono">
                                <span>ID: {scan.scanId.substring(0, 8)}...</span>
                                <span>•</span>
                                <span>{new Date(scan.createdAt).toLocaleDateString()}</span>
                                {scan.userId?.name && (
                                  <>
                                    <span>•</span>
                                    <span className="text-primary font-medium">By {scan.userId.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                                scan.grade === 'A' || scan.grade === 'A+' ? 'bg-ok/10 text-ok border border-ok/20' :
                                scan.grade === 'B' ? 'bg-primary/10 text-primary border border-primary/20' :
                                'bg-critical/10 text-critical border border-critical/20'
                              }`}>
                                {scan.score}/100 ({scan.grade})
                              </span>
                              <Button
                                asChild
                                size="sm"
                              >
                                <Link href={`/results?scanId=${scan.scanId}`}>
                                  View Audit
                                </Link>
                              </Button>
                              {(scan.userId?._id === user?.id || scan.userId === user?.id) && (
                                <Button
                                  variant="outline"
                                  size="sm"
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
                                  title="Move scan to Personal Workspace (Private)"
                                >
                                  Move to Personal
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={Users}
                title="No Workspace Selected"
                description="Select or create a workspace on the left to view team members and shared asset scans."
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <RefreshCw className="h-7 w-7 text-primary animate-spin" />
      </div>
    }>
      <TeamPageContent />
    </Suspense>
  );
}
