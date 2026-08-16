import React, {useEffect, useMemo, useState} from 'react';
import {CheckCircle2, Code2, Database, Layers, Loader2, Plus, ShieldCheck, UploadCloud} from 'lucide-react';

import {buildAgentCard, toPlatformErrorView, type AgentCardV02, type AuthenticationType} from '../api/nekiro';
import type {Agent, PlatformErrorView} from '../types';
import {EmptyState, ErrorBanner, PageHeader, SectionLabel, Skeleton, StatusBadge} from './ui';

interface RegistryTabProps {
  agents: Agent[];
  draftAgents: Agent[];
  onRegisterAgent: (card: AgentCardV02) => Promise<Agent>;
  onPublishAgent: (agent: Agent) => Promise<void>;
  catalogLoading: boolean;
  catalogError: PlatformErrorView | null;
  catalogReady: boolean;
  defaultOwnerId: string;
  defaultOwnerName: string;
  searchQuery: string;
}

const defaultCapabilities = JSON.stringify({
  capabilities: [
    {
      id: 'runtime.echo',
      name: 'Runtime Echo',
      description: 'Echoes structured input.',
      inputSchema: {type: 'object'},
      outputSchema: {type: 'object'},
      requiredPermissions: [],
    },
  ],
}, null, 2);

