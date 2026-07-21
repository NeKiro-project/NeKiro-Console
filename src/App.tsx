import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {CheckCircle2, Cpu, HelpCircle, ShieldAlert, X} from 'lucide-react';

import {mapCatalogEntry, NekiroApiClient, toPlatformErrorView, type AgentCardV02} from './api/nekiro';
import Header from './components/Header';
import InstallationsTab from './components/InstallationsTab';
import InvocationsTab from './components/InvocationsTab';
import LedgerTab from './components/LedgerTab';
import RegistryTab from './components/RegistryTab';
import Sidebar from './components/Sidebar';
import type {Agent, Installation, InstallationStatus, PlatformErrorView, Workspace} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<'registry' | 'installations' | 'invocations' | 'ledger'>('registry');
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [draftAgents, setDraftAgents] = useState<Agent[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<PlatformErrorView | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceDraft, setWorkspaceDraft] = useState(import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID ?? '');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<PlatformErrorView | null>(null);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [installationLoading, setInstallationLoading] = useState(false);
  const [installationError, setInstallationError] = useState<PlatformErrorView | null>(null);
  const [pendingInstallAgentId, setPendingInstallAgentId] = useState<string | undefined>();
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  const nekiroClient = useMemo(
    () => new NekiroApiClient({
      baseUrl: import.meta.env.VITE_NEKIRO_API_BASE_URL,
      token: import.meta.env.VITE_NEKIRO_TOKEN,
    }),
    [],
  );

  const loadAgents = useCallback(async (query = '') => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const response = await nekiroClient.searchAgents(query.trim() ? {query: query.trim()} : undefined);
      setAgents(response.items.map(mapCatalogEntry));
    } catch (error) {
      setCatalogError(toPlatformErrorView(error, 'Unable to load the NeKiro Catalog.'));
    } finally {
      setCatalogLoading(false);
    }
  }, [nekiroClient]);

  const loadWorkspace = useCallback(async (workspaceId: string) => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const value = await nekiroClient.getWorkspace(workspaceId);
      setWorkspace(value);
      setWorkspaceDraft(value.workspaceId);
      return value;
    } catch (error) {
      setWorkspace(null);
      setInstallations([]);
      setWorkspaceError(toPlatformErrorView(error, 'Unable to load Workspace.'));
      return null;
    } finally {
      setWorkspaceLoading(false);
    }
  }, [nekiroClient]);

  const loadInstallations = useCallback(async (workspaceId = workspace?.workspaceId) => {
    if (!workspaceId) {
      setInstallations([]);
      return;
    }
    setInstallationLoading(true);
    setInstallationError(null);
    try {
      const response = await nekiroClient.listInstallations(workspaceId, {limit: 100});
      setInstallations(response.items);
    } catch (error) {
      setInstallationError(toPlatformErrorView(error, 'Unable to load Workspace Installations.'));
    } finally {
      setInstallationLoading(false);
    }
  }, [nekiroClient, workspace?.workspaceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAgents(searchQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadAgents, searchQuery]);

  useEffect(() => {
    const defaultWorkspaceId = import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID;
    if (defaultWorkspaceId) {
      void loadWorkspace(defaultWorkspaceId).then((value) => {
        if (value) {
          void loadInstallations(value.workspaceId);
        }
      });
    }
  }, [loadInstallations, loadWorkspace]);

  const handleCreateWorkspace = async () => {
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const value = await nekiroClient.createWorkspace(workspaceDraft);
      setWorkspace(value);
      setWorkspaceDraft(value.workspaceId);
      await loadInstallations(value.workspaceId);
    } catch (error) {
      setWorkspaceError(toPlatformErrorView(error, 'Unable to create Workspace.'));
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleReadWorkspace = async () => {
    const value = await loadWorkspace(workspaceDraft);
    if (value) {
      await loadInstallations(value.workspaceId);
    }
  };

  const handleRegisterAgent = async (card: AgentCardV02) => {
    const entry = await nekiroClient.registerAgent(card);
    const draftAgent = mapCatalogEntry(entry);
    setDraftAgents((current) => upsertAgent(current, draftAgent));
    await loadAgents(searchQuery);
    return draftAgent;
  };

  const handlePublishAgent = async (agent: Agent) => {
    await nekiroClient.publishAgentVersion(agent.id, agent.version);
    setDraftAgents((current) => current.filter((draft) => agentKey(draft) !== agentKey(agent)));
    await loadAgents(searchQuery);
  };

  const handleDisableAgent = async (agent: Agent) => {
    await nekiroClient.disableAgentVersion(agent.id, agent.version);
    await loadAgents(searchQuery);
  };

  const handleOpenInstall = (agent: Agent) => {
    setPendingInstallAgentId(agent.id);
    setActiveTab('installations');
    setSearchQuery('');
  };

  const handleInstallAgent = async (agent: Agent, versionConstraint: string, acceptedPermissions: string[]) => {
    if (!workspace) {
      throw new Error('Select or create a Workspace before installing an Agent.');
    }
    await nekiroClient.installAgent(workspace.workspaceId, {
      agentId: agent.id,
      versionConstraint,
      acceptedPermissions,
    });
    await loadInstallations(workspace.workspaceId);
  };

  const handleUpdateInstallation = async (installation: Installation, status: Exclude<InstallationStatus, 'uninstalled'>) => {
    if (!workspace) {
      return;
    }
    setInstallationError(null);
    try {
      await nekiroClient.updateInstallation(workspace.workspaceId, installation.installationId, status);
      await loadInstallations(workspace.workspaceId);
    } catch (error) {
      setInstallationError(toPlatformErrorView(error, 'Unable to update Installation.'));
    }
  };

  const handleUninstall = async (installation: Installation) => {
    if (!workspace) {
      return;
    }
    setInstallationError(null);
    try {
      await nekiroClient.uninstallAgent(workspace.workspaceId, installation.installationId);
      await loadInstallations(workspace.workspaceId);
    } catch (error) {
      setInstallationError(toPlatformErrorView(error, 'Unable to uninstall Agent.'));
    }
  };

  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'registry':
        return 'Search agent name, description, capability...';
      case 'installations':
        return 'Search installation id, agent id, pinned version...';
      case 'invocations':
        return 'Filter active Workspace invocations...';
      case 'ledger':
        return 'Read Invocation or Trace metadata...';
    }
  };

  return (
    <div className="bg-brand-bg text-brand-on-surface font-sans h-screen w-screen overflow-hidden flex select-none relative">
      <div className="mesh-bg-container">
        <div className="mesh-blob blob1" />
        <div className="mesh-blob blob2" />
        <div className="mesh-blob blob3" />
        <div className="mesh-blob blob4" />
      </div>

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
        userLabel={import.meta.env.VITE_NEKIRO_OWNER_NAME ?? import.meta.env.VITE_NEKIRO_OWNER_ID ?? ''}
        apiConfigured={Boolean(import.meta.env.VITE_NEKIRO_API_BASE_URL)}
      />

      <main className="ml-60 mt-12 w-[calc(100vw-240px)] h-[calc(100vh-48px)] overflow-y-auto bg-brand-bg p-6 relative">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'registry' && (
            <motion.div key="registry" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} transition={{duration: 0.2}} className="w-full h-full">
              <RegistryTab
                agents={agents}
                draftAgents={draftAgents}
                onRegisterAgent={handleRegisterAgent}
                onPublishAgent={handlePublishAgent}
                onDisableAgent={handleDisableAgent}
                onOpenInstall={handleOpenInstall}
                catalogLoading={catalogLoading}
                catalogError={catalogError}
                defaultOwnerId={import.meta.env.VITE_NEKIRO_OWNER_ID ?? ''}
                defaultOwnerName={import.meta.env.VITE_NEKIRO_OWNER_NAME ?? ''}
                searchQuery={searchQuery}
              />
            </motion.div>
          )}

          {activeTab === 'installations' && (
            <motion.div key="installations" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} transition={{duration: 0.2}} className="w-full h-full">
              <InstallationsTab
                workspace={workspace}
                agents={agents}
                installations={installations}
                loading={installationLoading}
                error={installationError}
                searchQuery={searchQuery}
                preselectedAgentId={pendingInstallAgentId}
                onInstallAgent={handleInstallAgent}
                onUpdateInstallation={handleUpdateInstallation}
                onUninstall={handleUninstall}
                onRefresh={() => void loadInstallations()}
              />
            </motion.div>
          )}

          {activeTab === 'invocations' && (
            <motion.div key="invocations" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} transition={{duration: 0.2}} className="w-full h-full">
              <InvocationsTab workspace={workspace} installations={installations} client={nekiroClient} />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div key="ledger" initial={{opacity: 0, y: 10}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} transition={{duration: 0.2}} className="w-full h-full">
              <LedgerTab workspace={workspace} client={nekiroClient} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {showSettings && (
        <Overlay title="Control Plane Settings" icon={<Cpu size={22} />} onClose={() => setShowSettings(false)}>
          <div className="space-y-3 text-sm text-brand-on-surface-variant">
            <p>Base URL: <span className="font-mono-code text-brand-on-surface">{import.meta.env.VITE_NEKIRO_API_BASE_URL || 'not configured'}</span></p>
            <p>Token source: <span className="font-mono-code text-brand-on-surface">VITE_NEKIRO_TOKEN</span> (never persisted in local storage)</p>
            <p>Default Workspace: <span className="font-mono-code text-brand-on-surface">{import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID || 'manual selection'}</span></p>
          </div>
        </Overlay>
      )}

      {showSupport && (
        <Overlay title="MVP Boundary" icon={<HelpCircle size={22} />} onClose={() => setShowSupport(false)}>
          <div className="space-y-3 text-sm text-brand-on-surface-variant">
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
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-brand-low border border-brand-outline-variant rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-brand-outline-variant/60">
          <div className="flex items-center gap-3 text-brand-primary">
            {icon}
            <h2 className="font-headline-md text-sm font-bold text-brand-on-surface">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-brand-high text-brand-on-surface-variant hover:text-brand-on-surface">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-3 border-t border-brand-outline-variant/40 flex items-center gap-2 text-xs text-brand-on-surface-variant">
          <ShieldAlert size={14} />
          <span>Only public Gateway routes are called from the browser.</span>
          <CheckCircle2 size={14} className="ml-auto text-green-400" />
        </div>
      </div>
    </div>
  );
}

function upsertAgent(agents: Agent[], next: Agent): Agent[] {
  return [next, ...agents.filter((agent) => agentKey(agent) !== agentKey(next))];
}

function agentKey(agent: Agent): string {
  return agent.id + '@' + agent.version;
}
