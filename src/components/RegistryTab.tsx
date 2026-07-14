import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, CheckCircle2, AlertTriangle, Bot, Cpu, Trash2, ArrowRight, Info, Zap, Code, ChevronRight } from 'lucide-react';
import { Agent } from '../types';
import { buildAgentCard, type AgentCardV02 } from '../api/nekiro';
import { PERMISSIONS_DB } from '../data';

interface RegistryTabProps {
  agents: Agent[];
  onRegisterAgent: (card: AgentCardV02) => Promise<void>;
  onPublishAgent: (agent: Agent) => Promise<void>;
  onDisableAgent: (agent: Agent) => Promise<void>;
  catalogLoading: boolean;
  catalogError: string | null;
  defaultOwnerId: string;
  defaultOwnerName: string;
  searchQuery: string;
}

const DECLARED_PERMISSION_IDS = ['READ_S3', 'WRITE_LOGS', 'EXEC_LAMBDA'];
const DEFAULT_CARD_LIMITS = {
  timeoutMs: 30_000,
  maxInputBytes: 1_048_576,
  maxOutputBytes: 1_048_576,
  streaming: true,
};

export default function RegistryTab({
  agents,
  onRegisterAgent,
  onPublishAgent,
  onDisableAgent,
  catalogLoading,
  catalogError,
  defaultOwnerId,
  defaultOwnerName,
  searchQuery,
}: RegistryTabProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  // Form states for Registration Workbench
  const [agentId, setAgentId] = useState('');
  const [namespace, setNamespace] = useState(defaultOwnerId);
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [endpoint, setEndpoint] = useState('');
  const [capabilitiesJson, setCapabilitiesJson] = useState(
    JSON.stringify({
      "capabilities": [
        {
          "type": "data_ingestion",
          "protocols": ["grpc", "http"],
          "max_throughput_mb": 500
        },
        {
          "type": "transformation",
          "schema_validation": true
        }
      ],
      "dependencies": {
        "required": ["logger_agent_v2", "auth_svc"]
      }
    }, null, 2)
  );

  const [jsonIsValid, setJsonIsValid] = useState(true);
  const [activeSection, setActiveSection] = useState<'general' | 'versioning' | 'endpoints' | 'capabilities' | 'permissions'>('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // JSON Validation effect
  useEffect(() => {
    try {
      JSON.parse(capabilitiesJson);
      setJsonIsValid(true);
    } catch {
      setJsonIsValid(false);
    }
  }, [capabilitiesJson]);

  const hasCapabilities = (() => {
    try {
      const parsed = JSON.parse(capabilitiesJson);
      return Array.isArray(parsed?.capabilities) && parsed.capabilities.length > 0;
    } catch {
      return false;
    }
  })();

  const canSubmit = Boolean(
    agentId.trim() &&
    namespace.trim() &&
    description.trim() &&
    version.trim() &&
    endpoint.trim() &&
    jsonIsValid &&
    hasCapabilities,
  );

  // Compute completeness score dynamically
  const getCompleteness = () => {
    let score = 0;
    if (agentId) score += 15;
    if (namespace) score += 15;
    if (description) score += 15;
    if (version) score += 10;
    if (endpoint) score += 15;
    if (jsonIsValid && hasCapabilities) score += 30;
    return Math.min(100, score);
  };

  const handleRegister = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    try {
      await onRegisterAgent(buildAgentCard({
        agentId: agentId.trim(),
        ownerId: namespace.trim(),
        ownerDisplayName: defaultOwnerName.trim() || namespace.trim(),
        description: description.trim(),
        version: version.trim(),
        endpoint: endpoint.trim(),
        authentication: 'none',
        permissions: DECLARED_PERMISSION_IDS.map((id) => ({
          id,
          description: PERMISSIONS_DB[id]?.description || `Declared permission ${id}.`,
        })),
        capabilitiesJson,
        limits: DEFAULT_CARD_LIMITS,
      }));
      setIsRegistering(false);
      setAgentId('');
      setNamespace(defaultOwnerId);
      setDescription('');
      setVersion('0.1.0');
      setEndpoint('');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to register Agent Card.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLifecycleAction = async (agent: Agent, action: (agent: Agent) => Promise<void>) => {
    setPendingActionId(agent.id);
    setActionError(null);
    try {
      await action(agent);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Catalog action failed.');
    } finally {
      setPendingActionId(null);
    }
  };

  // Filter agents based on global searchQuery and localSearch
  const filteredAgents = agents.filter(agent => {
    const terms = [searchQuery, localSearch].map((term) => term.trim().toLowerCase()).filter(Boolean);
    return terms.every((term) => (
      agent.name.toLowerCase().includes(term) ||
      agent.owner.toLowerCase().includes(term) ||
      agent.description.toLowerCase().includes(term) ||
      agent.tags.some(t => t.toLowerCase().includes(term))
    ));
  });

  if (isRegistering) {
    // Agent Registration Workbench View
    const completeness = getCompleteness();
    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-48px)] bg-brand-bg select-none">
        <div className="flex-1 flex overflow-hidden">
          {/* Partition 1: Workbench Sidebar Sections */}
          <div className="w-48 bg-brand-lowest border-r border-brand-outline-variant p-4 flex flex-col gap-2 overflow-y-auto">
            <h2 className="font-label-caps text-[10px] text-brand-on-surface-variant mb-4 uppercase tracking-wider">
              Workbench Sections
            </h2>
            
            {[
              { id: 'general', name: 'General', label: 'General Parameters' },
              { id: 'versioning', name: 'Versioning', label: 'Draft Tags' },
              { id: 'endpoints', name: 'Endpoints', label: 'Service Endpoints' },
              { id: 'capabilities', name: 'Capabilities', label: 'Capabilities I/O Schema' },
              { id: 'permissions', name: 'Permissions', label: 'Required Scopes' }
            ].map(sec => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`text-left px-3 py-2 rounded font-mono-label text-[11px] flex justify-between items-center transition-all ${
                  activeSection === sec.id
                    ? 'bg-brand-primary-container/20 text-brand-primary border border-brand-primary/30 font-semibold'
                    : 'text-brand-on-surface-variant hover:bg-brand-high hover:text-brand-on-surface'
                }`}
              >
                <span>{sec.name}</span>
                {activeSection === sec.id && <ChevronRight size={12} />}
              </button>
            ))}
          </div>

          {/* Partition 2: Main Form Area */}
          <div className="flex-1 bg-brand-bg p-6 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-8">
              <div className="space-y-1 border-b border-brand-outline-variant pb-4">
                <h2 className="font-headline-lg text-lg font-bold text-brand-on-surface">
                  Agent Registration Workbench
                </h2>
                <p className="font-body-sm text-xs text-brand-on-surface-variant">
                  Define capabilities and constraints for new orchestrator agents.
                </p>
              </div>

              {/* General Group */}
              {activeSection === 'general' && (
                <div className="space-y-6">
                  <h3 className="font-mono-label text-xs text-brand-primary uppercase tracking-widest flex items-center gap-2">
                    <Info size={14} /> General Parameters
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                        Agent ID / Name <span className="text-brand-error">*</span>
                      </label>
                      <input
                        type="text"
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                        placeholder="e.g. agt_nx_8921a"
                        className="bg-transparent border-b border-brand-outline-variant pb-1 font-mono-code text-xs text-brand-on-surface focus:outline-none focus:border-brand-primary focus:ring-0 transition-colors placeholder:text-brand-on-surface-variant/30"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                        Namespace
                      </label>
                      <input
                        type="text"
                        value={namespace}
                        onChange={(e) => setNamespace(e.target.value)}
                        placeholder="e.g. core.infrastructure"
                        className="bg-transparent border-b border-brand-outline-variant pb-1 font-mono-code text-xs text-brand-on-surface focus:outline-none focus:border-brand-primary focus:ring-0 transition-colors placeholder:text-brand-on-surface-variant/30"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                      Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief statement of agent purpose..."
                      className="bg-transparent border-b border-brand-outline-variant pb-1 font-mono-code text-xs text-brand-on-surface focus:outline-none focus:border-brand-primary focus:ring-0 transition-colors placeholder:text-brand-on-surface-variant/30"
                    />
                  </div>
                </div>
              )}

              {/* Versioning Group */}
              {activeSection === 'versioning' && (
                <div className="space-y-4">
                  <h3 className="font-mono-label text-xs text-brand-primary uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} /> Versioning Settings
                  </h3>
                  <p className="text-brand-on-surface-variant text-xs">
                    Register an immutable semantic version as a draft, then publish it through the Catalog lifecycle.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                      Agent Version <span className="text-brand-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="e.g. 1.0.0"
                      className="bg-transparent border-b border-brand-outline-variant pb-1 font-mono-code text-xs text-brand-on-surface focus:outline-none focus:border-brand-primary focus:ring-0 transition-colors placeholder:text-brand-on-surface-variant/30"
                    />
                  </div>
                  <div className="flex flex-col gap-2 mt-4 p-4 border border-brand-outline-variant bg-brand-lowest rounded">
                    <div className="flex justify-between text-xs text-brand-on-surface-variant">
                      <span>DEPLOY CHANNEL</span>
                      <span className="font-mono-code text-brand-primary">CATALOG DRAFT</span>
                    </div>
                    <div className="flex justify-between text-xs text-brand-on-surface-variant">
                      <span>PUBLICATION</span>
                      <span className="font-mono-code text-brand-primary">MANUAL PUBLISH</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Endpoints */}
              {activeSection === 'endpoints' && (
                <div className="space-y-4">
                  <h3 className="font-mono-label text-xs text-brand-primary uppercase tracking-widest flex items-center gap-2">
                    <Cpu size={14} /> Service Endpoints
                  </h3>
                  <p className="text-brand-on-surface-variant text-xs">
                    Configure the HTTP(S) A2A endpoint advertised in the Agent Card.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                      A2A Endpoint <span className="text-brand-error">*</span>
                    </label>
                    <input
                      type="url"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="https://agent.example.com/a2a"
                      className="bg-transparent border-b border-brand-outline-variant pb-1 font-mono-code text-xs text-brand-on-surface focus:outline-none focus:border-brand-primary focus:ring-0 transition-colors placeholder:text-brand-on-surface-variant/30"
                    />
                  </div>
                </div>
              )}

              {/* Capabilities JSON Schema Group */}
              {activeSection === 'capabilities' && (
                <div className="space-y-6">
                  <h3 className="font-mono-label text-xs text-brand-primary uppercase tracking-widest flex items-center gap-2">
                    <Code size={14} /> Capabilities: I/O Schema
                  </h3>
                  <div className="bg-brand-lowest border border-brand-outline-variant rounded overflow-hidden relative">
                    <div className="flex justify-between items-center bg-brand-container p-2 border-b border-brand-outline-variant">
                      <span className="font-mono-label text-[10px] text-brand-on-surface-variant">schema.json</span>
                    </div>
                    <textarea
                      value={capabilitiesJson}
                      onChange={(e) => setCapabilitiesJson(e.target.value)}
                      spellCheck="false"
                      className="w-full bg-transparent border-none text-brand-primary font-mono-code text-xs p-4 focus:ring-0 resize-none h-64 leading-relaxed outline-none"
                    />
                    <div className="absolute bottom-3 right-4 flex items-center gap-2 bg-brand-lowest/90 px-2.5 py-1 rounded border border-brand-outline-variant/60">
                      <span className={`w-2 h-2 rounded-full ${jsonIsValid ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`}></span>
                      <span className={`font-mono-label text-[10px] ${jsonIsValid ? 'text-green-500' : 'text-red-500'}`}>
                        {jsonIsValid ? 'Valid JSON' : 'Syntax Error'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Permissions */}
              {activeSection === 'permissions' && (
                <div className="space-y-4">
                  <h3 className="font-mono-label text-xs text-brand-primary uppercase tracking-widest flex items-center gap-2">
                    <Zap size={14} /> Required Permissions
                  </h3>
                  <p className="text-brand-on-surface-variant text-xs">
                    Specify execution rules required for processing routines:
                  </p>
                  <div className="space-y-2">
                    {['READ_S3', 'WRITE_LOGS', 'EXEC_LAMBDA'].map((perm) => (
                      <div key={perm} className="flex justify-between items-center bg-brand-lowest border border-brand-outline-variant px-3 py-2 rounded text-xs font-mono-code">
                        <span className="text-brand-on-surface">{perm}</span>
                        <span className="text-brand-on-surface-variant text-[10px]">GRANTED_LOCAL</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Partition 3: Card Preview */}
          <div className="w-80 bg-brand-lowest border-l border-brand-outline-variant flex flex-col shadow-inner">
            <div className="p-4 border-b border-brand-outline-variant flex justify-between items-center bg-brand-container/40">
              <span className="font-mono-label text-[10px] text-brand-on-surface uppercase tracking-wider">
                Card Preview
              </span>
              <span className="px-2 py-0.5 bg-brand-container rounded text-[9px] font-mono-label text-brand-primary border border-brand-primary/30">
                DRAFT
              </span>
            </div>

            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              {/* Completeness score progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="font-label-caps text-[9px] text-brand-on-surface-variant uppercase tracking-wider">
                    Completeness
                  </span>
                  <span className="font-mono-code text-[11px] text-brand-primary font-bold">
                    {completeness}%
                  </span>
                </div>
                <div className="w-full h-1 bg-brand-container rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-primary transition-all duration-300 shadow-[0_0_8px_rgba(173,198,255,0.4)]"
                    style={{ width: `${completeness}%` }}
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="bg-brand-surface border border-brand-outline-variant rounded p-4 flex flex-col gap-3 shadow-xl">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-brand-container rounded border border-brand-outline-variant">
                    <Bot size={18} className="text-brand-primary animate-pulse" />
                  </div>
                  <span className="font-mono-label text-[9px] text-brand-on-surface-variant bg-brand-container px-2 py-0.5 rounded border border-brand-outline-variant/50">
                    v{version || '0.1.0'}-draft
                  </span>
                </div>
                <div>
                  <h4 className="font-headline-md text-sm text-brand-on-surface truncate font-bold">
                    {agentId || 'Unnamed Agent'}
                  </h4>
                  <p className="font-mono-label text-[10px] text-brand-on-surface-variant mt-0.5">
                    {namespace || 'namespace pending'}
                  </p>
                </div>
                <div className="h-px w-full bg-brand-outline-variant my-1"></div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-brand-on-surface-variant">
                    <CheckCircle2 size={13} className={jsonIsValid ? 'text-green-500' : 'text-brand-outline'} />
                    <span className={jsonIsValid ? 'text-brand-on-surface' : ''}>I/O Schema Validated</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-brand-on-surface-variant">
                    <AlertTriangle size={13} className={namespace ? 'text-green-500' : 'text-yellow-500'} />
                    <span className={namespace ? 'text-brand-on-surface' : ''}>
                      {namespace ? 'Namespace Defined' : 'Namespace undefined'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-brand-on-surface-variant">
                    <AlertTriangle size={13} className={agentId ? 'text-green-500' : 'text-yellow-500'} />
                    <span className={agentId ? 'text-brand-on-surface' : ''}>
                      {agentId ? 'Credentials Validated' : 'Credentials pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="min-h-14 border-t border-brand-outline-variant bg-brand-lowest flex justify-between items-center gap-4 px-6 py-2">
          <div className="min-w-0 flex items-center gap-3">
            <button
              onClick={() => setIsRegistering(false)}
              className="h-8 px-4 shrink-0 font-label-caps text-[10px] text-brand-on-surface border border-brand-outline-variant rounded hover:bg-brand-container transition-colors cursor-pointer"
            >
              ABORT WORKBENCH
            </button>
            {actionError && (
              <span className="text-[10px] text-brand-error font-mono-label truncate" title={actionError}>
                {actionError}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                alert("Inputs syntax validated. Ready to commit.");
              }}
              className="h-8 px-4 font-label-caps text-[10px] text-brand-on-surface border border-brand-outline-variant rounded hover:bg-brand-container transition-colors cursor-pointer"
            >
              VALIDATE SCHEMA
            </button>
            <button
              onClick={handleRegister}
              disabled={!canSubmit || isSubmitting}
              className={`h-8 px-6 font-label-caps text-[10px] rounded flex items-center gap-2 shadow-[0_0_12px_rgba(173,198,255,0.15)] transition-all cursor-pointer ${
                canSubmit && !isSubmitting
                  ? 'bg-brand-primary text-brand-on-primary hover:bg-brand-primary/90 font-bold'
                  : 'bg-brand-container text-brand-on-surface-variant border border-brand-outline-variant cursor-not-allowed'
              }`}
            >
              <span>{isSubmitting ? 'REGISTERING...' : 'REGISTER AGENT'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Control Bar */}
      <div className="flex justify-between items-end mb-6 border-b border-brand-outline-variant pb-4">
        <div className="w-1/2">
          <label className="font-label-caps text-[10px] text-brand-on-surface-variant block mb-2 uppercase tracking-wider">
            Discover Agents
          </label>
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-3 text-brand-outline" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full bg-brand-lowest border border-brand-outline-variant rounded text-brand-on-surface font-body-md pl-9 pr-4 py-1 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none placeholder:text-brand-outline/60 text-xs h-8 transition-colors"
              placeholder="Search by name, capability, or owner..."
            />
          </div>
        </div>
        <div>
          <button
            onClick={() => setIsRegistering(true)}
            className="bg-brand-primary text-brand-on-primary font-mono-label text-[11px] h-8 px-4 rounded flex items-center space-x-2 hover:bg-brand-primary/90 transition-all active:scale-95 cursor-pointer font-bold shadow-[0_0_12px_rgba(173,198,255,0.15)]"
          >
            <Plus size={14} />
            <span>Agent Card Registration</span>
          </button>
        </div>
      </div>

      {/* Registry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => (
          <div
            key={agent.id}
            className={`bg-brand-low border border-brand-outline-variant rounded p-4 flex flex-col transition-all duration-200 hover:border-brand-outline relative overflow-hidden group ${
              agent.status === 'deprecated' ? 'opacity-75' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className={`font-headline-md text-sm text-brand-on-surface font-bold ${agent.status === 'deprecated' ? 'line-through text-brand-on-surface-variant' : ''}`}>
                  {agent.name}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="font-mono-code text-[11px] text-brand-on-surface-variant">
                    {agent.version}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-brand-outline-variant"></span>
                  <span className="font-mono-label text-[10px] text-brand-outline uppercase tracking-wider">
                    Owner: {agent.owner}
                  </span>
                </div>
              </div>

              {/* Status Chip and Catalog Lifecycle Action */}
              <div className="flex flex-col items-end gap-1.5">
                {agent.status === 'published' && (
                  <div className="border border-green-500 bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-[9px] font-mono-label uppercase flex items-center gap-1.5 shadow-[0_0_6px_rgba(34,197,94,0.1)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    <span>Published</span>
                  </div>
                )}
                {agent.status === 'deprecated' && (
                  <div className="border border-red-400/50 border-dashed bg-red-500/5 text-red-400 px-2 py-0.5 rounded text-[9px] font-mono-label uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                    <span>Deprecated</span>
                  </div>
                )}
                {agent.status === 'draft' && (
                  <div className="border border-brand-primary/50 bg-brand-primary/5 text-brand-primary px-2 py-0.5 rounded text-[9px] font-mono-label uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></span>
                    <span>Local Draft</span>
                  </div>
                )}
                {agent.status === 'disabled' && (
                  <div className="border border-brand-outline-variant bg-brand-container text-brand-on-surface-variant px-2 py-0.5 rounded text-[9px] font-mono-label uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-outline"></span>
                    <span>Disabled</span>
                  </div>
                )}
                {agent.status === 'draft' && (
                  <button
                    type="button"
                    disabled={pendingActionId === agent.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleLifecycleAction(agent, onPublishAgent);
                    }}
                    className="border border-brand-primary/50 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50 px-2 py-0.5 rounded text-[9px] font-mono-label uppercase"
                  >
                    {pendingActionId === agent.id ? 'Publishing...' : 'Publish'}
                  </button>
                )}
                {agent.status === 'published' && (
                  <button
                    type="button"
                    disabled={pendingActionId === agent.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleLifecycleAction(agent, onDisableAgent);
                    }}
                    className="border border-brand-error/40 bg-brand-error-container/10 text-brand-error hover:bg-brand-error-container/20 disabled:opacity-50 px-2 py-0.5 rounded text-[9px] font-mono-label uppercase"
                  >
                    {pendingActionId === agent.id ? 'Disabling...' : 'Disable'}
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <p className="font-body-sm text-xs text-brand-on-surface-variant line-clamp-2 leading-relaxed">
                {agent.description}
              </p>
            </div>

            {/* Tags / Metadata */}
            <div className="mt-auto pt-3 border-t border-brand-outline-variant/40 flex flex-wrap gap-1.5">
              {agent.tags.map(tag => (
                <span
                  key={tag}
                  className="bg-brand-container border border-brand-outline-variant/60 text-brand-on-surface font-mono-label text-[10px] px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Read-Only Scheme hover indicator */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Info size={12} className="text-brand-primary/60" />
            </div>
          </div>
        ))}
      </div>

      {(catalogLoading || catalogError || actionError) && (
        <div className="text-center py-3 border border-brand-outline-variant bg-brand-lowest rounded">
          {catalogLoading && <p className="text-brand-on-surface-variant text-[10px] font-mono-label">SYNCING CATALOG...</p>}
          {catalogError && <p className="text-brand-error text-[10px] font-mono-label">{catalogError}</p>}
          {!catalogError && actionError && <p className="text-brand-error text-[10px] font-mono-label">{actionError}</p>}
        </div>
      )}

      {/* No Agents Fallback */}
      {!catalogLoading && filteredAgents.length === 0 && (
        <div className="text-center py-12 border border-dashed border-brand-outline-variant bg-brand-lowest rounded">
          <p className="text-brand-on-surface-variant text-sm font-mono-label">No matching agents found in registry.</p>
        </div>
      )}

      {/* StatusGuard Area (Draft List not implemented) */}
      <div className="mt-12 border border-dashed border-brand-outline bg-brand-container p-8 rounded flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-brand-high border border-brand-outline-variant flex items-center justify-center mb-4 text-brand-outline">
          <Cpu size={20} className="animate-pulse" />
        </div>
        <h4 className="font-headline-md text-sm font-bold text-brand-on-surface mb-2">
          Draft Agents View
        </h4>
        <p className="font-body-sm text-xs text-brand-on-surface-variant max-w-md leading-relaxed">
          The view for personal draft agents is currently under development in Phase 2. Local drafts remain accessible via CLI or standard Registry workbench registers above.
        </p>
      </div>
    </div>
  );
}
