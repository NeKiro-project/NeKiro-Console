import {useEffect, useMemo, useRef, useState} from 'react';
import {Activity, CheckCircle2, GitBranch, LoaderCircle, Play, Radio, RotateCcw, ShieldAlert} from 'lucide-react';

import {toPlatformErrorView, type AgentCardV02, type InvocationResultStreamEventV2, type InvocationResultV1, type NekiroApiClient} from '../api/nekiro';
import {compatibleSkills, inputTemplateFromSchema, isCurrentRequest, isTrustedEnabledInstallation, nextRequestGeneration} from '../consolePolicy';
import type {Installation, InvocationIntent, PlatformErrorView, Workspace} from '../types';

interface InvocationsTabProps {
  workspace: Workspace | null;
  installations: Installation[];
  client: NekiroApiClient;
  initialSelection?: InvocationIntent;
  onInspect: (invocationId: string, traceId: string) => void;
}

export default function InvocationsTab({workspace, installations, client, initialSelection, onInspect}: InvocationsTabProps) {
  const enabled = useMemo(() => installations.filter(isTrustedEnabledInstallation), [installations]);
  const [installationId, setInstallationId] = useState('');
  const [card, setCard] = useState<AgentCardV02 | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<PlatformErrorView | null>(null);
  const [capability, setCapability] = useState('');
  const [input, setInput] = useState('{}');
  const [stream, setStream] = useState(false);
  const [events, setEvents] = useState<InvocationResultStreamEventV2[]>([]);
  const [result, setResult] = useState<InvocationResultV1 | null>(null);
  const [error, setError] = useState<PlatformErrorView | null>(null);
  const [loading, setLoading] = useState(false);
  const requestGeneration = useRef(0);
  const cardRequestGeneration = useRef(0);
  const appliedSelectionSequence = useRef<number | null>(null);
  const selectedInstallation = enabled.find((item) => item.installationId === installationId);
  const skills = useMemo(() => selectedInstallation ? compatibleSkills(card ? {skills: card.skills} : undefined, selectedInstallation) : [], [card, selectedInstallation]);
  const selectedSkill = skills.find((skill) => skill.id === capability);

  useEffect(() => {
    requestGeneration.current = nextRequestGeneration(requestGeneration.current);
    cardRequestGeneration.current = nextRequestGeneration(cardRequestGeneration.current);
    setLoading(false);
    setResult(null);
    setEvents([]);
    setError(null);
    setCard(null);
    setCardLoading(false);
    setCardError(null);
    setInstallationId('');
    setCapability('');
    setInput('{}');
    setStream(false);
  }, [workspace?.workspaceId]);

  useEffect(() => {
    if (installationId && !enabled.some((item) => item.installationId === installationId)) {
      requestGeneration.current = nextRequestGeneration(requestGeneration.current);
      setLoading(false);
      setResult(null);
      setEvents([]);
      setError(null);
      setInstallationId('');
    }
  }, [enabled, installationId]);

  useEffect(() => {
    if (!initialSelection || appliedSelectionSequence.current === initialSelection.sequence || !enabled.some((item) => item.installationId === initialSelection.installationId)) return;
    appliedSelectionSequence.current = initialSelection.sequence;
    setInstallationId(initialSelection.installationId);
  }, [enabled, initialSelection]);

  useEffect(() => {
    const generation = nextRequestGeneration(cardRequestGeneration.current);
    cardRequestGeneration.current = generation;
    setCard(null);
    setCardError(null);
    setCapability('');
    setInput('{}');
    setStream(false);
    if (!selectedInstallation) {
      setCardLoading(false);
      return;
    }
    setCardLoading(true);
    void client.getAgentVersion(selectedInstallation.agentId, selectedInstallation.installedVersion).then((entry) => {
      if (!isCurrentRequest(generation, cardRequestGeneration.current)) return;
      setCard(entry.card);
    }).catch((value) => {
      if (!isCurrentRequest(generation, cardRequestGeneration.current)) return;
      setCardError(toPlatformErrorView(value, 'Unable to read the installed Agent Card.'));
    }).finally(() => {
      if (isCurrentRequest(generation, cardRequestGeneration.current)) setCardLoading(false);
    });
  }, [client, selectedInstallation?.agentId, selectedInstallation?.installedVersion]);

  useEffect(() => {
    if (skills.length === 0) {
      setCapability('');
      return;
    }
    if (skills.some((skill) => skill.id === capability)) return;
    selectCapability(skills[0].id);
  }, [skills]);

  const selectInstallation = (value: string) => {
    requestGeneration.current = nextRequestGeneration(requestGeneration.current);
    setLoading(false);
    setResult(null);
    setEvents([]);
    setError(null);
    setInstallationId(value);
  };

  const selectCapability = (value: string) => {
    setCapability(value);
    const skill = skills.find((candidate) => candidate.id === value);
    if (skill) setInput(JSON.stringify(inputTemplateFromSchema(skill.inputSchema), null, 2));
  };

  const run = async () => {
    if (!workspace) {
      setError({status: 0, code: 'CONFIGURATION_ERROR', message: 'Select the active Workspace first.'});
      return;
    }
    if (!selectedInstallation) {
      setError({status: 0, code: 'INSTALLATION_DISABLED', message: 'Select an enabled trusted Installation before invoking.'});
      return;
    }
    if (!selectedSkill) {
      setError({status: 0, code: 'CAPABILITY_NOT_ALLOWED', message: 'Select a capability allowed by this Installation.'});
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch {
      setError({status: 0, code: 'VALIDATION_ERROR', message: 'Input must be valid JSON.'});
      return;
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      setError({status: 0, code: 'VALIDATION_ERROR', message: 'Input must be a JSON object.'});
      return;
    }
    const generation = nextRequestGeneration(requestGeneration.current);
    requestGeneration.current = generation;
    const workspaceId = workspace.workspaceId;
    setLoading(true);
    setError(null);
    setResult(null);
    setEvents([]);
    try {
      if (stream) {
        await client.invokeStream(workspaceId, {agentId: selectedInstallation.agentId, capability: selectedSkill.id, input: parsed as Record<string, unknown>}, (event) => {
          if (isCurrentRequest(generation, requestGeneration.current)) setEvents((current) => [...current, event]);
        });
      } else {
        const value = await client.invoke(workspaceId, {agentId: selectedInstallation.agentId, capability: selectedSkill.id, input: parsed as Record<string, unknown>, stream: false});
        if (isCurrentRequest(generation, requestGeneration.current)) setResult(value);
      }
    } catch (value) {
      if (isCurrentRequest(generation, requestGeneration.current)) setError(toPlatformErrorView(value, 'Invocation failed.'));
    } finally {
      if (isCurrentRequest(generation, requestGeneration.current)) setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <div className="font-mono-label text-[10px] uppercase tracking-[0.24em] text-brand-primary mb-2">Invoke</div>
        <h2 className="text-2xl font-bold text-brand-on-surface">Try an installed Agent</h2>
        <p className="text-sm text-brand-on-surface-variant mt-1 max-w-3xl">Choose an enabled Installation, use a declared capability, then open the correlated trace directly from the result.</p>
      </div>
      <div className="glass-split-grid grid grid-cols-[minmax(340px,0.85fr)_minmax(420px,1.15fr)] gap-5 flex-1 min-h-0">
        <DispatchForm
          workspace={workspace}
          enabled={enabled}
          installationId={installationId}
          setInstallationId={selectInstallation}
          skills={skills}
          capability={capability}
          setCapability={selectCapability}
          selectedSkill={selectedSkill}
          input={input}
          setInput={setInput}
          stream={stream}
          setStream={setStream}
          streamingSupported={card?.limits.streaming === true}
          cardLoading={cardLoading}
          cardError={cardError}
          loading={loading}
          onSubmit={() => void run()}
        />
        <ResponsePanel stream={stream} loading={loading} result={result} events={events} error={error} onInspect={onInspect} />
      </div>
    </div>
  );
}

function DispatchForm({workspace, enabled, installationId, setInstallationId, skills, capability, setCapability, selectedSkill, input, setInput, stream, setStream, streamingSupported, cardLoading, cardError, loading, onSubmit}: {
  workspace: Workspace | null;
  enabled: Installation[];
  installationId: string;
  setInstallationId: (value: string) => void;
  skills: AgentCardV02['skills'];
  capability: string;
  setCapability: (value: string) => void;
  selectedSkill?: AgentCardV02['skills'][number];
  input: string;
  setInput: (value: string) => void;
  stream: boolean;
  setStream: (value: boolean) => void;
  streamingSupported: boolean;
  cardLoading: boolean;
  cardError: PlatformErrorView | null;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="bg-brand-low border border-brand-outline-variant rounded-xl p-5 h-fit">
      <div className="flex items-center gap-2 text-sm font-bold mb-4"><Play size={16} className="text-brand-primary" /> Build request</div>
      <label htmlFor="invocation-installation" className="block text-xs text-brand-on-surface-variant mb-1">Installed Agent</label>
      <select id="invocation-installation" value={installationId} onChange={(event) => setInstallationId(event.target.value)} disabled={loading} className="w-full rounded-lg border border-brand-outline-variant bg-brand-lowest px-3 py-2 text-sm text-brand-on-surface outline-none disabled:opacity-40">
        <option value="">Select enabled installation</option>
        {enabled.map((item) => <option key={item.installationId} value={item.installationId}>{item.agentId} @ {item.installedVersion} / {item.installedReleaseId}</option>)}
      </select>
      <label htmlFor="invocation-capability" className="block text-xs text-brand-on-surface-variant mt-4 mb-1">Capability</label>
      <select id="invocation-capability" value={capability} onChange={(event) => setCapability(event.target.value)} disabled={loading || cardLoading || skills.length === 0} className="w-full rounded-lg border border-brand-outline-variant bg-brand-lowest px-3 py-2 text-sm text-brand-on-surface outline-none disabled:opacity-40">
        <option value="">{cardLoading ? 'Reading installed Agent Card...' : skills.length === 0 ? 'No allowed capability' : 'Select capability'}</option>
        {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name} ({skill.id})</option>)}
      </select>
      {selectedSkill && <p className="mt-2 text-xs text-brand-on-surface-variant">{selectedSkill.description}</p>}
      {cardError && <div className="mt-3 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200"><ShieldAlert size={14} className="inline mr-2" />{cardError.message}</div>}
      <div className="mt-4 flex items-center justify-between gap-3">
        <label htmlFor="invocation-input" className="block text-xs text-brand-on-surface-variant">Input JSON</label>
        <button type="button" onClick={() => selectedSkill && setInput(JSON.stringify(inputTemplateFromSchema(selectedSkill.inputSchema), null, 2))} disabled={loading || !selectedSkill} className="flex items-center gap-1 rounded border border-brand-outline-variant px-2 py-1 text-[10px] text-brand-on-surface-variant disabled:opacity-40"><RotateCcw size={11} /> Reset from schema</button>
      </div>
      <textarea id="invocation-input" value={input} onChange={(event) => setInput(event.target.value)} disabled={loading || !selectedSkill} rows={7} className="mt-1 w-full rounded-lg border border-brand-outline-variant bg-brand-lowest px-3 py-2 font-mono-code text-xs text-brand-on-surface outline-none resize-y disabled:opacity-40" />
      {selectedSkill && <details className="mt-2 text-xs text-brand-on-surface-variant"><summary className="cursor-pointer">Declared input schema</summary><pre className="mt-2 max-h-40 overflow-auto rounded border border-brand-outline-variant bg-brand-lowest p-2 font-mono-code text-[10px] whitespace-pre-wrap">{JSON.stringify(selectedSkill.inputSchema, null, 2)}</pre></details>}
      <label htmlFor="invocation-stream" className="flex items-center gap-2 mt-3 text-xs text-brand-on-surface-variant"><input id="invocation-stream" type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} disabled={loading || !streamingSupported} /> Stream result over SSE {!streamingSupported && installationId && <span>(not declared)</span>}</label>
      <button disabled={loading || !workspace || !installationId || !selectedSkill || Boolean(cardError)} onClick={onSubmit} className="mt-4 w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{loading ? 'Invoking...' : 'Invoke Agent'}</button>
      {!workspace && <p className="mt-3 text-xs text-amber-300">Select the active Workspace before invoking.</p>}
    </section>
  );
}

