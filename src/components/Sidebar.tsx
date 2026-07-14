import React from 'react';
import { Database, Cpu, PlayCircle, BookOpen, Settings, HelpCircle, Terminal } from 'lucide-react';

interface SidebarProps {
  activeTab: 'registry' | 'installations' | 'invocations' | 'ledger';
  setActiveTab: (tab: 'registry' | 'installations' | 'invocations' | 'ledger') => void;
  onOpenSettings?: () => void;
  onOpenSupport?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onOpenSettings, onOpenSupport }: SidebarProps) {
  const navItems = [
    { id: 'registry', name: 'Registry', icon: Database },
    { id: 'installations', name: 'Installations', icon: Cpu },
    { id: 'invocations', name: 'Invocations', icon: PlayCircle },
    { id: 'ledger', name: 'Ledger', icon: BookOpen },
  ] as const;

  return (
    <aside 
      id="sidebar"
      className="w-60 h-screen fixed left-0 top-0 bg-brand-lowest border-r border-brand-outline-variant flex flex-col py-4 overflow-y-auto z-50 shadow-lg"
    >
      {/* Branding Header */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary shadow-[0_0_8px_rgba(173,198,255,0.1)]">
          <Terminal size={18} className="animate-pulse" />
        </div>
        <div>
          <h1 className="font-headline-md text-sm font-bold text-brand-on-surface leading-none tracking-tight">
            NeKiro Phase 1
          </h1>
          <p className="font-mono-label text-[10px] text-brand-on-surface-variant mt-1 uppercase tracking-wider">
            Infrastructure Orchestrator
          </p>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded font-mono-label text-xs transition-all duration-150 cursor-pointer active:scale-98 text-left ${
                isActive
                  ? 'text-brand-primary bg-brand-secondary-container/30 border-r-2 border-brand-primary'
                  : 'text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-brand-high'
              }`}
            >
              <IconComponent size={16} className={isActive ? 'text-brand-primary' : 'text-brand-on-surface-variant'} />
              <span>{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Settings & Support */}
      <div className="px-3 mt-auto space-y-1 pt-4 border-t border-brand-outline-variant/30">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded font-mono-label text-xs text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-brand-high transition-all duration-150 text-left"
        >
          <Settings size={16} />
          <span>Settings</span>
        </button>
        <button
          onClick={onOpenSupport}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded font-mono-label text-xs text-brand-on-surface-variant hover:text-brand-on-surface hover:bg-brand-high transition-all duration-150 text-left"
        >
          <HelpCircle size={16} />
          <span>Support</span>
        </button>
      </div>
    </aside>
  );
}
