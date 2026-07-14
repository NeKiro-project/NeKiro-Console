import React from 'react';
import { Search, Radio, Bell, User } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchPlaceholder?: string;
}

export default function Header({ searchQuery, setSearchQuery, searchPlaceholder = "Search resource, agent, traces..." }: HeaderProps) {
  return (
    <header className="fixed top-0 right-0 left-60 z-40 flex justify-between items-center px-6 bg-brand-bg/80 backdrop-blur-md border-b border-brand-outline-variant h-12">
      {/* Search Bar Container */}
      <div className="flex items-center gap-4">
        <div className="relative flex items-center bg-brand-container border border-brand-outline-variant/60 rounded px-2.5 py-1 h-8 transition-colors focus-within:border-brand-primary/50">
          <Search size={14} className="text-brand-on-surface-variant mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="bg-transparent border-none outline-none text-brand-on-surface font-mono-code text-[11px] w-64 p-0 m-0 placeholder-brand-on-surface-variant/40 focus:ring-0"
          />
        </div>
      </div>

      {/* Right Side Status & User Widgets */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 font-mono-label text-[10px]">
          <span className="px-2.5 py-1 bg-brand-container rounded border border-brand-outline-variant/50 text-brand-on-surface-variant transition-colors hover:text-brand-primary cursor-pointer">
            Workspace: NK-0814
          </span>
          <span className="w-px h-3 bg-brand-outline-variant/50"></span>
          <span className="px-2.5 py-1 bg-brand-container rounded border border-brand-outline-variant/50 text-brand-on-surface-variant flex items-center gap-1.5 transition-all duration-200 hover:text-brand-primary cursor-pointer">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse inline-block"></span>
            User: SystemAdmin
          </span>
        </div>

        {/* System Utility Controls */}
        <div className="flex items-center gap-2.5 border-l border-brand-outline-variant/40 pl-4 text-brand-on-surface-variant">
          <button className="hover:text-brand-primary hover:bg-brand-container p-1 rounded transition-colors duration-150 relative group" title="Workspace Sensors">
            <Radio size={16} />
            <span className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 bg-brand-high text-brand-on-surface text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Sensors Live
            </span>
          </button>
          
          <button className="hover:text-brand-primary hover:bg-brand-container p-1 rounded transition-colors duration-150 relative group" title="System Alerts">
            <Bell size={16} />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-brand-error rounded-full border border-brand-bg"></span>
            <span className="absolute bottom-[-24px] left-1/2 -translate-x-1/2 bg-brand-high text-brand-on-surface text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Alerts (1)
            </span>
          </button>

          <button className="hover:text-brand-primary hover:bg-brand-container p-1 rounded transition-colors duration-150 relative group" title="User Profile">
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
