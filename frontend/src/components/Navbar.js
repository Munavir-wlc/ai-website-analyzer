'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { useWorkspace } from '../lib/WorkspaceContext';
import {
  Shield,
  LayoutDashboard,
  Globe,
  Activity,
  FileText,
  CreditCard,
  Sun,
  Moon,
  Users,
  ChevronDown,
  Check,
  User,
  LogOut,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '@/lib/utils';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const { theme, toggleTheme } = useTheme();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Scanner' },
    ...(user ? [
      { href: '/dashboard', label: 'Overview' },
      { href: '/domains', label: 'Domains' },
      { href: '/monitoring', label: 'Monitoring' },
      { href: '/history', label: 'History' },
    ] : []),
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand & Workspace */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
              <Shield className="h-5 w-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-foreground">
                AI Website Analyzer
              </span>
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono hidden sm:inline-block">
                VAPT
              </span>
            </div>
          </Link>

          {/* Workspace Switcher */}
          {user && (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 transition-colors focus:outline-none"
              >
                {activeWorkspace.type === 'personal' ? (
                  <User className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Users className="h-3.5 w-3.5 text-purple-500" />
                )}
                <span className="max-w-[120px] truncate">{activeWorkspace.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {wsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setWsDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 origin-top-left rounded-lg border border-border bg-card p-1.5 shadow-xl z-30 space-y-1 animate-fade-in text-xs">
                    <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-muted-foreground">
                      Switch Workspace
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

                    <div className="border-t border-border pt-1">
                      <Link
                        href="/team"
                        onClick={() => setWsDropdownOpen(false)}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-primary font-medium hover:bg-primary/10 transition-colors"
                      >
                        + Manage Workspaces
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions & User Menu */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-500" />}
          </button>

          {!loading && (
            user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2.5 hover:border-primary/40 transition-all text-foreground focus:outline-none"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold font-mono text-xs">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-semibold max-w-[90px] truncate hidden sm:inline">
                    {user.name || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-lg border border-border bg-card p-1.5 shadow-xl z-30 space-y-1 animate-fade-in text-xs">
                      <div className="px-2.5 py-2 border-b border-border mb-1 text-muted-foreground truncate">
                        <p className="font-semibold text-foreground truncate">{user.name || 'User'}</p>
                        <p className="text-[10px] truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        Dashboard
                      </Link>
                      <Link
                        href="/domains"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted transition-colors"
                      >
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        Protected Domains
                      </Link>
                      <Link
                        href="/monitoring"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted transition-colors"
                      >
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        Monitoring Console
                      </Link>
                      <Link
                        href="/team"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted transition-colors"
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Team Workspaces
                      </Link>
                      <Link
                        href="/pricing"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted transition-colors"
                      >
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        Plans & Quotas
                      </Link>
                      <div className="border-t border-border pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" size="sm" className="text-xs">
                    Get Started
                  </Button>
                </Link>
              </div>
            )
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground md:hidden"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-card px-4 py-3 md:hidden space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'block px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === link.href ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
