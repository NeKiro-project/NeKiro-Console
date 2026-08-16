import { AlertTriangle, CheckCircle2, Database, Plus, Search, User } from 'lucide-react';

import type { PlatformErrorView, Workspace } from '../types';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchPlaceholder?: string;
  workspace: Workspace | null;
  workspaceDraft: string;
  setWorkspaceDraft: (workspaceId: string) => void;
  workspaceLoading: boolean;
  workspaceError: PlatformErrorView | null;
  onReadWorkspace: () => void;
  onCreateWorkspace: () => void;
  userLabel: string;
  apiConfigured: boolean;
}

export default function Header({
  searchQuery,
  setSearchQuery,
  searchPlaceholder = 'Search resource, agent, traces...',
  workspace,
  workspaceDraft,
  setWorkspaceDraft,
  workspaceLoading,
  workspaceError,
  onReadWorkspace,
  onCreateWorkspace,
  userLabel,
  apiConfigured,
}: HeaderProps) {
  return (
    <header className="fixed left-[232px] right-0 top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-line bg-ink-900/85 px-5 backdrop-blur-md max-[900px]:left-16 max-[900px]:px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Search */}
        <label className="relative flex h-[30px] min-w-0 flex-1 items-center max-[900px]:max-w-none">
          <Search size={13} className="pointer-events-none absolute left-2.5 text-fg-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="field w-full pl-7 sm:w-[230px] xl:w-[320px]"
          />
        </label>

        {/* Workspace control */}
        <div className="flex h-[30px] items-center gap-1.5 rounded border border-line bg-ink-850 pl-2.5 pr-1.5">
          <Database size={13} className={workspace ? 'text-ok' : 'text-fg-faint'} />
          <input
            value={workspaceDraft}
            onChange={(event) => setWorkspaceDraft(event.target.value)}
            placeholder="workspace id"
            className="w-[110px] bg-transparent font-mono text-[11.5px] text-fg outline-none placeholder:text-fg-faint xl:w-[160px] max-[900px]:w-16 max-[700px]:hidden"
          />
          <button
            onClick={onReadWorkspace}
            disabled={workspaceLoading || !workspaceDraft.trim()}
            className="btn h-6 px-2 text-[11px]"
          >
            Load
          </button>
          <button
            onClick={onCreateWorkspace}
            disabled={workspaceLoading || !workspaceDraft.trim()}
            aria-label="Create workspace"
            title="Create workspace"
            className="btn btn-primary h-6 px-2 text-[11px]"
          >
            <Plus size={11} />
            <span>Create</span>
          </button>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {workspaceError && (
          <div className="hidden max-w-[16rem] items-center gap-1.5 truncate rounded border border-danger/30 bg-danger-soft px-2 py-1 font-mono text-[10px] text-danger lg:flex" title={workspaceError.message}>
            <AlertTriangle size={11} />
            <span>{workspaceError.code ?? 'WORKSPACE_ERROR'}</span>
            {workspaceError.traceId && <span className="text-fg-faint">trace {workspaceError.traceId}</span>}
          </div>
        )}

        <div className="flex items-center gap-1.5 font-mono text-[10px] text-fg-muted">
          <span className="flex h-[26px] items-center gap-1.5 rounded border border-line bg-ink-850 px-2.5 uppercase tracking-wider">
            <span className={`status-dot ${apiConfigured ? 'bg-ok' : 'bg-danger'}`} aria-hidden="true" />
            <span className="max-[560px]:hidden">API: {apiConfigured ? 'configured' : 'missing'}</span>
            <span className="hidden max-[560px]:inline">API</span>
          </span>
          <span className="hidden h-[26px] items-center rounded border border-line bg-ink-850 px-2.5 md:flex">
            Workspace: {workspace?.workspaceId ?? 'not selected'}
          </span>
          <span className="hidden h-[26px] items-center gap-1.5 rounded border border-line bg-ink-850 px-2.5 md:flex">
            <User size={11} />
            {userLabel}
          </span>
          {workspace && <CheckCircle2 size={14} className="text-ok" />}
        </div>
      </div>
    </header>
  );
}
