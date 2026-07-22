import React, {useEffect, useMemo, useState} from 'react';
import {AlertTriangle, Database, Loader2, RefreshCw, ShieldCheck, Trash2} from 'lucide-react';

import {toPlatformErrorView} from '../api/nekiro';
import type {Agent, Installation, InstallationStatus, PlatformErrorView, Workspace} from '../types';

interface InstallationsTabProps {
  workspace: Workspace | null;
  agents: Agent[];
  installations: Installation[];
  loading: boolean;
  error: PlatformErrorView | null;
  searchQuery: string;
  preselectedAgentId?: string;
  onInstallAgent: (agent: Agent, versionConstraint: string, acceptedPermissions: string[]) => Promise<void>;
  onUpdateInstallation: (installation: Installation, status: Exclude<InstallationStatus, 'uninstalled'>) => Promise<void>;
  onUninstall: (installation: Installation) => Promise<void>;
  onRefresh: () => void;
}

export default function InstallationsTab({
  workspace,
  agents,
  installations,
  loading,
  error,
  searchQuery,
  preselectedAgentId,
  onInstallAgent,
  onUpdateInstallation,
  onUninstall,
  onRefresh,
}: InstallationsTabProps) {
  const publishedAgents = useMemo(() => agents.filter((agent) => agent.status === 'published'), [agents]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [versionConstraint, setVersionConstraint] = useState('');
  const [acceptedPermissions, setAcceptedPermissions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<PlatformErrorView | null>(null);
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null);

  useEffect(() => {
    const next = publishedAgents.find((agent) => agent.id === preselectedAgentId) ?? publishedAgents[0];
    if (next && selectedAgentId === '') {
      setSelectedAgentId(next.id);
      setVersionConstraint(next.version);
      setAcceptedPermissions(next.permissions.map((permission) => permission.id).sort());
    }
  }, [preselectedAgentId, publishedAgents, selectedAgentId]);

  const selectedAgent = publishedAgents.find((agent) => agent.id === selectedAgentId);
  const filteredInstallations = installations.filter((installation) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      installation.installationId,
      installation.workspaceId,
      installation.agentId,
      installation.versionConstraint,
      installation.installedVersion,
      installation.status,
      installation.acceptedPermissions.join(' '),
    ].join(' ').toLowerCase().includes(query);
  });

  const handleSelectAgent = (agentId: string) => {
    const agent = publishedAgents.find((item) => item.id === agentId);
    setSelectedAgentId(agentId);
    setVersionConstraint(agent?.version ?? '');
    setAcceptedPermissions(agent?.permissions.map((permission) => permission.id).sort() ?? []);
  };

  const handleInstall = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAgent) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      await onInstallAgent(selectedAgent, versionConstraint, acceptedPermissions);
    } catch (installError) {
      setLocalError(toPlatformErrorView(installError, 'Unable to install Agent.'));
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    setAcceptedPermissions((current) => current.includes(permissionId)
      ? current.filter((item) => item !== permissionId)
      : [...current, permissionId].sort());
  };

  return (
    <div className="h-full flex flex-col gap-5">
      <div className="glass-page-header flex items-start justify-between gap-4">
        <div>
          <div className="font-mono-label text-[10px] uppercase tracking-[0.24em] text-brand-primary mb-2">Installations</div>
          <h2 className="text-2xl font-bold text-brand-on-surface">Workspace Agent Pins</h2>
          <p className="text-sm text-brand-on-surface-variant mt-1 max-w-3xl">
            Install published Catalog versions into the current Workspace with explicit acceptedPermissions, then inspect and manage Installation v2 lifecycle facts.
          </p>
        </div>
        <button onClick={onRefresh} className="px-3 py-2 rounded bg-brand-container border border-brand-outline-variant text-xs text-brand-on-surface-variant hover:text-brand-on-surface flex items-center gap-2">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {!workspace && (
        <div className="border border-brand-primary/25 bg-brand-primary-container/10 rounded-lg p-4 text-sm text-brand-on-surface-variant">
          Select or create a Workspace in the header before installing Agents. The Console will not create mock Workspace state.
        </div>
      )}

      <ErrorBanner error={error ?? localError} />

      <div className="glass-split-grid grid grid-cols-[minmax(360px,0.85fr)_minmax(520px,1.15fr)] gap-5 min-h-0 flex-1">
        <form onSubmit={handleInstall} className="bg-brand-low border border-brand-outline-variant rounded-xl p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-brand-primary" />
            <div>
              <div className="text-sm font-bold text-brand-on-surface">Install published Agent</div>
              <div className="text-xs text-brand-on-surface-variant">acceptedPermissions is always submitted, including explicit empty arrays.</div>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-xs text-brand-on-surface-variant mb-3">
            Published Agent
            <select value={selectedAgentId} onChange={(event) => handleSelectAgent(event.target.value)} disabled={!workspace || publishedAgents.length === 0} className="bg-brand-lowest border border-brand-outline-variant rounded px-3 py-2 text-brand-on-surface outline-none disabled:opacity-50">
              {publishedAgents.length === 0 && <option value="">No published agents returned</option>}
              {publishedAgents.map((agent) => <option key={agent.id + agent.version} value={agent.id}>{agent.name} ({agent.version})</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-brand-on-surface-variant mb-3">
            Version constraint
            <input value={versionConstraint} onChange={(event) => setVersionConstraint(event.target.value)} disabled={!workspace} className="bg-brand-lowest border border-brand-outline-variant rounded px-3 py-2 text-brand-on-surface outline-none disabled:opacity-50" />
          </label>

          <div className="text-xs font-bold text-brand-on-surface mb-2">Declared permissions</div>
          <div className="space-y-2 mb-4">
            {!selectedAgent && <div className="text-xs text-brand-on-surface-variant">Select a published Agent to review permissions.</div>}
            {selectedAgent && selectedAgent.permissions.length === 0 && (
              <div className="border border-brand-outline-variant rounded p-3 text-xs text-brand-on-surface-variant">This Agent declares no permissions. Submitting installs with acceptedPermissions: [].</div>
            )}
            {selectedAgent?.permissions.map((permission) => (
              <label key={permission.id} className="flex items-start gap-3 bg-brand-lowest border border-brand-outline-variant rounded p-3 cursor-pointer">
                <input type="checkbox" checked={acceptedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} className="mt-1" />
                <span>
                  <span className="font-mono-code text-[11px] text-brand-primary block">{permission.id}</span>
                  <span className="text-xs text-brand-on-surface-variant">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>

          <button disabled={!workspace || !selectedAgent || submitting} className="w-full px-4 py-2 rounded bg-brand-primary text-brand-on-primary text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Install exact pin
          </button>
        </form>

        <div className="bg-brand-low border border-brand-outline-variant rounded-xl overflow-hidden min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b border-brand-outline-variant/60 flex items-center justify-between">
            <span className="text-xs font-bold text-brand-on-surface">Current and historical Installations</span>
            {loading && <Loader2 size={14} className="animate-spin text-brand-primary" />}
          </div>
          <div className="overflow-y-auto divide-y divide-brand-outline-variant/40">
            {filteredInstallations.length === 0 ? (
              <div className="p-8 text-center text-sm text-brand-on-surface-variant">No Installation facts returned for this Workspace.</div>
            ) : filteredInstallations.map((installation) => (
              <div key={installation.installationId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-brand-on-surface">{installation.agentId}</div>
                    <div className="font-mono-code text-[11px] text-brand-on-surface-variant mt-1">{installation.installationId}</div>
                  </div>
                  <StatusBadge status={installation.status} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <Fact label="Constraint" value={installation.versionConstraint} />
                  <Fact label="Pinned" value={installation.installedVersion} />
                  <Fact label="Updated" value={installation.updatedAt} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {installation.acceptedPermissions.length === 0
                    ? <span className="text-[10px] px-2 py-0.5 rounded bg-brand-container border border-brand-outline-variant text-brand-on-surface-variant">acceptedPermissions: []</span>
                    : installation.acceptedPermissions.map((permission) => <span key={permission} className="text-[10px] px-2 py-0.5 rounded bg-brand-container border border-brand-outline-variant text-brand-secondary">{permission}</span>)}
                </div>
                <div className="mt-3 flex gap-2">
                  {installation.status === 'enabled' && <button onClick={() => onUpdateInstallation(installation, 'disabled')} className="px-3 py-1.5 rounded border border-brand-outline-variant text-xs text-brand-on-surface-variant hover:text-brand-on-surface">Disable</button>}
                  {installation.status === 'disabled' && <button onClick={() => onUpdateInstallation(installation, 'enabled')} className="px-3 py-1.5 rounded border border-brand-outline-variant text-xs text-brand-on-surface-variant hover:text-brand-on-surface">Enable</button>}
                  {installation.status === 'disabled' && confirmUninstallId !== installation.installationId && <button onClick={() => setConfirmUninstallId(installation.installationId)} className="px-3 py-1.5 rounded border border-brand-error/30 text-xs text-brand-error flex items-center gap-1.5"><Trash2 size={12} />Uninstall</button>}
                  {installation.status === 'disabled' && confirmUninstallId === installation.installationId && <button onClick={() => onUninstall(installation)} className="px-3 py-1.5 rounded bg-brand-error-container text-xs text-brand-error">Confirm uninstall</button>}
                  {installation.status === 'uninstalled' && <span className="text-xs text-brand-on-surface-variant">Uninstalled at {installation.uninstalledAt}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBanner({error}: {error: PlatformErrorView | null}) {
  if (!error) return null;
  return (
    <div className="border border-brand-error/25 bg-brand-error-container/10 rounded-lg p-3 flex items-start gap-3 text-sm text-brand-error">
      <AlertTriangle size={16} className="mt-0.5" />
      <div>
        <div className="font-semibold">{error.code ?? 'ERROR'} · HTTP {error.status}</div>
        <div className="text-brand-on-surface-variant mt-1">{error.message}</div>
        {error.traceId && <div className="font-mono-code text-[11px] mt-1">traceId: {error.traceId}</div>}
      </div>
    </div>
  );
}

function StatusBadge({status}: {status: InstallationStatus}) {
  const cls = status === 'enabled' ? 'text-green-300 border-green-400/30 bg-green-500/10' : status === 'disabled' ? 'text-brand-primary border-brand-primary/30 bg-brand-primary/10' : 'text-brand-error border-brand-error/30 bg-brand-error-container/10';
  return <span className={'glass-status-badge text-[10px] px-2 py-0.5 rounded border uppercase font-mono-label ' + cls}>{status}</span>;
}

function Fact({label, value}: {label: string; value: string}) {
  return (
    <div className="bg-brand-lowest border border-brand-outline-variant rounded p-2 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-brand-on-surface-variant">{label}</div>
      <div className="font-mono-code text-[11px] text-brand-on-surface mt-1 truncate">{value}</div>
    </div>
  );
}
