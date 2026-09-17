'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useWorkspace } from '@/lib/WorkspaceContext';
import { useTheme } from '@/lib/ThemeContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Shield,
  ShieldAlert,
  Globe,
  Activity,
  Clock,
  GitCompare,
  Users,
  CreditCard,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Menu,
  X,
  User,
  Check,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Button } from './ui/Button';

const MAIN_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/', label: 'Security Scanner', icon: ShieldAlert },
  { href: '/domains', label: 'Protected Domains', icon: Globe },
  { href: '/monitoring', label: 'Continuous Monitoring', icon: Activity },
  { href: '/history', label: 'Scan History', icon: Clock },
  { href: '/compare', label: 'Change Intelligence', icon: GitCompare },
];

const WORKSPACE_NAV = [
  { href: '/team', label: 'Team Workspaces', icon: Users },
];

const BILLING_NAV = [
  { href: '/pricing', label: 'Plans & Usage', icon: CreditCard },
];

export default function AppShell({ children, pageTitle, pageDescription, actions }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const { theme, toggleTheme } = useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const NavItem = ({ item }) => {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 group relative',
          active
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? item.label : undefined}
      >
        <Icon className={cn('h-4 w-4 shrink-0 transition-colors', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {active && !collapsed && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased transition-colors duration-200">
      
      {/* Mobile Top Header */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">AI Analyzer</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {user ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold font-mono">
              {user.email ? user.email[0].toUpperCase() : 'U'}
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm" variant="default" className="text-xs h-8 px-3">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 relative">
        
        {/* Mobile Backdrop Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar (Desktop Persistent + Mobile Drawer) */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-all duration-300 md:static',
            collapsed ? 'w-16' : 'w-64',
            mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
          )}
        >
          {/* Sidebar Brand Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4 shrink-0">
            <Link href="/" className={cn('flex items-center gap-2.5 min-w-0', collapsed && 'justify-center w-full')}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              {(!collapsed || mobileOpen) && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tracking-tight text-foreground truncate">
                      AI Analyzer
                    </span>
                    <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                      VAPT
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">Cybersecurity Platform</p>
                </div>
              )}
            </Link>

            {/* Mobile close button / Desktop collapse toggle */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Workspace Switcher */}
          {user && (!collapsed || mobileOpen) && (
            <div className="p-3 border-b border-border">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary shrink-0">
                      {activeWorkspace.type === 'personal' ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                    </div>
                    <span className="truncate font-semibold">{activeWorkspace.name}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>

                {wsDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setWsDropdownOpen(false)} />
                    <div className="absolute left-0 top-full mt-1.5 w-full min-w-[200px] rounded-lg border border-border bg-card p-1.5 shadow-lg z-40 space-y-1 animate-fade-in text-xs">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Workspaces
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          switchWorkspace('personal');
                          setWsDropdownOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors',
                          activeWorkspace.type === 'personal'
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-foreground'
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-primary" /> Personal Workspace
                        </span>
                        {activeWorkspace.type === 'personal' && <Check className="h-3.5 w-3.5 text-primary" />}
                      </button>

                      {workspaces.map((w) => (
                        <button
                          key={w._id}
                          type="button"
                          onClick={() => {
                            switchWorkspace(w._id);
                            setWsDropdownOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors truncate',
                            activeWorkspace.id === w._id
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-muted text-foreground'
                          )}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Users className="h-3.5 w-3.5 text-purple-500" /> {w.name}
                          </span>
                          {activeWorkspace.id === w._id && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      ))}

                      <div className="pt-1 border-t border-border">
                        <Link
                          href="/team"
                          onClick={() => setWsDropdownOpen(false)}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Create Workspace
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Navigation Links List */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            <div>
              {(!collapsed || mobileOpen) && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Main
                </p>
              )}
              <div className="space-y-1">
                {MAIN_NAV.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
            </div>

            <div>
              {(!collapsed || mobileOpen) && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Workspace
                </p>
              )}
              <div className="space-y-1">
                {WORKSPACE_NAV.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
            </div>

            <div>
              {(!collapsed || mobileOpen) && (
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Billing
                </p>
              )}
              <div className="space-y-1">
                {BILLING_NAV.map((item) => (
                  <NavItem key={item.href} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="border-t border-border p-3 space-y-2 shrink-0">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                collapsed && 'justify-center px-2'
              )}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
              {(!collapsed || mobileOpen) && (
                <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
              )}
            </button>

            {/* User Profile / Logout */}
            {user ? (
              <div
                className={cn(
                  'flex items-center gap-2.5 rounded-lg border border-border bg-background p-2 transition-colors',
                  collapsed && 'justify-center p-1.5'
                )}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold font-mono shrink-0">
                  {user.email ? user.email[0].toUpperCase() : 'U'}
                </div>
                {(!collapsed || mobileOpen) && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user.name || user.email?.split('@')[0]}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                )}
                {(!collapsed || mobileOpen) && (
                  <button
                    type="button"
                    onClick={logout}
                    className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                    title="Sign Out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <Link href="/login" className="block">
                <Button variant="default" size="sm" className="w-full text-xs">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 flex flex-col bg-background">
          <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
