'use client';

import Link from 'next/link';
import { BarChart3, Shield, FileText, LayoutDashboard, LogIn, User } from 'lucide-react';
import { Button } from './ui/Button';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/', label: 'SEO Analyzer', icon: BarChart3 },
  { href: '/', label: 'Security Scan', icon: Shield },
  { href: '/results', label: 'Reports', icon: FileText },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI Website Analyzer
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            <LogIn className="mr-2 h-4 w-4" />
            Login
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 ring-2 ring-slate-200">
            <User className="h-4 w-4 text-slate-600" />
          </div>
        </div>
      </div>
    </header>
  );
}
