import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {CheckCircle2, Cpu, HelpCircle, ShieldAlert, X} from 'lucide-react';

import {mapCatalogEntry, NekiroApiClient, NekiroApiError, toPlatformErrorView, validateTrustedInstallation, type AgentCardV02, type AgentRelease} from './api/nekiro';
import {agentKey, isCurrentRequest, matchesPublishedRelease, nextRequestGeneration} from './consolePolicy';
import Header from './components/Header';
import InstallationsTab from './components/InstallationsTab';
import InvocationsTab from './components/InvocationsTab';
import LedgerTab from './components/LedgerTab';
import RegistryTab from './components/RegistryTab';
import Sidebar from './components/Sidebar';
import TrustedPublicationTab from './components/TrustedPublicationTab';
import {requireConsoleConfiguration} from './consoleConfig';
import type {Agent, Installation, InstallationStatus, PlatformErrorView, Workspace} from './types';

export default function App() {
  requireConsoleConfiguration(import.meta.env);
  const reduceMotion = useReducedMotion();
  const tabTransition = {duration: reduceMotion ? 0 : 0.14};
  const [activeTab, setActiveTab] = useState<'registry' | 'trusted' | 'installations' | 'invocations' | 'ledger'>('registry');
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providerAgents, setProviderAgents] = useState<Agent[]>([]);
  const [draftAgents, setDraftAgents] = useState<Agent[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<PlatformErrorView | null>(null);
  const [catalogReady, setCatalogReady] = useState(false);
  const [providerCatalogError, setProviderCatalogError] = useState<PlatformErrorView | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const activeWorkspaceRef = useRef<Workspace | null>(null);
  activeWorkspaceRef.current = workspace;
  const [workspaceDraft, setWorkspaceDraft] = useState(import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID ?? '');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<PlatformErrorView | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationLoading, setInstallationLoading] = useState(false);
  const [installationError, setInstallationError] = useState<PlatformErrorView | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const catalogRequestGeneration = useRef(0);
  const providerCatalogRequestGeneration = useRef(0);
  const workspaceRequestGeneration = useRef(0);
  const installationRequestGeneration = useRef(0);
  const defaultWorkspaceInitialized = useRef(false);

  const providerClient = useMemo(
    () => new NekiroApiClient({
      baseUrl: import.meta.env.VITE_NEKIRO_API_BASE_URL,
      token: import.meta.env.VITE_NEKIRO_PROVIDER_TOKEN,
      publicAgentOrigin: import.meta.env.VITE_NEKIRO_PUBLIC_AGENT_ORIGIN,
    }),
    [],
  );
  const ownerClient = useMemo(
    () => new NekiroApiClient({
      baseUrl: import.meta.env.VITE_NEKIRO_API_BASE_URL,
      token: import.meta.env.VITE_NEKIRO_OWNER_TOKEN,
      publicAgentOrigin: import.meta.env.VITE_NEKIRO_PUBLIC_AGENT_ORIGIN,
    }),
    [],
  );

  const loadAgents = useCallback(async (query = '') => {
    const generation = nextRequestGeneration(catalogRequestGeneration.current);
    catalogRequestGeneration.current = generation;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const response = await ownerClient.searchAgents(query.trim() ? {query: query.trim()} : undefined);
      if (!isCurrentRequest(generation, catalogRequestGeneration.current)) return;
      setAgents(response.items.map(mapCatalogEntry));
      setCatalogReady(true);
    } catch (error) {
      if (!isCurrentRequest(generation, catalogRequestGeneration.current)) return;
      setAgents([]);
      setCatalogReady(false);
      setCatalogError(toPlatformErrorView(error, 'Unable to load the NeKiro Catalog.'));
    } finally {
      if (isCurrentRequest(generation, catalogRequestGeneration.current)) setCatalogLoading(false);
    }
  }, [ownerClient]);

  const loadProviderAgents = useCallback(async (query = '') => {
    const generation = nextRequestGeneration(providerCatalogRequestGeneration.current);
    providerCatalogRequestGeneration.current = generation;
    setProviderCatalogError(null);
    try {
      const providerId = import.meta.env.VITE_NEKIRO_PROVIDER_ID;
      const response = await providerClient.searchAgents({ownerId: providerId, ...(query.trim() ? {query: query.trim()} : {})});
      if (!isCurrentRequest(generation, providerCatalogRequestGeneration.current)) return;
      setProviderAgents(response.items.map(mapCatalogEntry).filter((agent) => agent.ownerId === providerId));
    } catch (error) {
      if (!isCurrentRequest(generation, providerCatalogRequestGeneration.current)) return;
      setProviderAgents([]);
      setProviderCatalogError(toPlatformErrorView(error, 'Unable to load provider-owned Agent Cards.'));
    }
  }, [providerClient]);

  const loadWorkspace = useCallback(async (workspaceId: string) => {
    const generation = nextRequestGeneration(workspaceRequestGeneration.current);
    workspaceRequestGeneration.current = generation;
    installationRequestGeneration.current = nextRequestGeneration(installationRequestGeneration.current);
    setInstallations([]);
    setInstallationLoading(false);
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const value = await ownerClient.getWorkspace(workspaceId);
      if (!isCurrentRequest(generation, workspaceRequestGeneration.current)) return null;
      setWorkspace(value);
      setWorkspaceDraft(value.workspaceId);
      return value;
    } catch (error) {
      if (!isCurrentRequest(generation, workspaceRequestGeneration.current)) return null;
      setWorkspace(null);
      setInstallations([]);
      setWorkspaceError(toPlatformErrorView(error, 'Unable to load Workspace.'));
      return null;
    } finally {
      if (isCurrentRequest(generation, workspaceRequestGeneration.current)) setWorkspaceLoading(false);
    }
  }, [ownerClient]);

  const loadInstallations = useCallback(async (workspaceId = workspace?.workspaceId) => {
    const generation = nextRequestGeneration(installationRequestGeneration.current);
    installationRequestGeneration.current = generation;
    if (!workspaceId) {
      setInstallations([]);
      return;
    }
    setInstallationLoading(true);
    setInstallationError(null);
    try {
      const response = await ownerClient.listInstallations(workspaceId, {limit: 100});
      if (!isCurrentRequest(generation, installationRequestGeneration.current)) return;
      setInstallations(response.items);
    } catch (error) {
      if (!isCurrentRequest(generation, installationRequestGeneration.current)) return;
      setInstallations([]);
      setInstallationError(toPlatformErrorView(error, 'Unable to load Workspace Installations.'));
    } finally {
      if (isCurrentRequest(generation, installationRequestGeneration.current)) setInstallationLoading(false);
    }
  }, [ownerClient, workspace?.workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAgents(searchQuery);
      void loadProviderAgents(searchQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadAgents, loadProviderAgents, searchQuery]);

  useEffect(() => {
    if (defaultWorkspaceInitialized.current) return;
    const defaultWorkspaceId = import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID;
    if (!defaultWorkspaceId) return;
    defaultWorkspaceInitialized.current = true;
    void loadWorkspace(defaultWorkspaceId).then((value) => value && loadInstallations(value.workspaceId));
  }, [loadInstallations, loadWorkspace]);

  const handleCreateWorkspace = async () => {
    const generation = nextRequestGeneration(workspaceRequestGeneration.current);
    workspaceRequestGeneration.current = generation;
    installationRequestGeneration.current = nextRequestGeneration(installationRequestGeneration.current);
    setInstallations([]);
    setInstallationLoading(false);
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const value = await ownerClient.createWorkspace(workspaceDraft);
      if (!isCurrentRequest(generation, workspaceRequestGeneration.current)) return;
      setWorkspace(value);
      setWorkspaceDraft(value.workspaceId);
      await loadInstallations(value.workspaceId);
    } catch (error) {
      if (isCurrentRequest(generation, workspaceRequestGeneration.current)) {
        setWorkspaceError(toPlatformErrorView(error, 'Unable to create Workspace.'));
      }
    } finally {
      if (isCurrentRequest(generation, workspaceRequestGeneration.current)) setWorkspaceLoading(false);
    }
  };

  const handleReadWorkspace = async () => {
    const value = await loadWorkspace(workspaceDraft);
    if (value) {
      await loadInstallations(value.workspaceId);
    }
  };

  const handleRegisterAgent = async (card: AgentCardV02) => {
    const entry = await providerClient.registerAgent(card);
    const draftAgent = mapCatalogEntry(entry);
    setDraftAgents((current) => upsertAgent(current, draftAgent));
    await Promise.all([loadAgents(searchQuery), loadProviderAgents(searchQuery)]);
    return draftAgent;
  };

  const handlePublishAgent = async (agent: Agent) => {
    await providerClient.publishAgentVersion(agent.id, agent.version);
    setDraftAgents((current) => current.filter((draft) => agentKey(draft) !== agentKey(agent)));
    await Promise.all([loadAgents(searchQuery), loadProviderAgents(searchQuery)]);
  };

  const handleInstallAgent = async (agent: Agent, release: AgentRelease, acceptedPermissions: string[]) => {
    if (!workspace) {
      throw new Error('Select or create a Workspace before installing an Agent.');
    }
    if (!matchesPublishedRelease(release, agent)) {
      throw new NekiroApiError(0, 'The selected Release is not a published match for the selected Agent Card.', 'INVALID_RESPONSE');
    }
    const operationWorkspaceId = workspace.workspaceId;
    const installation = await ownerClient.installAgent(operationWorkspaceId, {
      agentId: agent.id,
      versionConstraint: release.agentCardVersion,
      acceptedPermissions,
    });
    try {
      validateTrustedInstallation(installation, release, {
        workspaceId: operationWorkspaceId,
        agentId: agent.id,
        versionConstraint: release.agentCardVersion,
        acceptedPermissions,
      });
    } finally {
      if (activeWorkspaceRef.current?.workspaceId === operationWorkspaceId) {
        await loadInstallations(operationWorkspaceId);
      }
    }
  };

  const handleUpdateInstallation = async (installation: Installation, status: Exclude<InstallationStatus, 'uninstalled'>) => {
    const operationWorkspaceId = workspace?.workspaceId;
    const operationGeneration = workspaceRequestGeneration.current;
    const operationInstallationGeneration = installationRequestGeneration.current;
    if (!operationWorkspaceId) {
      return;
    }
    setInstallationError(null);
    try {
      await ownerClient.updateInstallation(operationWorkspaceId, installation.installationId, status);
      if (isCurrentRequest(operationGeneration, workspaceRequestGeneration.current)
        && isCurrentRequest(operationInstallationGeneration, installationRequestGeneration.current)
        && activeWorkspaceRef.current?.workspaceId === operationWorkspaceId) {
        await loadInstallations(operationWorkspaceId);
      }
    } catch (error) {
      if (isCurrentRequest(operationGeneration, workspaceRequestGeneration.current)
        && isCurrentRequest(operationInstallationGeneration, installationRequestGeneration.current)) {
        setInstallations([]);
        setInstallationError(toPlatformErrorView(error, 'Unable to update Installation.'));
      }
    }
  };

  const handleUninstall = async (installation: Installation) => {
    const operationWorkspaceId = workspace?.workspaceId;
    const operationGeneration = workspaceRequestGeneration.current;
    const operationInstallationGeneration = installationRequestGeneration.current;
    if (!operationWorkspaceId) {
      return false;
    }
    setInstallationError(null);
    try {
      await ownerClient.uninstallAgent(operationWorkspaceId, installation.installationId);
      if (isCurrentRequest(operationGeneration, workspaceRequestGeneration.current)
        && isCurrentRequest(operationInstallationGeneration, installationRequestGeneration.current)
        && activeWorkspaceRef.current?.workspaceId === operationWorkspaceId) {
        await loadInstallations(operationWorkspaceId);
      }
      return true;
    } catch (error) {
      if (isCurrentRequest(operationGeneration, workspaceRequestGeneration.current)
        && isCurrentRequest(operationInstallationGeneration, installationRequestGeneration.current)) {
        setInstallations([]);
        setInstallationError(toPlatformErrorView(error, 'Unable to uninstall Agent.'));
      }
      return false;
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'registry':
        return 'Search agent name, description, capability...';
      case 'trusted':
        return 'Filter registered Agent Cards...';
      case 'installations':
        return 'Search installation id, agent id, pinned version...';
      case 'invocations':
        return 'Filter active Workspace invocations...';
      case 'ledger':
        return 'Read Invocation or Trace metadata...';
    }
  };

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-ink-950 font-sans text-fg">
      <div className="app-grid" aria-hidden="true" />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
        }}
        onOpenSettings={() => setShowSettings(true)}
        onOpenSupport={() => setShowSupport(true)}
      />

      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder={getSearchPlaceholder()}
        workspace={workspace}
        workspaceDraft={workspaceDraft}
        setWorkspaceDraft={setWorkspaceDraft}
        workspaceLoading={workspaceLoading}
        workspaceError={workspaceError}
        onReadWorkspace={handleReadWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        userLabel={workspace?.ownerId ?? 'Workspace owner'}
        apiConfigured={Boolean(import.meta.env.VITE_NEKIRO_API_BASE_URL && import.meta.env.VITE_NEKIRO_PROVIDER_ID && import.meta.env.VITE_NEKIRO_PROVIDER_TOKEN && import.meta.env.VITE_NEKIRO_OWNER_TOKEN && import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID)}
      />

      <main className="relative z-10 ml-[232px] mt-14 h-[calc(100vh-56px)] w-[calc(100vw-232px)] overflow-y-auto p-7 max-[900px]:ml-16 max-[900px]:w-[calc(100vw-64px)] max-[900px]:p-4">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'registry' && (
            <motion.div key="registry" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={tabTransition} className="w-full h-full">
              <RegistryTab
                agents={agents}
                draftAgents={draftAgents}
                onRegisterAgent={handleRegisterAgent}
                onPublishAgent={handlePublishAgent}
                catalogLoading={catalogLoading}
                catalogError={catalogError}
                catalogReady={catalogReady}
                defaultOwnerId={import.meta.env.VITE_NEKIRO_PROVIDER_ID ?? ''}
                defaultOwnerName={import.meta.env.VITE_NEKIRO_PROVIDER_NAME ?? ''}
                searchQuery={searchQuery}
              />
            </motion.div>
          )}

          {activeTab === 'trusted' && (
            <motion.div key="trusted" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={tabTransition} className="w-full h-full">
              <TrustedPublicationTab
                providerId={import.meta.env.VITE_NEKIRO_PROVIDER_ID ?? ''}
                client={providerClient}
                agents={providerAgents}
                draftAgents={draftAgents}
                providerCatalogError={providerCatalogError}
                onRefresh={() => void loadProviderAgents(searchQuery)}
              />
            </motion.div>
          )}

          {activeTab === 'installations' && (
            <motion.div key="installations" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={tabTransition} className="w-full h-full">
              <InstallationsTab
                workspace={workspace}
                agents={agents}
                installations={installations}
                loading={installationLoading}
                error={installationError}
                searchQuery={searchQuery}
                client={ownerClient}
                onInstallAgent={handleInstallAgent}
                onUpdateInstallation={handleUpdateInstallation}
                onUninstall={handleUninstall}
                onRefresh={() => void loadInstallations()}
                onPublicInstalled={() => loadInstallations()}
              />
            </motion.div>
          )}

          {activeTab === 'invocations' && (
            <motion.div key="invocations" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={tabTransition} className="w-full h-full">
              <InvocationsTab workspace={workspace} installations={installations} client={ownerClient} />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div key="ledger" initial={{opacity: 0, y: 6}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -6}} transition={tabTransition} className="w-full h-full">
              <div key={workspace?.workspaceId ?? 'no-workspace'} className="contents"><LedgerTab workspace={workspace} client={ownerClient} /></div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showSettings && (
        <Overlay title="Control Plane Settings" icon={<Cpu size={20} />} onClose={() => setShowSettings(false)}>
          <div className="divide-y divide-line">
            <FactRow label="Base URL" value={import.meta.env.VITE_NEKIRO_API_BASE_URL || 'not configured'} />
            <FactRow label="Provider context" value="VITE_NEKIRO_PROVIDER_ID + VITE_NEKIRO_PROVIDER_TOKEN" />
            <FactRow label="Workspace owner context" value="VITE_NEKIRO_OWNER_TOKEN (credentials are never persisted in local storage)" />
            <FactRow label="Default Workspace" value={import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID || 'manual selection'} />
          </div>
        </Overlay>
      )}

      {showSupport && (
        <Overlay title="MVP Boundary" icon={<HelpCircle size={20} />} onClose={() => setShowSupport(false)}>
          <div className="space-y-3 text-[12.5px] leading-relaxed text-fg-muted">
            <p>Live surfaces: Registry, Workspace, Installations, Invocation Dispatch, and metadata-only Ledger through public Gateway routes.</p>
            <p>Runtime reads are Owner-authorized and Workspace-scoped. The Console never stores Agent secrets or fabricates Ledger events.</p>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({title, icon, children, onClose}: {title: string; icon: React.ReactNode; children: React.ReactNode; onClose: () => void}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="panel w-full max-w-lg overflow-hidden bg-ink-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5 text-accent">
            {icon}
            <h2 className="text-[14px] font-semibold text-fg">{title}</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost h-7 w-7 justify-center p-0">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
          <ShieldAlert size={13} className="text-accent" />
          <span>Only public Gateway routes are called from the browser.</span>
          <CheckCircle2 size={13} className="ml-auto text-ok" />
        </div>
      </div>
    </div>
  );
}

function FactRow({label, value}: {label: string; value: string}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[11px] uppercase tracking-wider text-fg-faint">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-[11.5px] text-fg">{value}</span>
    </div>
  );
}

function upsertAgent(agents: Agent[], next: Agent): Agent[] {
  return [next, ...agents.filter((agent) => agentKey(agent) !== agentKey(next))];
}
