'use client';

import { Search, Shield, Zap, LayoutDashboard, TrendingUp, FileText, Link2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIDEBAR_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'seo', label: 'SEO Audit', icon: Search },
  { id: 'siteAudit', label: 'Site Audit', icon: Globe },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'performance', label: 'Performance', icon: Zap },
  { id: 'traffic', label: 'Traffic & Market', icon: TrendingUp },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 },
];

export default function DashboardSidebar({ activeSection, onSectionChange, domain }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white">
      <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Domain</p>
          <p className="mt-1 truncate font-semibold text-slate-900" title={domain}>
            {domain || '—'}
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <p className="px-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            Tools
          </p>
          <ul className="mt-2 space-y-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                    activeSection === item.id
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
