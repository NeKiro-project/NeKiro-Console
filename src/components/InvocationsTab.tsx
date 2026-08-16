import {useEffect, useMemo, useRef, useState} from 'react';
import {Activity, CheckCircle2, LoaderCircle, Play, Radio, ShieldAlert} from 'lucide-react';

import {NekiroApiClient, toPlatformErrorView, type InvocationResultStreamEventV2} from '../api/nekiro';
import {isCurrentRequest, isTrustedEnabledInstallation, nextRequestGeneration} from '../consolePolicy';
import type {Installation, PlatformErrorView, Workspace} from '../types';
import {ErrorBanner, PageHeader, SectionLabel, StatusBadge} from './ui';

interface InvocationsTabProps {
  workspace: Workspace | null;
  installations: Installation[];
  client: NekiroApiClient;
}

export default function InvocationsTab({workspace, installations, client}: InvocationsTabProps) {
  const enabled = useMemo(() => installations.filter(isTrustedEnabledInstallation), [installations]);
  const [installationId, setInstallationId] = useState('');
  const [capability, setCapability] = useState('');
  const [input, setInput] = useState('{\n  "message": "hello"\n}');
  const [stream, setStream] = useState(false);
  const [events, setEvents] = useState<InvocationResultStreamEventV2[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<PlatformErrorView | null>(null);
  const [loading, setLoading] = useState(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current = nextRequestGeneration(requestGeneration.current);
    setLoading(false);
    setResult(null);
    setEvents([]);
    setError(null);
    if (installationId && !enabled.some((item) => item.installationId === installationId)) {
      setInstallationId('');
      setCapability('');
    }
  }, [workspace?.workspaceId]);

  useEffect(() => {
    if (installationId && !enabled.some((item) => item.installationId === installationId)) {
      requestGeneration.current = nextRequestGeneration(requestGeneration.current);
      setLoading(false);
      setResult(null);
      setEvents([]);
      setError(null);
      setInstallationId('');
      setCapability('');
    }
  }, [enabled, installationId]);

  const run = async () => {
    if (!workspace) {
      setError({status: 0, code: 'CONFIGURATION_ERROR', message: 'Select the active Workspace first.'});
      return;
    }
    const installation = enabled.find((item) => item.installationId === installationId);
    if (!installation) {
      setError({status: 0, code: 'INSTALLATION_DISABLED', message: 'Select an enabled trusted Installation before invoking.'});
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
        await client.invokeStream(workspaceId, {agentId: installation.agentId, capability, input: parsed as Record<string, unknown>}, (event) => {
          if (isCurrentRequest(generation, requestGeneration.current)) setEvents((current) => [...current, event]);
        });
      } else {
        const value = await client.invoke(workspaceId, {agentId: installation.agentId, capability, input: parsed as Record<string, unknown>, stream: false});
        if (isCurrentRequest(generation, requestGeneration.current)) setResult(value);
      }
    } catch (value) {
      if (isCurrentRequest(generation, requestGeneration.current)) setError(toPlatformErrorView(value, 'Invocation failed.'));
    } finally {
      if (isCurrentRequest(generation, requestGeneration.current)) setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        eyebrow="Invocations / Owner"
        title="Invoke an installed Agent"
        description="Requests use Gateway v4. JSON and SSE responses are validated for correlation and terminal semantics before display."
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,0.85fr)_minmax(420px,1.15fr)] gap-4 max-[1100px]:grid-cols-1">
        <DispatchForm
          workspace={workspace}
          enabled={enabled}
          installationId={installationId}
          setInstallationId={(value) => { setInstallationId(value); setCapability(''); }}
          capability={capability}
          setCapability={setCapability}
          input={input}
          setInput={setInput}
          stream={stream}
          setStream={setStream}
          loading={loading}
          onSubmit={() => void run()}
        />
        <ResponsePanel stream={stream} loading={loading} result={result} events={events} error={error} />
      </div>
    </div>
  );
}

