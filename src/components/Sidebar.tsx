import { BookOpen, Cpu, Database, HelpCircle, PlayCircle, Settings, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  activeTab: 'registry' | 'trusted' | 'installations' | 'invocations' | 'ledger';
  setActiveTab: (tab: 'registry' | 'trusted' | 'installations' | 'invocations' | 'ledger') => void;
  onOpenSettings?: () => void;
  onOpenSupport?: () => void;
}

/** The NeKiro monogram — the exact brand mark from public/favicon.ico: sky "N" on ink. */
function Monogram() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#111827" />
      <path d="M9 23V9h3.6l6.8 8.6V9H23v14h-3.4l-7-8.8V23H9z" fill="#38bdf8" />
    </svg>
  );
}

export default function Sidebar({ activeTab, setActiveTab, onOpenSettings, onOpenSupport }: SidebarProps) {
  const navItems = [
    { id: 'registry', name: 'Registry', icon: Database },
    { id: 'trusted', name: 'Trusted Publication', icon: ShieldCheck },
    { id: 'installations', name: 'Installations', icon: Cpu },
    { id: 'invocations', name: 'Invocations', icon: PlayCircle },
    { id: 'ledger', name: 'Ledger', icon: BookOpen },
  ] as const;

  return (
    <aside
      id="sidebar"
      className="fixed left-0 top-0 z-50 flex h-screen w-[232px] flex-col border-r border-line bg-ink-900 py-5 max-[900px]:w-16 max-[900px]:items-center max-[900px]:py-4"
    >
      {/* Branding */}
      <div className="mb-8 flex items-center gap-2.5 px-4 max-[900px]:mb-6 max-[900px]:px-0">
        <Monogram />
        <div className="min-w-0 max-[900px]:hidden">
          <div className="text-[14px] font-bold leading-none tracking-tight text-fg">NeKiro</div>
          <div className="mono-label mt-1.5">Agent Control Plane</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2.5 max-[900px]:w-full max-[900px]:px-1.5">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-label={item.name}
              title={item.name}
              className={`relative flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[12.5px] transition-colors duration-100 max-[900px]:justify-center max-[900px]:px-0 ${
                isActive
                  ? 'bg-accent-soft font-medium text-accent-bright'
                  : 'text-fg-muted hover:bg-ink-800 hover:text-fg'
              }`}
            >
              {isActive && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" aria-hidden="true" />}
              <IconComponent size={15} className={isActive ? 'text-accent' : 'text-fg-faint'} />
              <span className="max-[900px]:hidden">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto space-y-0.5 border-t border-line px-2.5 pt-3 max-[900px]:w-full max-[900px]:px-1.5">
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[12.5px] text-fg-muted transition-colors duration-100 hover:bg-ink-800 hover:text-fg max-[900px]:justify-center max-[900px]:px-0"
        >
          <Settings size={15} className="text-fg-faint" />
          <span className="max-[900px]:hidden">Settings</span>
        </button>
        <button
          onClick={onOpenSupport}
          aria-label="Support"
          title="Support"
          className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[12.5px] text-fg-muted transition-colors duration-100 hover:bg-ink-800 hover:text-fg max-[900px]:justify-center max-[900px]:px-0"
        >
          <HelpCircle size={15} className="text-fg-faint" />
          <span className="max-[900px]:hidden">Support</span>
        </button>
        <div className="mt-3 flex items-center justify-between px-3 pb-1 max-[900px]:hidden">
          <span className="font-mono text-[9.5px] uppercase tracking-wider text-fg-faint">Northbound API v3 / v4</span>
        </div>
      </div>
    </aside>
  );
}