export default function RegistryTab(props: RegistryTabProps) {
  const {
    agents,
    draftAgents,
    onRegisterAgent,
    onPublishAgent,
    catalogLoading,
    catalogError,
    catalogReady,
    defaultOwnerId,
    defaultOwnerName,
    searchQuery,
  } = props;
  const [showForm, setShowForm] = useState(false);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [localError, setLocalError] = useState<PlatformErrorView | null>(null);
  const [agentId, setAgentId] = useState('runtime.echo');
  const [name, setName] = useState('Runtime Echo Agent');
  const [description, setDescription] = useState('Echoes structured input through the A2A JSON-RPC profile.');
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [ownerName, setOwnerName] = useState(defaultOwnerName);
  const [version, setVersion] = useState('1.0.0');
  const [endpoint, setEndpoint] = useState('');
  const [authentication, setAuthentication] = useState<AuthenticationType>('none');
  const [permissionsText, setPermissionsText] = useState('');
  const [capabilitiesJson, setCapabilitiesJson] = useState(defaultCapabilities);

  const allAgents = useMemo(() => [...draftAgents, ...agents], [agents, draftAgents]);
  const selectedAgent = useMemo(() => allAgents.find((agent) => agentKey(agent) === selectedAgentKey), [allAgents, selectedAgentKey]);
  useEffect(() => {
    if (selectedAgentKey && !allAgents.some((agent) => agentKey(agent) === selectedAgentKey)) {
      setSelectedAgentKey(null);
    }
  }, [allAgents, selectedAgentKey]);
  const filteredDraftAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return draftAgents;
    return draftAgents.filter((agent) => matchesAgentQuery(agent, query));
  }, [draftAgents, searchQuery]);
  const filteredPublishedAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => matchesAgentQuery(agent, query));
  }, [agents, searchQuery]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      const card = buildAgentCard({
        agentId,
        name,
        ownerId,
        ownerDisplayName: ownerName,
        description,
        version,
        endpoint,
        authentication,
        permissions: parsePermissions(permissionsText),
        capabilitiesJson,
        limits: {timeoutMs: 30000, maxInputBytes: 1048576, maxOutputBytes: 1048576, streaming: true},
      });
      const registeredAgent = await onRegisterAgent(card);
      setShowForm(false);
      setSelectedAgentKey(agentKey(registeredAgent));
    } catch (error) {
      setLocalError(toPlatformErrorView(error, 'Unable to register Agent Card.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (agent: Agent) => {
    setLocalError(null);
    setPublishing(true);
    try {
      await onPublishAgent(agent);
    } catch (error) {
      setLocalError(toPlatformErrorView(error, 'Unable to publish Agent Card.'));
    } finally {
      setPublishing(false);
    }
  };

  const gatewayTone = catalogError ? 'danger' : catalogLoading ? 'accent' : catalogReady ? 'ok' : 'neutral';
  const gatewayValue = catalogError ? 'ERROR' : catalogLoading ? 'SYNC' : catalogReady ? 'LIVE' : 'WAIT';
  const gatewayDetail = catalogError ? (catalogError.code ?? 'Catalog request failed') : catalogReady ? 'Northbound /v3' : 'Awaiting first response';

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        eyebrow="Registry"
        title="Agent Card Catalog"
        description="Live v3 Catalog surface for Agent Card v0.2 registration and discovery. Trust and Release lifecycle operations are handled in Trusted Publication."
      >
        <button onClick={() => setShowForm((value) => !value)} className="btn btn-primary">
          <Plus size={14} /> Register Agent Card
        </button>
      </PageHeader>

      <ErrorBanner error={catalogError ?? localError} />

      <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
        <InstrumentStat icon={<Database size={13} />} label="Visible cards" value={String(agents.length)} detail="from live Catalog" />
        <InstrumentStat icon={<CheckCircle2 size={13} />} label="Published" value={String(agents.filter((agent) => agent.status === 'published').length)} detail="discoverable versions" tone="ok" />
        <InstrumentStat icon={<Layers size={13} />} label="Drafts" value={String(draftAgents.length)} detail="awaiting publish" tone="warn" />
        <InstrumentStat
          icon={<ShieldCheck size={13} />}
          label="Gateway"
          value={gatewayValue}
          detail={gatewayDetail}
          tone={gatewayTone}
          live={gatewayValue === 'LIVE' || gatewayValue === 'SYNC'}
        />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel grid grid-cols-2 gap-4 p-4">
          <Field label="Agent ID" value={agentId} onChange={setAgentId} />
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Owner ID" value={ownerId} onChange={setOwnerId} />
          <Field label="Owner display name" value={ownerName} onChange={setOwnerName} />
          <Field label="Version" value={version} onChange={setVersion} />
          <Field label="A2A endpoint" value={endpoint} onChange={setEndpoint} />
          <label className="flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Authentication
            <select id="registration-authentication" aria-label="Authentication" value={authentication} onChange={(event) => setAuthentication(event.target.value as AuthenticationType)} className="field font-mono text-[12px]">
              <option value="none">none</option>
              <option value="api_key">api_key</option>
              <option value="http_bearer">http_bearer</option>
              <option value="oauth2_client_credentials">oauth2_client_credentials</option>
              <option value="mutual_tls">mutual_tls</option>
            </select>
          </label>
          <Field label="Permissions, one per line as ID: description" value={permissionsText} onChange={setPermissionsText} multiline rows={3} />
          <label className="col-span-2 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Description
            <textarea aria-label="Description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="field resize-y" />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Capabilities JSON
            <textarea aria-label="Capabilities JSON" value={capabilitiesJson} onChange={(event) => setCapabilitiesJson(event.target.value)} rows={9} className="field resize-y font-mono text-[11.5px] leading-relaxed" />
          </label>
          <div className="col-span-2 flex justify-end gap-2.5 border-t border-line pt-3.5">
            <button type="button" onClick={() => setShowForm(false)} className="btn">Cancel</button>
            <button disabled={submitting} className="btn btn-primary">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Submit draft
            </button>
          </div>
        </form>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)] gap-4 max-[1100px]:grid-cols-1">
        {/* Results list */}
        <div className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <SectionLabel>Registry results</SectionLabel>
            {catalogLoading && <Loader2 size={13} className="animate-spin text-accent" />}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <AgentListSection
              title="My drafts"
              description="Server-returned drafts from this browser session. Complete Trusted Publication before installation."
              agents={filteredDraftAgents}
              emptyMessage="No draft Agent Cards in this session. Submit draft to stage one for publishing."
              loading={catalogLoading && draftAgents.length === 0}
              selectedAgent={selectedAgent}
              onSelect={(agent) => setSelectedAgentKey(agentKey(agent))}
            />
            <AgentListSection
              title="Published catalog"
              description="Live discovery returns published Catalog versions. Catalog publication is not Trusted Publication."
              agents={filteredPublishedAgents}
              emptyMessage="No published Catalog entries returned. This is an empty result, not a mock fallback."
              loading={catalogLoading && agents.length === 0}
              selectedAgent={selectedAgent}
              onSelect={(agent) => setSelectedAgentKey(agentKey(agent))}
            />
          </div>
        </div>

        {/* Inspector */}
        <div className="panel flex min-h-0 flex-col overflow-hidden">
          {selectedAgent ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-fg">{selectedAgent.name}</div>
                  <div className="mt-1 font-mono text-[11px] text-fg-muted">
                    <span className="text-accent-bright">{selectedAgent.id}</span> <span className="text-fg-faint">@ {selectedAgent.version}</span>
                    <span className="text-fg-faint"> · owner {selectedAgent.owner} ({selectedAgent.ownerId})</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {selectedAgent.status === 'draft' && (
                    <button onClick={() => void handlePublish(selectedAgent)} disabled={publishing} className="btn btn-primary">
                      {publishing ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Publish to Catalog
                    </button>
                  )}
                  {selectedAgent.status === 'published' && (
                    <span className="inline-flex h-[30px] items-center rounded border border-line bg-ink-800 px-3 text-[11px] text-fg-muted">Review Release in Trusted Publication</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 border-b border-line px-4 py-3">
                <FactTile label="Version" value={selectedAgent.version} />
                <FactTile label="Registered" value={selectedAgent.registeredAt || 'n/a'} />
                <FactTile label="Published" value={selectedAgent.publishedAt || 'not published'} />
              </div>

              {selectedAgent.publicUrl && (
                <div className="border-b border-line px-4 py-3">
                  <SectionLabel className="mb-2">Public NeKiro share URL</SectionLabel>
                  <a href={selectedAgent.publicUrl} className="break-all font-mono text-[11.5px] text-accent-bright underline decoration-accent-line underline-offset-4">{selectedAgent.publicUrl}</a>
                  <div className="mt-2 text-[11px] leading-relaxed text-fg-faint">Stable Agent identity. Release selection and permission acceptance still happen at install time.</div>
                </div>
              )}

              <div className="border-b border-line px-4 py-3">
                <div className="mb-2.5 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-ok" />
                  <SectionLabel>Declared permissions</SectionLabel>
                  <span className="ml-auto font-mono text-[10px] text-fg-faint">{selectedAgent.permissions.length}</span>
                </div>
                {selectedAgent.permissions.length === 0 ? (
                  <p className="text-[12px] text-fg-faint">No permissions declared; installation can submit an explicit empty acceptedPermissions array.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedAgent.permissions.map((permission) => (
                      <div key={permission.id} className="rounded border border-line bg-ink-900 px-3 py-2">
                        <div className="font-mono text-[11px] text-accent-bright">{permission.id}</div>
                        <div className="mt-0.5 text-[12px] text-fg-muted">{permission.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 py-3">
                <div className="mb-2.5 flex items-center gap-2">
                  <Code2 size={13} className="text-fg-faint" />
                  <SectionLabel>Agent Card JSON</SectionLabel>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto rounded border border-line bg-ink-950 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-fg-muted">{selectedAgent.schema}</pre>
              </div>
            </>
          ) : (
            <EmptyState title="No selection" message="Select a Catalog entry to inspect the server-returned Agent Card." />
          )}
        </div>
      </div>
    </div>
  );
}

function parsePermissions(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [id, ...rest] = line.split(':');
    const permissionID = id.trim();
    const description = rest.join(':').trim();
    if (!permissionID || !description) throw new Error('Each permission must include an ID and description separated by a colon.');
    return {id: permissionID, description};
  });
}

function AgentListSection({
  title,
  description,
  agents,
  emptyMessage,
  loading,
  selectedAgent,
  onSelect,
}: {
  title: string;
  description: string;
  agents: Agent[];
  emptyMessage: string;
  loading: boolean;
  selectedAgent?: Agent;
  onSelect: (agent: Agent) => void;
}) {
  return (
    <section className="border-b border-line last:border-b-0">
      <div className="border-b border-line bg-ink-900/60 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="mono-label !text-fg">{title}</span>
          <span className="font-mono text-[10px] text-fg-faint">{agents.length}</span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-fg-faint">{description}</p>
      </div>
      <div className="divide-y divide-line">
        {loading ? (
          <div className="space-y-2.5 p-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="h-8 flex-1" />
              </div>
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="p-5 text-center text-[12px] text-fg-faint">{emptyMessage}</div>
        ) : (
          agents.map((agent) => (
            <div key={agentKey(agent)}>
              <AgentRow
                agent={agent}
                selected={selectedAgent ? agentKey(selectedAgent) === agentKey(agent) : false}
                onSelect={onSelect}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function AgentRow({agent, selected, onSelect}: {agent: Agent; selected: boolean; onSelect: (agent: Agent) => void}) {
  return (
    <button
      onClick={() => onSelect(agent)}
      className={`w-full px-4 py-3 text-left transition-colors duration-100 ${selected ? 'bg-accent-soft' : 'hover:bg-ink-800/70'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`truncate text-[13px] ${selected ? 'font-medium text-accent-bright' : 'text-fg'}`}>{agent.name}</div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-fg-faint">
            <span>{agent.id}</span><span> @ {agent.version}</span>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-fg-muted">{agent.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {agent.tags.map((tag) => (
          <span key={tag} className="rounded border border-line bg-ink-900 px-1.5 py-px font-mono text-[9.5px] text-fg-muted">{tag}</span>
        ))}
      </div>
    </button>
  );
}

function matchesAgentQuery(agent: Agent, query: string): boolean {
  return [agent.id, agent.name, agent.owner, agent.ownerId, agent.description, agent.version, agent.status, agent.tags.join(' ')].join(' ').toLowerCase().includes(query);
}

function agentKey(agent: Agent): string {
  return agent.id + '@' + agent.version;
}

function Field({label, value, onChange, multiline = false, rows = 2}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
      {label}
      {multiline ? (
        <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="field resize-y font-mono text-[11.5px] leading-relaxed" />
      ) : (
        <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="field font-mono text-[12px]" />
      )}
    </label>
  );
}

function InstrumentStat({icon, label, value, detail, tone = 'accent', live = false}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: 'ok' | 'warn' | 'danger' | 'accent' | 'neutral';
  live?: boolean;
}) {
  const valueColor = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : tone === 'accent' ? 'text-accent-bright' : 'text-fg-muted';
  const iconColor = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : 'text-accent' ;
  return (
    <div className="panel px-4 py-3 transition-colors duration-100 hover:border-line-strong">
      <div className="flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <span className="mono-label">{label}</span>
      </div>
      <div className={`mt-2 font-mono text-[22px] font-semibold leading-none tracking-tight ${valueColor}`}>
        {value}
        {live && <span className={`status-dot live ml-2 inline-block align-middle bg-accent`} aria-hidden="true" />}
      </div>
      <div className="mt-1.5 truncate font-mono text-[10px] text-fg-faint">{detail}</div>
    </div>
  );
}

function FactTile({label, value}: {label: string; value: string}) {
  return (
    <div className="min-w-0 rounded border border-line bg-ink-900 px-2.5 py-2">
      <div className="text-[9.5px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-fg">{value}</div>
    </div>
  );
}