function DispatchForm({workspace, enabled, installationId, setInstallationId, capability, setCapability, input, setInput, stream, setStream, loading, onSubmit}: {
  workspace: Workspace | null;
  enabled: Installation[];
  installationId: string;
  setInstallationId: (value: string) => void;
  capability: string;
  setCapability: (value: string) => void;
  input: string;
  setInput: (value: string) => void;
  stream: boolean;
  setStream: (value: boolean) => void;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <section className="panel h-fit p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <Play size={15} className="text-accent" />
        <span className="text-[13.5px] font-semibold text-fg">Dispatch request</span>
        {workspace && <span className="ml-auto font-mono text-[10px] text-fg-faint">{workspace.workspaceId}</span>}
      </div>
      <label htmlFor="invocation-installation" className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
        Installed Agent
        <select aria-label="Installed Agent" id="invocation-installation" value={installationId} onChange={(event) => setInstallationId(event.target.value)} disabled={loading} className="field font-mono text-[12px]">
          <option value="">Select enabled installation</option>
          {enabled.map((item) => <option key={item.installationId} value={item.installationId}>{item.agentId} @ {item.installedVersion} / {item.installedReleaseId}</option>)}
        </select>
      </label>
      <label htmlFor="invocation-capability" className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
        Capability
        <input id="invocation-capability" value={capability} onChange={(event) => setCapability(event.target.value)} disabled={loading} placeholder="Enter declared capability" className="field font-mono text-[12px]" />
      </label>
      <label htmlFor="invocation-input" className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
        Input JSON
        <textarea aria-label="Input JSON" id="invocation-input" value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} rows={7} className="field resize-y font-mono text-[11.5px] leading-relaxed" />
      </label>
      <label htmlFor="invocation-stream" className="flex cursor-pointer items-center gap-2.5 text-[12.5px] text-fg-muted">
        <input id="invocation-stream" type="checkbox" checked={stream} onChange={(event) => setStream(event.target.checked)} disabled={loading} className="h-3.5 w-3.5 accent-sky-400" />
        Stream result over SSE
      </label>
      <button disabled={loading || !workspace || !installationId || !capability} onClick={onSubmit} className="btn btn-primary mt-4 h-8 w-full justify-center">
        {loading ? 'Invoking...' : 'Invoke'}
      </button>
      {!workspace && <p className="mt-3 text-[12px] text-warn">Select the active Workspace before invoking.</p>}
    </section>
  );
}

function ResponsePanel({stream, loading, result, events, error}: {stream: boolean; loading: boolean; result: unknown; events: InvocationResultStreamEventV2[]; error: PlatformErrorView | null}) {
  return (
    <section className="panel flex min-h-0 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Activity size={14} className="text-accent" />
        <SectionLabel>Gateway response</SectionLabel>
        {stream && (
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-warn">
            <Radio size={11} /> SSE
          </span>
        )}
        {loading && <LoaderCircle size={13} className="animate-spin text-accent" />}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error && <div className="mb-4"><ErrorBanner error={error} /></div>}
        {loading && <div className="mb-3 flex items-center gap-2 font-mono text-[11.5px] text-fg-muted"><LoaderCircle size={13} className="animate-spin text-accent" /> Waiting for Router...</div>}
        {result !== null && <JsonBlock value={result} />}
        {events.length > 0 && (
          <div className="space-y-1.5">
            {events.map((event) => (
              <div key={event.sequence} className="rounded border border-line bg-ink-900 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} className={event.type === 'completed' ? 'text-ok' : 'text-accent'} />
                  <span className="font-mono text-[11.5px] text-accent-bright">#{event.sequence} {event.type}</span>
                  <StatusBadge status={event.status} />
                </div>
                {event.type === 'chunk' && event.chunk !== undefined && <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg-muted">{JSON.stringify(event.chunk, null, 2)}</pre>}
                {event.error && <div className="mt-2 text-[12px] text-danger">{event.error.code}: {event.error.message}</div>}
              </div>
            ))}
          </div>
        )}
        {!loading && !result && events.length === 0 && !error && (
          <div className="flex h-full min-h-32 items-center justify-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">No invocation submitted.</div>
        )}
      </div>
    </section>
  );
}

function JsonBlock({value}: {value: unknown}) {
  return <pre className="rounded border border-line bg-ink-950 p-4 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-fg-muted">{JSON.stringify(value, null, 2)}</pre>;
}
