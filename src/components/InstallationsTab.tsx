import React, { useState } from 'react';
import { Cpu, Search, Plus, Filter, AlertTriangle, Trash2, X, Copy, Check, FolderOpen, Terminal, Globe, Sliders, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Installation, Agent } from '../types';
import { PERMISSIONS_DB } from '../data';

interface InstallationsTabProps {
  installations: Installation[];
  onToggleState: (id: string) => void;
  onUninstall: (id: string) => void;
  onAddInstallation: (agent: Agent) => void;
  agents: Agent[];
  searchQuery: string;
}

export default function InstallationsTab({
  installations,
  onToggleState,
  onUninstall,
  onAddInstallation,
  agents,
  searchQuery
}: InstallationsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(installations[0]?.id || null);
  const [copied, setCopied] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedInstall = installations.find((inst) => inst.id === selectedId);

  // Filter installations based on global searchQuery
  const filteredInstallations = installations.filter(inst => {
    const term = searchQuery.toLowerCase();
    if (!term) return true;
    return (
      inst.agentName.toLowerCase().includes(term) ||
      inst.id.toLowerCase().includes(term) ||
      inst.version.toLowerCase().includes(term)
    );
  });

  const handleCopyEndpoint = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstallFromAgent = (agent: Agent) => {
    onAddInstallation(agent);
    setShowAddModal(false);
    // Auto-select the newly installed agent (it's added to the end of the installations list)
    setTimeout(() => {
      // Find the last item or new ID
      if (installations.length > 0) {
        setSelectedId(installations[installations.length - 1]?.id || null);
      }
    }, 100);
  };

  return (
    <div className="flex flex-1 h-[calc(100vh-112px)] gap-4 select-none relative">
      {/* Primary Workspace: Installations List */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Page Header */}
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="font-headline-lg text-base font-bold text-brand-on-surface flex items-center gap-2">
              Active Installations
              <span className="px-2 py-0.5 rounded bg-brand-container border border-brand-outline-variant font-mono-label text-[10px] text-brand-on-surface-variant align-middle font-normal">
                {installations.length} TOTAL
              </span>
            </h2>
            <p className="text-brand-on-surface-variant text-[11px] mt-0.5 font-normal">
              Managing deployed agent instances within Workspace NK-0814.
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => alert("Telemetry stream filtered. Custom query builder is active.")}
              className="h-8 px-3 rounded border border-brand-outline-variant bg-brand-container hover:bg-brand-high text-brand-on-surface font-mono-label text-[10px] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Filter size={12} />
              <span>FILTER</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="h-8 px-4 rounded bg-brand-primary text-brand-on-primary font-mono-label text-[10px] font-bold flex items-center gap-1.5 hover:bg-brand-primary/90 transition-all cursor-pointer shadow-[0_0_10px_rgba(77,142,255,0.2)]"
            >
              <Plus size={12} />
              <span>NEW INSTALLATION</span>
            </button>
          </div>
        </div>

        {/* Ledger/Table Container */}
        <div className="bg-brand-low border border-brand-outline-variant rounded flex-1 flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[2fr_1.2fr_2fr_1.2fr_1.2fr_auto] gap-4 px-4 py-2 border-b border-brand-outline-variant bg-brand-container/50 font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
            <div>Agent Reference</div>
            <div>Version</div>
            <div>Accepted Permissions</div>
            <div>Installed</div>
            <div>State</div>
            <div className="w-8"></div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-brand-outline-variant/30">
            {filteredInstallations.map((inst) => {
              const isSelected = inst.id === selectedId;
              const isFaulted = inst.state === 'FAULTED';
              
              return (
                <div
                  key={inst.id}
                  onClick={() => setSelectedId(inst.id)}
                  className={`grid grid-cols-[2fr_1.2fr_2fr_1.2fr_1.2fr_auto] gap-4 px-4 py-3 items-center hover:bg-brand-container/40 cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-brand-secondary-container/15 border-l-2 border-l-brand-primary' 
                      : 'border-l-2 border-l-transparent'
                  } ${isFaulted ? 'bg-red-950/10 border-b border-brand-error/20' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border flex items-center justify-center text-xs ${
                      isFaulted 
                        ? 'bg-brand-error-container/20 border-brand-error/30 text-brand-error' 
                        : 'bg-brand-container border-brand-outline-variant text-brand-on-surface'
                    }`}>
                      <Terminal size={12} />
                    </div>
                    <div className="truncate">
                      <div className={`font-mono-code text-[12px] font-medium truncate ${isFaulted ? 'text-brand-error font-semibold' : 'text-brand-on-surface'}`}>
                        {inst.agentName}
                      </div>
                      <div className="font-mono-label text-[9px] text-brand-on-surface-variant mt-0.5 truncate">
                        ID: {inst.id}
                      </div>
                    </div>
                  </div>

                  <div className="font-mono-code text-[11px] text-brand-on-surface-variant">
                    {inst.version}
                  </div>

                  {/* Accepted Permissions Chips */}
                  <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                    {inst.acceptedPermissions.slice(0, 2).map((perm) => {
                      const isHigh = PERMISSIONS_DB[perm]?.highRisk;
                      return (
                        <span
                          key={perm}
                          className={`px-1.5 py-0.5 rounded-sm font-mono-label text-[8px] border truncate ${
                            isHigh 
                              ? 'border-brand-error/30 bg-brand-error-container/10 text-brand-error flex items-center gap-0.5' 
                              : 'border-brand-outline-variant bg-brand-container text-brand-secondary'
                          }`}
                        >
                          {isHigh && <span className="w-1 h-1 rounded-full bg-brand-error inline-block" />}
                          {perm}
                        </span>
                      );
                    })}
                    {inst.acceptedPermissions.length > 2 && (
                      <span className="px-1.5 py-0.5 rounded-sm border border-brand-outline-variant bg-brand-container font-mono-label text-[8px] text-brand-on-surface-variant">
                        +{inst.acceptedPermissions.length - 2}
                      </span>
                    )}
                  </div>

                  <div className="font-mono-code text-[11px] text-brand-on-surface-variant">
                    {inst.installedDate}
                  </div>

                  {/* State Indicators */}
                  <div>
                    {inst.state === 'ENABLED' && (
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                        </span>
                        <span className="font-mono-label text-[10px] text-brand-primary font-semibold">ENABLED</span>
                      </div>
                    )}
                    {inst.state === 'DISABLED' && (
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-brand-outline"></span>
                        <span className="font-mono-label text-[10px] text-brand-on-surface-variant">DISABLED</span>
                      </div>
                    )}
                    {inst.state === 'FAULTED' && (
                      <div className="flex items-center gap-1.5 text-brand-error">
                        <AlertTriangle size={12} className="text-brand-error animate-pulse" />
                        <span className="font-mono-label text-[10px] text-brand-error font-semibold">FAULTED</span>
                      </div>
                    )}
                  </div>

                  {/* Context menu mock button */}
                  <div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(`Action menu for ${inst.agentName}. Selected State: ${inst.state}`);
                      }}
                      className="text-brand-on-surface-variant hover:text-brand-on-surface p-1 rounded hover:bg-brand-high transition-colors"
                    >
                      <Plus size={14} className="rotate-45" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Footer / Pagination */}
          <div className="px-4 py-2 border-t border-brand-outline-variant bg-brand-container/50 flex justify-between items-center">
            <span className="font-mono-label text-[10px] text-brand-on-surface-variant">
              Showing 1-{filteredInstallations.length} of {filteredInstallations.length}
            </span>
            <div className="flex gap-1">
              <button disabled className="p-1 rounded border border-brand-outline-variant bg-brand-container text-brand-on-surface-variant hover:text-brand-on-surface disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button disabled className="p-1 rounded border border-brand-outline-variant bg-brand-container text-brand-on-surface-variant hover:text-brand-on-surface disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side Inspector Panel (Detail View) */}
      {selectedInstall ? (
        <aside 
          id="inspector-panel"
          className="w-96 bg-brand-low border border-brand-outline-variant rounded flex flex-col h-full overflow-hidden transition-all duration-300"
        >
          {/* Inspector Header */}
          <div className="p-4 border-b border-brand-outline-variant bg-brand-container/50 flex justify-between items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded bg-brand-primary/10 border border-brand-primary/30 flex items-center justify-center text-brand-primary">
                  <Cpu size={12} />
                </div>
                <h3 className="font-mono-code text-[12px] text-brand-on-surface font-bold truncate">
                  {selectedInstall.agentName}
                </h3>
              </div>
              <p className="font-mono-label text-[10px] text-brand-on-surface-variant">
                ID: {selectedInstall.id}
              </p>
            </div>
            <button 
              onClick={() => setSelectedId(null)}
              className="text-brand-on-surface-variant hover:text-brand-on-surface p-1 rounded hover:bg-brand-high transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Inspector Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Status & Toggle Control Block */}
            <div className="flex justify-between items-center p-3 rounded border border-brand-outline-variant bg-brand-container">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onToggleState(selectedInstall.id)}
                  className={`w-8 h-4 rounded-full relative border transition-colors ${
                    selectedInstall.state === 'ENABLED'
                      ? 'bg-brand-primary/30 border-brand-primary'
                      : 'bg-brand-outline-variant/30 border-brand-outline-variant'
                  }`}
                >
                  <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${
                    selectedInstall.state === 'ENABLED'
                      ? 'bg-brand-primary right-0.5'
                      : 'bg-brand-on-surface-variant left-0.5'
                  }`} />
                </button>
                <span className="font-mono-label text-[10px] text-brand-on-surface font-bold">
                  RUNTIME {selectedInstall.state === 'ENABLED' ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              
              <button
                onClick={() => {
                  if (confirm(`Uninstall installer '${selectedInstall.agentName}' permanently?`)) {
                    onUninstall(selectedInstall.id);
                    setSelectedId(null);
                  }
                }}
                className="text-brand-error border border-brand-error/30 bg-brand-error-container/10 hover:bg-brand-error-container/25 px-2 py-1 rounded font-mono-label text-[9px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={12} />
                <span>UNINSTALL</span>
              </button>
            </div>

            {/* Metadata Grid */}
            <div>
              <h4 className="font-label-caps text-[10px] text-brand-on-surface-variant uppercase mb-2">
                Installation Metadata
              </h4>
              <div className="grid grid-cols-2 gap-px bg-brand-outline-variant border border-brand-outline-variant rounded overflow-hidden">
                <div className="bg-brand-container p-2.5">
                  <div className="font-label-caps text-[8px] text-brand-on-surface-variant mb-1">VERSION</div>
                  <div className="font-mono-code text-[11px] text-brand-on-surface font-semibold">
                    {selectedInstall.version}
                  </div>
                </div>
                <div className="bg-brand-container p-2.5">
                  <div className="font-label-caps text-[8px] text-brand-on-surface-variant mb-1">INSTALLED BY</div>
                  <div className="font-mono-code text-[11px] text-brand-on-surface">
                    {selectedInstall.installedBy}
                  </div>
                </div>
                <div className="bg-brand-container p-2.5 col-span-2 flex justify-between items-center">
                  <div>
                    <div className="font-label-caps text-[8px] text-brand-on-surface-variant mb-1">WORKSPACE ENDPOINT</div>
                    <div className="font-mono-code text-[11px] text-brand-primary truncate max-w-[210px]">
                      {selectedInstall.endpoint}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleCopyEndpoint(selectedInstall.endpoint)}
                    className="text-brand-on-surface-variant hover:text-brand-on-surface p-1 rounded hover:bg-brand-high transition-all"
                  >
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Granted Permissions Tree */}
            <div>
              <h4 className="font-label-caps text-[10px] text-brand-on-surface-variant uppercase mb-2 flex justify-between items-center">
                <span>Granted Permissions</span>
                {selectedInstall.acceptedPermissions.some(p => PERMISSIONS_DB[p]?.highRisk) && (
                  <span className="text-brand-error flex items-center gap-1 text-[9px]">
                    <AlertTriangle size={11} className="text-brand-error animate-pulse" />
                    Review Required
                  </span>
                )}
              </h4>
              <div className="border border-brand-outline-variant rounded bg-brand-container overflow-hidden divide-y divide-brand-outline-variant/40">
                {selectedInstall.acceptedPermissions.map((perm) => {
                  const permMeta = PERMISSIONS_DB[perm];
                  const isHigh = permMeta?.highRisk;
                  
                  return (
                    <div 
                      key={perm} 
                      className={`p-2.5 flex items-start gap-2.5 transition-colors ${
                        isHigh ? 'bg-brand-error-container/5 border-l-2 border-l-brand-error' : ''
                      }`}
                    >
                      <div className={`mt-0.5 text-xs ${isHigh ? 'text-brand-error' : 'text-brand-secondary'}`}>
                        {isHigh ? <Globe size={13} /> : <FolderOpen size={13} />}
                      </div>
                      <div className="min-w-0">
                        <div className={`font-mono-code text-[11px] font-bold ${isHigh ? 'text-brand-error' : 'text-brand-on-surface'}`}>
                          {perm}
                        </div>
                        <div className={`font-mono-label text-[9px] mt-0.5 ${isHigh ? 'text-brand-error/70' : 'text-brand-on-surface-variant'}`}>
                          Scope: {permMeta?.scope || '*'}
                        </div>
                        <p className="text-[10px] text-brand-on-surface-variant/80 mt-1 font-body-sm leading-normal">
                          {permMeta?.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Inspector Footer Action */}
          <div className="p-4 border-t border-brand-outline-variant bg-brand-container/50">
            <button 
              onClick={() => alert(`Opening configuration settings dashboard for ${selectedInstall.agentName}...`)}
              className="w-full h-8 rounded border border-brand-outline-variant bg-brand-surface hover:bg-brand-high text-brand-on-surface font-mono-label text-[10px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders size={12} />
              <span>CONFIGURE INSTALLATION</span>
            </button>
          </div>
        </aside>
      ) : (
        <aside className="w-96 border border-dashed border-brand-outline-variant bg-brand-lowest rounded flex flex-col items-center justify-center p-6 text-center text-brand-on-surface-variant text-xs font-mono-label">
          <Settings size={24} className="mb-2 text-brand-outline animate-spin-slow" />
          <span>Select an installation to inspect its live container constraints and credentials tree.</span>
        </aside>
      )}

      {/* New Installation Dialog/Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-brand-lowest/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-brand-container border border-brand-outline-variant rounded shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 bg-brand-low border-b border-brand-outline-variant flex justify-between items-center">
              <div>
                <h3 className="font-headline-md text-sm font-bold text-brand-on-surface flex items-center gap-2">
                  <Plus size={16} className="text-brand-primary" />
                  New Instance Deployment
                </h3>
                <p className="text-[10px] text-brand-on-surface-variant mt-0.5 font-normal">
                  Deploy a registered agent archetype onto local Workspace.
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-brand-on-surface-variant hover:text-brand-on-surface p-1 rounded hover:bg-brand-high"
              >
                <X size={16} />
              </button>
            </div>

            {/* List of deployable archetypes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs text-brand-on-surface-variant leading-relaxed">
                Select an agent from the Registry. Installing creates a localized, sandboxed orchestrator container instance ready for workspace invocations.
              </p>
              
              <div className="space-y-2">
                {agents.map((agent) => {
                  const alreadyInstalled = installations.some(i => i.agentId === agent.id);
                  return (
                    <div 
                      key={agent.id}
                      className="border border-brand-outline-variant/60 rounded bg-brand-lowest p-3 flex justify-between items-center hover:border-brand-primary/50 transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-code text-xs text-brand-on-surface font-semibold truncate">
                            {agent.name}
                          </span>
                          <span className="text-[9px] bg-brand-container text-brand-on-surface-variant px-1.5 py-0.5 rounded border border-brand-outline-variant/40">
                            {agent.version}
                          </span>
                        </div>
                        <p className="text-[10px] text-brand-on-surface-variant truncate mt-1">
                          {agent.description}
                        </p>
                      </div>

                      <button
                        onClick={() => handleInstallFromAgent(agent)}
                        className={`h-7 px-3 text-[10px] font-mono-label font-bold rounded cursor-pointer transition-all ${
                          alreadyInstalled
                            ? 'border border-brand-outline-variant text-brand-on-surface-variant hover:bg-brand-container'
                            : 'bg-brand-primary text-brand-on-primary hover:bg-brand-primary/95 shadow-md'
                        }`}
                      >
                        {alreadyInstalled ? 'INSTALL AGAIN' : 'DEPLOY'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
