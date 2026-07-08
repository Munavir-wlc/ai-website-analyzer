'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import { BarChart3, Shield, FileText, LayoutDashboard, LogIn, LogOut } from 'lucide-react';
import { Button } from './ui/Button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/', label: 'SEO Analyzer', icon: BarChart3 },
  { href: '/', label: 'Security Scan', icon: Shield },
];

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            AI Website Analyzer
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
          {user && (
            <Link
              href="/history"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-white"
            >
              <FileText className="h-4 w-4" />
              History
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 relative">
          {!loading && (
            user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full bg-slate-900 p-1 pr-3 ring-2 ring-slate-800 hover:ring-indigo-500/50 transition-all text-slate-300 hover:text-white focus:outline-none"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 font-bold text-xs">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                  <span className="text-xs font-semibold max-w-[100px] truncate">
                    {user.name}
                  </span>
                </button>
                
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-slate-800 bg-slate-900 p-2 shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none z-20 animate-fade-in">
                      <div className="px-3 py-2 text-xs border-b border-slate-800 mb-1 text-slate-400 truncate">
                        {user.email}
                      </div>
                      <Link
                        href="/history"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-305 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        <FileText className="h-4 w-4 text-slate-400" />
                        Scan History
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
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
                className="text-slate-300 hover:text-white hover:bg-slate-900"
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
