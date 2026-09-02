'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { useWorkspace } from '../lib/WorkspaceContext';
import { BarChart3, Shield, ShieldCheck, FileText, LayoutDashboard, LogIn, LogOut, Sun, Moon, Users, Sparkles, ChevronDown, Check, User, Globe } from 'lucide-react';
import { Button } from './ui/Button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/', label: 'SEO Analyzer', icon: BarChart3 },
  { href: '/', label: 'Security Scan', icon: Shield },
];

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white hidden sm:inline">
              AI Website Analyzer
            </span>
          </Link>

          {/* Workspace Switcher Pill */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
                className="flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-indigo-500/50 transition-all focus:outline-none shadow-sm"
              >
                {activeWorkspace.type === 'personal' ? (
                  <User className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                )}
                <span className="max-w-[130px] truncate">{activeWorkspace.name}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {wsDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setWsDropdownOpen(false)} />
                  <div className="absolute left-0 mt-2 w-56 origin-top-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-20 animate-fade-in space-y-1">
                    <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      Switch Active Workspace
                    </div>
                    
                    <button
                      onClick={() => {
                        switchWorkspace('personal');
                        setWsDropdownOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                        activeWorkspace.type === 'personal'
                          ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-900 dark:text-white font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-indigo-500" /> Personal Workspace
                      </span>
                      {activeWorkspace.type === 'personal' && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                    </button>

                    {workspaces.map((w) => (
                      <button
                        key={w._id}
                        onClick={() => {
                          switchWorkspace(w._id);
                          setWsDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          activeWorkspace.id === w._id
                            ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-900 dark:text-white font-bold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Users className="h-3.5 w-3.5 text-purple-500" /> {w.name}
                        </span>
                        {activeWorkspace.id === w._id && <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                      </button>
                    ))}

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                      <Link
                        href="/team"
                        onClick={() => setWsDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                      >
                        + Create or Join Workspace
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-650 dark:text-slate-400 transition-colors hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
          >
            <Shield className="h-4 w-4" />
            Security Scanner
          </Link>
          {user && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-650 dark:text-slate-400 transition-colors hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4 text-indigo-400" />
              Analytics
            </Link>
          )}
          {user && (
            <Link
              href="/domains"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-650 dark:text-slate-400 transition-colors hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Domains
            </Link>
          )}
          {user && (
            <Link
              href="/team"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-650 dark:text-slate-400 transition-colors hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
            >
              <Users className="h-4 w-4 text-indigo-400" />
              Team Workspaces
            </Link>
          )}
          <Link
            href="/pricing"
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-650 dark:text-slate-400 transition-colors hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            Pricing
          </Link>
          {user && (
            <Link
              href="/history"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-650 dark:text-slate-400 transition-colors hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white"
            >
              <FileText className="h-4 w-4" />
              History
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 relative">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-105 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-650" />
            )}
          </button>

          {!loading && (
            user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full bg-slate-105 dark:bg-slate-900 p-1 pr-3 ring-2 ring-slate-200 dark:ring-slate-800 hover:ring-indigo-500/50 transition-all text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus:outline-none"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-semibold max-w-[100px] truncate">
                    {user.name}
                  </span>
                </button>
                
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-20 animate-fade-in">
                      <div className="px-3 py-2 text-xs border-b border-slate-105 dark:border-slate-800 mb-1 text-slate-500 dark:text-slate-400 truncate">
                        {user.email}
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-105 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <LayoutDashboard className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        Dashboard
                      </Link>
                      <Link
                        href="/domains"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-105 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        Domains
                      </Link>
                      <Link
                        href="/team"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-105 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <Users className="h-4 w-4 text-indigo-400" />
                        Team Workspaces
                      </Link>
                      <Link
                        href="/pricing"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-105 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <Sparkles className="h-4 w-4 text-amber-400" />
                        Pricing Plans
                      </Link>
                      <Link
                        href="/history"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-105 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        Scan History
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-105 dark:hover:bg-slate-900"
              >
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </Link>
              </Button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
