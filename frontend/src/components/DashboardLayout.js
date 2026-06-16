'use client';

import DashboardSidebar from './DashboardSidebar';
import { useState } from 'react';

export default function DashboardLayout({ children, domain, activeSection: initialSection = 'overview', onSectionChange: externalOnChange }) {
  const [internalSection, setInternalSection] = useState(initialSection);
  const activeSection = externalOnChange ? initialSection : internalSection;
  const handleSectionChange = externalOnChange || setInternalSection;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1">
        <DashboardSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          domain={domain}
        />
        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {typeof children === 'function' ? children(activeSection) : children}
        </main>
      </div>
    </div>
  );
}
