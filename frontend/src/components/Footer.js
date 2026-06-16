'use client';

import Link from 'next/link';
import { Shield, BarChart2 } from 'lucide-react';

const links = [
  { href: '#', label: 'About' },
  { href: '#', label: 'Documentation' },
  { href: '#', label: 'Contact' },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/60 bg-slate-50/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-slate-700">
              <Shield className="h-5 w-5 text-emerald-500" />
              <BarChart2 className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">AI Website Analyzer</p>
              <p className="text-sm text-slate-600">Security + SEO Audit Platform</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-6">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 pt-8 border-t border-slate-200/60">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} AI Website Analyzer. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