function ResponsePanel({stream, loading, result, events, error, onInspect}: {stream: boolean; loading: boolean; result: InvocationResultV1 | null; events: InvocationResultStreamEventV2[]; error: PlatformErrorView | null; onInspect: (invocationId: string, traceId: string) => void}) {
  const terminalEvent = [...events].reverse().find((event) => ['completed', 'failed', 'canceled', 'timed_out'].includes(event.type));
  const correlation = result
    ? {invocationId: result.invocationId, traceId: result.traceId}
    : terminalEvent
      ? {invocationId: terminalEvent.invocationId, traceId: terminalEvent.traceId}
      : error?.invocationId && error.traceId
        ? {invocationId: error.invocationId, traceId: error.traceId}
        : null;
  return (
    <section className="bg-brand-low border border-brand-outline-variant rounded-xl overflow-hidden min-h-0 flex flex-col">
      <div className="px-4 py-3 border-b border-brand-outline-variant/60 flex items-center gap-2"><Activity size={15} className="text-brand-primary" /><span className="text-xs font-bold">Gateway response</span>{stream && <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-300"><Radio size={12} /> SSE</span>}</div>
      <div className="p-4 overflow-auto flex-1">
        {error && <div className="mb-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200"><ShieldAlert size={14} className="inline mr-2" />{error.message}{error.traceId && <span className="block mt-1 font-mono-code text-[10px]">trace {error.traceId}</span>}{error.invocationId && <span className="block mt-1 font-mono-code text-[10px]">invocation {error.invocationId}</span>}{error.rootTaskId && <span className="block mt-1 font-mono-code text-[10px]">root task {error.rootTaskId}</span>}</div>}
        {loading && <div className="flex items-center gap-2 text-xs text-brand-on-surface-variant"><LoaderCircle size={14} className="animate-spin" /> Waiting for Router...</div>}
        {result !== null && <JsonBlock value={result} />}
        {events.length > 0 && <div className="space-y-2">{events.map((event) => <div key={event.sequence} className="rounded-lg border border-brand-outline-variant bg-brand-lowest p-3 text-xs"><div className="flex items-center gap-2"><CheckCircle2 size={13} className={event.type === 'completed' ? 'text-emerald-300' : 'text-brand-primary'} /><span className="font-mono-code text-brand-primary">#{event.sequence} {event.type}</span><span className="ml-auto text-brand-on-surface-variant">{event.status}</span></div>{event.type === 'chunk' && <pre className="mt-2 whitespace-pre-wrap font-mono-code text-[11px] text-brand-on-surface-variant">{JSON.stringify(event.chunk, null, 2)}</pre>}{event.error && <div className="mt-2 text-red-200">{event.error.code}: {event.error.message}</div>}</div>)}</div>}
        {correlation && <button type="button" onClick={() => onInspect(correlation.invocationId, correlation.traceId)} className="mt-4 flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold text-white"><GitBranch size={14} /> Open correlated trace</button>}
        {!loading && !result && events.length === 0 && !error && <div className="h-full flex items-center justify-center text-sm text-brand-on-surface-variant">Choose an Installation and invoke a declared capability.</div>}
      </div>
    </section>
  );
}

function JsonBlock({value}: {value: unknown}) {
  return <pre className="select-text rounded-lg border border-brand-outline-variant bg-brand-lowest p-4 whitespace-pre-wrap font-mono-code text-xs text-brand-on-surface-variant">{JSON.stringify(value, null, 2)}</pre>;
}
