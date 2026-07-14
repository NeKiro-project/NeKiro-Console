import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import RegistryTab from './components/RegistryTab';
import InstallationsTab from './components/InstallationsTab';
import InvocationsTab from './components/InvocationsTab';
import LedgerTab from './components/LedgerTab';

import { INITIAL_INSTALLATIONS } from './data';
import { NekiroApiClient, mapCatalogEntry, type AgentCardV02 } from './api/nekiro';
import { Agent, Installation } from './types';
import { X, ShieldAlert, Cpu, CheckCircle2, HelpCircle } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'registry' | 'installations' | 'invocations' | 'ledger'>('registry');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dynamic App states shared between tabs for live flow!
  const [agents, setAgents] = useState<Agent[]>([]);
  const [installations, setInstallations] = useState<Installation[]>(INITIAL_INSTALLATIONS);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const nekiroClient = useMemo(
    () => new NekiroApiClient({
      baseUrl: import.meta.env.VITE_NEKIRO_API_BASE_URL ?? '',
      token: import.meta.env.VITE_NEKIRO_TOKEN ?? '',
    }),
    [],
  );

  // Modal dialog states
  const [showSettings, setShowSettings] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  // Settings customizable metrics
  const [scanInterval, setScanInterval] = useState('500ms');
  const [enableTelemetry, setEnableTelemetry] = useState(true);
  const [secureSandbox, setSecureSandbox] = useState(true);

  // Synchronize search placeholders
  const getSearchPlaceholder = () => {
    switch (activeTab) {
      case 'registry':
        return 'Search registered agent archetypes, tags, owners...';
      case 'installations':
        return 'Search active containers, endpoints, versions...';
      case 'invocations':
        return 'Search capability tasks, query types...';
      case 'ledger':
        return 'Search active transaction IDs, traces...';
    }
  };

  const loadAgents = useCallback(async (query = '') => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const response = await nekiroClient.searchAgents(query.trim() ? {query: query.trim()} : undefined);
      setAgents(response.items.map(mapCatalogEntry));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load the NeKiro Catalog.';
      console.error('[CATALOG] Failed to load agents:', error);
      setCatalogError(message);
    } finally {
      setCatalogLoading(false);
    }
  }, [nekiroClient]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAgents(searchQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadAgents, searchQuery]);

  const handleRegisterAgent = async (card: AgentCardV02) => {
    await nekiroClient.registerAgent(card);
    await loadAgents(searchQuery);
  };

  const getCatalogVersion = (agent: Agent) => agent.version.replace(/^v/, '');

  const handlePublishAgent = async (agent: Agent) => {
    await nekiroClient.publishAgentVersion(agent.id, getCatalogVersion(agent));
    await loadAgents(searchQuery);
  };

  const handleDisableAgent = async (agent: Agent) => {
    await nekiroClient.disableAgentVersion(agent.id, getCatalogVersion(agent));
    await loadAgents(searchQuery);
  };

  // 2. Core Handlers: Toggle container instance enabled/disabled state
  const handleToggleState = (id: string) => {
    setInstallations((prev) =>
      prev.map((inst) => {
        if (inst.id === id) {
          const nextState = inst.state === 'ENABLED' ? 'DISABLED' : 'ENABLED';
          console.log(`[CONTAINER_DAEMON] Instance state shifted: ${inst.id} -> ${nextState}`);
          return { ...inst, state: nextState };
        }
        return inst;
      })
    );
  };

  // 3. Core Handlers: Uninstall a container instance permanently
  const handleUninstall = (id: string) => {
    setInstallations((prev) => prev.filter((inst) => inst.id !== id));
    console.log(`[CONTAINER_DAEMON] Sandbox partition unallocated: ${id}`);
  };

  // 4. Core Handlers: Deploy a registered agent onto the Installations list
  const handleAddInstallation = (agent: Agent) => {
    const mockId = `inst-${agent.id.slice(0, 4).toLowerCase()}-${Math.random().toString(36).substring(2, 6)}`;
    const newInst: Installation = {
      id: mockId,
      agentId: agent.id,
      agentName: `${agent.name}_instance_v${installations.length + 1}`,
      version: agent.version === 'v0.1.0-draft' ? '0.1.0-beta' : agent.version.replace('v', '') + '-local',
      acceptedPermissions: agent.id === 'DataSynthesizer_Alpha' 
        ? ['READ_S3', 'EXEC_LAMBDA', 'NET_EGRESS_HTTP', 'WRITE_LOGS']
        : agent.id === 'AuthGateway_Node'
        ? ['NET_OUT']
        : ['READ_REPO', 'WRITE_PR'],
      installedDate: new Date().toISOString().split('T')[0],
      state: 'ENABLED',
      endpoint: `ws://nk-0814.internal/${mockId.split('-')[1]}`,
      installedBy: 'sys-admin'
    };

    setInstallations((prev) => [...prev, newInst]);
    console.log(`[LEDGER_SYS] Instance deployed successfully: ${newInst.id}`);
  };

  return (
    <div className="bg-brand-bg text-brand-on-surface font-sans h-screen w-screen overflow-hidden flex select-none relative">
      {/* Animated Flowing Mesh Blobs */}
      <div className="mesh-bg-container">
        <div className="mesh-blob blob1"></div>
        <div className="mesh-blob blob2"></div>
        <div className="mesh-blob blob3"></div>
        <div className="mesh-blob blob4"></div>
      </div>

      {/* 1. Left Sidebar Navigation Panel */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSearchQuery(''); // reset search queries
        }} 
        onOpenSettings={() => setShowSettings(true)}
        onOpenSupport={() => setShowSupport(true)}
      />

      {/* 2. Top Navigation & Action Controls Bar */}
      <Header 
        searchQuery={searchQuery} 
        setSearchQuery={setSearchQuery} 
        searchPlaceholder={getSearchPlaceholder()}
      />

      {/* 3. Main Fluid Workspace View */}
      <main className="ml-60 mt-12 w-[calc(100vw-240px)] h-[calc(100vh-48px)] overflow-y-auto bg-brand-bg p-6 relative">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'registry' && (
            <motion.div
              key="registry"
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-full h-full"
            >
              <RegistryTab 
                agents={agents} 
                onRegisterAgent={handleRegisterAgent} 
                onPublishAgent={handlePublishAgent}
                onDisableAgent={handleDisableAgent}
                catalogLoading={catalogLoading}
                catalogError={catalogError}
                defaultOwnerId={import.meta.env.VITE_NEKIRO_OWNER_ID ?? ''}
                defaultOwnerName={import.meta.env.VITE_NEKIRO_OWNER_NAME ?? ''}
                searchQuery={searchQuery}
              />
            </motion.div>
          )}

          {activeTab === 'installations' && (
            <motion.div
              key="installations"
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-full h-full"
            >
              <InstallationsTab 
                installations={installations} 
                onToggleState={handleToggleState} 
                onUninstall={handleUninstall} 
                onAddInstallation={handleAddInstallation}
                agents={agents}
                searchQuery={searchQuery}
              />
            </motion.div>
          )}

          {activeTab === 'invocations' && (
            <motion.div
              key="invocations"
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-full h-full"
            >
              <InvocationsTab 
                installations={installations}
              />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-full h-full"
            >
              <LedgerTab />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Settings Modal Drawer */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-brand-lowest/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-brand-container border border-brand-outline-variant rounded shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-brand-low border-b border-brand-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-sm font-bold text-brand-on-surface flex items-center gap-2">
                <Cpu size={16} className="text-brand-primary" />
                Infrastructure Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-brand-on-surface-variant hover:text-brand-on-surface">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                  TELEMETRY REFRESH INTERVAL
                </label>
                <select 
                  value={scanInterval}
                  onChange={(e) => setScanInterval(e.target.value)}
                  className="bg-brand-lowest border border-brand-outline-variant rounded text-brand-on-surface text-xs h-8 px-2.5 font-mono-code cursor-pointer outline-none focus:border-brand-primary"
                >
                  <option value="250ms">250ms (Real-time Turbo)</option>
                  <option value="500ms">500ms (Standard Sync)</option>
                  <option value="1000ms">1000ms (Low Bandwidth)</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-brand-outline-variant/30 pt-4">
                <div>
                  <span className="font-mono-code text-xs text-brand-on-surface font-semibold block">Enable Ledger Telemetry Logs</span>
                  <span className="text-[10px] text-brand-on-surface-variant">Stream active execution traces to timeline ledger.</span>
                </div>
                <button
                  onClick={() => setEnableTelemetry(!enableTelemetry)}
                  className={`w-8 h-4 rounded-full relative border transition-colors cursor-pointer ${
                    enableTelemetry ? 'bg-brand-primary/20 border-brand-primary' : 'bg-brand-outline-variant/20 border-brand-outline-variant'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full absolute top-0.5 transition-all ${
                    enableTelemetry ? 'bg-brand-primary right-0.5' : 'bg-brand-outline-variant left-0.5'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-brand-outline-variant/30 pt-4">
                <div>
                  <span className="font-mono-code text-xs text-brand-on-surface font-semibold block">Secure Core Sandbox Mode</span>
                  <span className="text-[10px] text-brand-on-surface-variant">Enable strict RBAC checks on unauthenticated network gates.</span>
                </div>
                <button
                  onClick={() => setSecureSandbox(!secureSandbox)}
                  className={`w-8 h-4 rounded-full relative border transition-colors cursor-pointer ${
                    secureSandbox ? 'bg-brand-primary/20 border-brand-primary' : 'bg-brand-outline-variant/20 border-brand-outline-variant'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full absolute top-0.5 transition-all ${
                    secureSandbox ? 'bg-brand-primary right-0.5' : 'bg-brand-outline-variant left-0.5'
                  }`} />
                </button>
              </div>
            </div>
            <div className="p-4 bg-brand-lowest border-t border-brand-outline-variant flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="h-8 px-5 bg-brand-primary text-brand-on-primary font-mono-label text-[10px] font-bold rounded hover:bg-brand-primary/90 transition-colors shadow-lg cursor-pointer"
              >
                APPLY CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Support Modal FAQ */}
      {showSupport && (
        <div className="fixed inset-0 z-50 bg-brand-lowest/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-brand-container border border-brand-outline-variant rounded shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-brand-low border-b border-brand-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-sm font-bold text-brand-on-surface flex items-center gap-2">
                <HelpCircle size={16} className="text-brand-primary" />
                NeKiro Console - Support & Core FAQ
              </h3>
              <button onClick={() => setShowSupport(false)} className="text-brand-on-surface-variant hover:text-brand-on-surface">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-brand-on-surface font-mono-code">Q: What is the NeKiro Phase 1 Console?</h4>
                <p className="text-[11px] text-brand-on-surface-variant leading-relaxed">
                  NeKiro Phase 1 is a cloud-native substrate orchestrator built for high-stakes telemetry monitoring, sandbox containers execution, and consensus blockchain traces ledger.
                </p>
              </div>

              <div className="space-y-1 border-t border-brand-outline-variant/30 pt-3">
                <h4 className="text-xs font-bold text-brand-on-surface font-mono-code">Q: How do I test the Invocation Workbench?</h4>
                <p className="text-[11px] text-brand-on-surface-variant leading-relaxed">
                  Head over to the <span className="text-brand-primary font-semibold">Invocations</span> tab, select an enabled agent, customize metric types or start/end bounds, and click <span className="text-brand-primary font-semibold">Invoke</span>. The live telemetry streams, payloads, and execution channels will render incrementally. Try typing &quot;error&quot; in the Metric Type to trigger a simulated exception.
                </p>
              </div>

              <div className="space-y-1 border-t border-brand-outline-brand/30 pt-3">
                <h4 className="text-xs font-bold text-brand-on-surface font-mono-code">Q: How do I deploy new agents?</h4>
                <p className="text-[11px] text-brand-on-surface-variant leading-relaxed">
                  Use the <span className="text-brand-primary font-semibold">Registry</span> tab, click &quot;Agent Card Registration&quot;, fill the capabilities workbench parameters, valid JSON schema, and complete registration. Then go to <span className="text-brand-primary font-semibold">Installations</span>, click &quot;New Installation&quot;, select your registered agent, and deploy immediately!
                </p>
              </div>
            </div>
            <div className="p-4 bg-brand-lowest border-t border-brand-outline-variant flex justify-end">
              <button 
                onClick={() => setShowSupport(false)}
                className="h-8 px-5 rounded bg-brand-primary text-brand-on-primary font-mono-label text-[10px] font-bold hover:bg-brand-primary/90 transition-colors cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
