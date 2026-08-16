import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Database, Loader2, RefreshCw, ShieldCheck, Trash2} from 'lucide-react';

import {NekiroApiError, toPlatformErrorView, type AgentRelease, type NekiroApiClient} from '../api/nekiro';
import {agentKey, isCurrentRequest, matchesPublishedRelease, nextRequestGeneration} from '../consolePolicy';
import type {Agent, Installation, InstallationStatus, PlatformErrorView, Workspace} from '../types';
import PublicAgentInstallPanel from './PublicAgentInstallPanel';
import {ErrorBanner, Fact, PageHeader, SectionLabel, StatusBadge} from './ui';

interface InstallationsTabProps {
  workspace: Workspace | null;
  agents: Agent[];
  installations: Installation[];
  loading: boolean;
  error: PlatformErrorView | null;
  searchQuery: string;
  client: NekiroApiClient;
  onInstallAgent: (agent: Agent, release: AgentRelease, acceptedPermissions: string[]) => Promise<void>;
  onUpdateInstallation: (installation: Installation, status: Exclude<InstallationStatus, 'uninstalled'>) => Promise<void>;
  onUninstall: (installation: Installation) => Promise<boolean>;
  onRefresh: () => void;
  onPublicInstalled?: () => Promise<void>;
}

export default function InstallationsTab({
  workspace,
  agents,
  installations,
  loading,
  error,
  searchQuery,
  client,
  onInstallAgent,
  onUpdateInstallation,
  onUninstall,
  onRefresh,
  onPublicInstalled = async () => {},
}: InstallationsTabProps) {
  const publishedAgents = useMemo(() => agents.filter((agent) => agent.status === 'published'), [agents]);
  const [selectedAgentKey, setSelectedAgentKey] = useState('');
  const [versionConstraint, setVersionConstraint] = useState('');
  const [acceptedPermissions, setAcceptedPermissions] = useState<string[]>([]);
  const [releaseId, setReleaseId] = useState('');
  const [preflightRelease, setPreflightRelease] = useState<AgentRelease | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<PlatformErrorView | null>(null);
  const [confirmUninstallId, setConfirmUninstallId] = useState<string | null>(null);
  const [busyLifecycle, setBusyLifecycle] = useState(false);
  const preflightGeneration = useRef(0);

  const invalidatePreflight = () => {
    preflightGeneration.current = nextRequestGeneration(preflightGeneration.current);
    setPreflightRelease(null);
    setPreflightLoading(false);
  };

  useEffect(() => {
    if (selectedAgentKey && !publishedAgents.some((agent) => agentKey(agent) === selectedAgentKey)) {
      invalidatePreflight();
      setSelectedAgentKey('');
      setVersionConstraint('');
      setAcceptedPermissions([]);
      setReleaseId('');
      setLocalError(null);
    }
  }, [publishedAgents, selectedAgentKey]);

  const selectedAgent = publishedAgents.find((agent) => agentKey(agent) === selectedAgentKey);
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

  const handleSelectAgent = (selectedKey: string) => {
    const agent = publishedAgents.find((item) => agentKey(item) === selectedKey);
    invalidatePreflight();
    setSelectedAgentKey(selectedKey);
    setVersionConstraint(agent?.version ?? '');
    setAcceptedPermissions([]);
    setReleaseId('');
    setPreflightRelease(null);
    setLocalError(null);
  };

  const handlePreflight = async () => {
    if (!selectedAgent) return;
    const generation = nextRequestGeneration(preflightGeneration.current);
    preflightGeneration.current = generation;
    const requestedAgentKey = selectedAgentKey;
    const requestedReleaseId = releaseId;
    setPreflightLoading(true);
    setLocalError(null);
    try {
      const value = await client.getAgentRelease(requestedReleaseId);
      if (!isCurrentRequest(generation, preflightGeneration.current)) return;
      if (!matchesPublishedRelease(value, selectedAgent)) throw new NekiroApiError(200, 'The selected Release is not a published match for the selected Agent Card.', 'INVALID_RESPONSE');
      if (requestedAgentKey !== selectedAgentKey || requestedReleaseId !== releaseId) return;
      setPreflightRelease(value);
      setVersionConstraint(value.agentCardVersion);
    } catch (value) {
      if (!isCurrentRequest(generation, preflightGeneration.current)) return;
      setPreflightRelease(null);
      setLocalError(toPlatformErrorView(value, 'Unable to preflight the trusted Release.'));
    } finally {
      if (isCurrentRequest(generation, preflightGeneration.current)) setPreflightLoading(false);
    }
  };

  const handleInstall = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAgent || !preflightRelease) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      await onInstallAgent(selectedAgent, preflightRelease, acceptedPermissions);
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

  async function runInstallationAction(installation: Installation, status: Exclude<InstallationStatus, 'uninstalled'>) {
    setBusyLifecycle(true);
    try {
      await onUpdateInstallation(installation, status);
    } finally {
      setBusyLifecycle(false);
    }
  }

  async function runUninstall(installation: Installation) {
    setBusyLifecycle(true);
    try {
      if (await onUninstall(installation)) setConfirmUninstallId(null);
    } finally {
      setBusyLifecycle(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        eyebrow="Installations"
        title="Workspace Agent Pins"
        description="Preflight an immutable published Release before installing its exact Card version into the current Workspace."
      >
        <button onClick={onRefresh} disabled={loading || busyLifecycle} className="btn">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </PageHeader>

      {!workspace && (
        <div className="panel border-accent-line/60 bg-accent-soft/60 px-4 py-3 text-[12.5px] text-accent-bright">
          Select or create a Workspace in the header before installing Agents. The Console will not create mock Workspace state.
        </div>
      )}

      <ErrorBanner error={error ?? localError} />

      <PublicAgentInstallPanel client={client} workspace={workspace} onInstalled={onPublicInstalled} />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,0.85fr)_minmax(520px,1.15fr)] gap-4 max-[1100px]:grid-cols-1">
        {/* Install form */}
        <form onSubmit={handleInstall} className="panel h-fit p-4">
          <div className="mb-4 flex items-center gap-2.5">
            <Database size={15} className="text-accent" />
            <div>
              <div className="text-[13.5px] font-semibold text-fg">Install trusted Release</div>
              <div className="mt-0.5 text-[11.5px] leading-relaxed text-fg-faint">The Release ID is an explicit provider handoff; Catalog publication alone is not trust.</div>
            </div>
          </div>

          <label htmlFor="installation-agent" className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Published Agent
            <select aria-label="Published Agent" id="installation-agent" value={selectedAgentKey} onChange={(event) => handleSelectAgent(event.target.value)} disabled={!workspace || publishedAgents.length === 0 || busyLifecycle} className="field font-mono text-[12px]">
              <option value="">Select a published Agent</option>
              {publishedAgents.map((agent) => <option key={agentKey(agent)} value={agentKey(agent)}>{agent.name} ({agent.version})</option>)}
            </select>
          </label>

          <label htmlFor="trusted-release-id" className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Trusted Release ID
            <div className="flex gap-2">
              <input aria-label="Trusted Release ID" id="trusted-release-id" value={releaseId} onChange={(event) => { invalidatePreflight(); setReleaseId(event.target.value); setLocalError(null); }} disabled={!workspace || preflightLoading || busyLifecycle} placeholder="release-id" className="field min-w-0 flex-1 font-mono text-[12px]" />
              <button type="button" onClick={handlePreflight} disabled={!workspace || !selectedAgent || !releaseId || preflightLoading || busyLifecycle} className="btn">
                {preflightLoading ? 'Reading...' : 'Preflight'}
              </button>
            </div>
          </label>

          {preflightRelease && (
            <div className="mb-3 rounded border border-ok/30 bg-ok-soft p-3.5">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ok">
                <ShieldCheck size={14} /> Published Release preflight passed
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
                <Fact label="Release" value={preflightRelease.releaseId} />
                <Fact label="Version" value={preflightRelease.agentCardVersion} />
                <Fact label="Card digest" value={preflightRelease.cardDigest} />
                <Fact label="Binding" value={preflightRelease.endpointBindingId} />
                <Fact label="Origin" value={preflightRelease.endpointOrigin} />
                <Fact label="Path" value={preflightRelease.endpointPath} />
              </div>
            </div>
          )}

          <label className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Exact version constraint
            <input value={versionConstraint} readOnly className="field font-mono text-[12px] opacity-70" />
          </label>

          <div className="mb-2.5 flex items-center justify-between">
            <SectionLabel>Declared permissions</SectionLabel>
            {selectedAgent && <span className="font-mono text-[10px] text-fg-faint">{acceptedPermissions.length}/{selectedAgent.permissions.length}</span>}
          </div>
          <div className="mb-4 space-y-1.5">
            {!selectedAgent && <div className="text-[12px] text-fg-faint">Select a published Agent to review permissions.</div>}
            {selectedAgent && selectedAgent.permissions.length === 0 && (
              <div className="rounded border border-line px-3 py-2.5 text-[12px] text-fg-muted">This Agent declares no permissions. Submitting installs with acceptedPermissions: [].</div>
            )}
            {selectedAgent?.permissions.map((permission) => (
              <label key={permission.id} className={`flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5 transition-colors duration-100 ${acceptedPermissions.includes(permission.id) ? 'border-accent-line bg-accent-soft' : 'border-line bg-ink-900 hover:border-line-strong'}`}>
                <input type="checkbox" checked={acceptedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} disabled={busyLifecycle} className="mt-0.5 h-3.5 w-3.5 accent-sky-400" />
                <span className="min-w-0">
                  <span className={`block font-mono text-[11px] ${acceptedPermissions.includes(permission.id) ? 'text-accent-bright' : 'text-fg'}`}>{permission.id}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-muted">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>

          <button disabled={!workspace || !selectedAgent || !preflightRelease || submitting || busyLifecycle} className="btn btn-primary h-8 w-full justify-center">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
            Install exact pin
          </button>
        </form>

        {/* Installation history */}
        <div className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <SectionLabel>Current and historical Installations</SectionLabel>
            {loading && <Loader2 size={13} className="animate-spin text-accent" />}
          </div>
          <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {filteredInstallations.length === 0 ? (
              <div className="p-8 text-center text-[12.5px] text-fg-faint">No Installation facts returned for this Workspace.</div>
            ) : (
              filteredInstallations.map((installation) => (
                <div key={installation.installationId} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-fg">{installation.agentId}</div>
                      <div className="mt-0.5 truncate font-mono text-[10.5px] text-fg-faint">{installation.installationId}</div>
                    </div>
                    <StatusBadge status={installation.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1">
                    <Fact label="Constraint" value={installation.versionConstraint} />
                    <Fact label="Pinned" value={installation.installedVersion} />
                    <Fact label="Updated" value={installation.updatedAt} />
                  </div>
                  <div className="mt-1">
                    <Fact label="Installed Release" value={installation.installedReleaseId ?? 'not returned (legacy/untrusted record)'} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {installation.acceptedPermissions.length === 0
                      ? <span className="rounded border border-line bg-ink-900 px-1.5 py-px font-mono text-[9.5px] text-fg-muted">acceptedPermissions: []</span>
                      : installation.acceptedPermissions.map((permission) => (
                        <span key={permission} className="rounded border border-line bg-ink-900 px-1.5 py-px font-mono text-[9.5px] text-fg-muted">{permission}</span>
                      ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {installation.status === 'enabled' && <button disabled={busyLifecycle} onClick={() => runInstallationAction(installation, 'disabled')} className="btn">Disable</button>}
                    {installation.status === 'disabled' && <button disabled={busyLifecycle} onClick={() => runInstallationAction(installation, 'enabled')} className="btn">Enable</button>}
                    {installation.status === 'disabled' && confirmUninstallId !== installation.installationId && (
                      <button disabled={busyLifecycle} onClick={() => setConfirmUninstallId(installation.installationId)} className="btn btn-danger">
                        <Trash2 size={12} />Uninstall
                      </button>
                    )}
                    {installation.status === 'disabled' && confirmUninstallId === installation.installationId && (
                      <button disabled={busyLifecycle} onClick={() => runUninstall(installation)} className="btn btn-danger">Confirm uninstall</button>
                    )}
                    {installation.status === 'uninstalled' && <span className="self-center text-[11.5px] text-fg-faint">Uninstalled at {installation.uninstalledAt}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
