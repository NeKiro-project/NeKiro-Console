import {useEffect, useRef, useState} from 'react';
import {BookOpen, GitBranch, LoaderCircle, Search} from 'lucide-react';

import {NekiroApiClient, toPlatformErrorView, type InvocationDetailResponseV4, type TraceResponseV4} from '../api/nekiro';
import {isCurrentRequest, nextRequestGeneration} from '../consolePolicy';
import type {PlatformErrorView, Workspace} from '../types';
import {ErrorBanner, PageHeader, SectionLabel, StatusBadge} from './ui';

export default function LedgerTab({workspace, client}: {workspace: Workspace | null; client: NekiroApiClient}) {
  const [invocationId, setInvocationId] = useState('');
  const [traceId, setTraceId] = useState('');
  const [detail, setDetail] = useState<InvocationDetailResponseV4 | null>(null);
  const [trace, setTrace] = useState<TraceResponseV4 | null>(null);
  const [error, setError] = useState<PlatformErrorView | null>(null);
  const [loading, setLoading] = useState(false);
  const requestGeneration = useRef(0);

  useEffect(() => {
    requestGeneration.current = nextRequestGeneration(requestGeneration.current);
    setLoading(false);
    setDetail(null);
    setTrace(null);
    setError(null);
  }, [workspace?.workspaceId]);

  const read = async (kind: 'invocation' | 'trace') => {
    if (!workspace) {
      setError({status: 0, code: 'CONFIGURATION_ERROR', message: 'Select the active Workspace first.'});
      return;
    }
    const generation = nextRequestGeneration(requestGeneration.current);
    requestGeneration.current = generation;
    const workspaceId = workspace.workspaceId;
    setLoading(true);
    setError(null);
    setDetail(null);
    setTrace(null);
    try {
      if (kind === 'invocation') {
        const value = await client.getInvocation(workspaceId, invocationId);
        if (isCurrentRequest(generation, requestGeneration.current)) setDetail(value);
      } else {
        const value = await client.getTrace(workspaceId, traceId);
        if (isCurrentRequest(generation, requestGeneration.current)) setTrace(value);
      }
    } catch (value) {
      if (isCurrentRequest(generation, requestGeneration.current)) setError(toPlatformErrorView(value, 'Ledger read failed.'));
    } finally {
      if (isCurrentRequest(generation, requestGeneration.current)) setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        eyebrow="Ledger / Metadata-only"
        title="Inspect recorded lineage"
        description="Reads are Workspace-scoped and Owner-authorized. Result payloads are never rendered from Ledger records."
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,0.8fr)_minmax(420px,1.2fr)] gap-4 max-[1100px]:grid-cols-1">
        <section className="panel h-fit p-4">
          <div className="mb-4 flex items-center gap-2.5">
            <Search size={15} className="text-accent" />
            <span className="text-[13.5px] font-semibold text-fg">Read metadata</span>
            {workspace && <span className="ml-auto font-mono text-[10px] text-fg-faint">{workspace.workspaceId}</span>}
          </div>
          <label htmlFor="ledger-invocation-id" className="mb-3 flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Invocation ID
            <div className="flex gap-2">
              <input aria-label="Invocation ID" id="ledger-invocation-id" value={invocationId} onChange={(event) => setInvocationId(event.target.value)} disabled={loading} placeholder="inv-..." className="field min-w-0 flex-1 font-mono text-[12px]" />
              <button disabled={!workspace || !invocationId || loading} onClick={() => void read('invocation')} className="btn">Read</button>
            </div>
          </label>
          <label htmlFor="ledger-trace-id" className="flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
            Trace ID
            <div className="flex gap-2">
              <input aria-label="Trace ID" id="ledger-trace-id" value={traceId} onChange={(event) => setTraceId(event.target.value)} disabled={loading} placeholder="trace-..." className="field min-w-0 flex-1 font-mono text-[12px]" />
              <button disabled={!workspace || !traceId || loading} onClick={() => void read('trace')} className="btn">Read</button>
            </div>
          </label>
          {loading && <div className="mt-4 flex items-center gap-2 font-mono text-[11.5px] text-fg-muted"><LoaderCircle size={13} className="animate-spin text-accent" /> Reading Router Ledger...</div>}
          {error && <div className="mt-4"><ErrorBanner error={error} /></div>}
        </section>
        <section className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <BookOpen size={14} className="text-accent" />
            <SectionLabel>Ledger projection</SectionLabel>
            {(detail || trace) && <span className="ml-auto font-mono text-[10px] text-fg-faint">{detail ? 'invocation' : 'trace'}</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {detail && <Detail detail={detail} />}
            {trace && <Trace trace={trace} />}
            {!detail && !trace && !loading && !error && (
              <div className="flex h-full min-h-32 items-center justify-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">Enter an Invocation or Trace ID to inspect metadata.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Detail({detail}: {detail: InvocationDetailResponseV4}) {
  return (
    <div className="space-y-4">
      <Record record={detail.invocation} />
      <div className="flex items-center gap-2">
        <GitBranch size={13} className="text-fg-faint" />
        <SectionLabel>committed events</SectionLabel>
        <span className="ml-auto font-mono text-[10px] text-fg-faint">{detail.events.length}</span>
      </div>
      {detail.events.map((event) => (
        <div key={event.eventId} className="rounded border border-line bg-ink-900 p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11.5px] text-accent-bright">#{event.sequence} {event.type}</span>
            <span className="ml-auto font-mono text-[10px] text-fg-faint">{event.occurredAt}</span>
          </div>
          <div className="mt-1 text-[11.5px] text-fg-muted">{event.status}</div>
          {event.error && <div className="mt-1 text-[12px] text-danger">{event.error.code}</div>}
        </div>
      ))}
    </div>
  );
}

function Trace({trace}: {trace: TraceResponseV4}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-fg-muted">
        Trace <span className="font-mono text-[11.5px] text-accent-bright">{trace.traceId}</span>
        <span className="ml-auto font-mono text-[10px] text-fg-faint">{trace.invocations.length} invocation(s)</span>
      </div>
      {trace.invocations.map((record) => <div key={record.invocationId}><Record record={record} /></div>)}
    </div>
  );
}

function Record({record}: {record: InvocationDetailResponseV4['invocation']}) {
  return (
    <div className="rounded border border-line bg-ink-900 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-[12px] text-accent-bright">{record.invocationId}</span>
        <StatusBadge status={record.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11.5px] text-fg-muted">
        <RecordFact label="Root task" value={record.rootTaskId} />
        <RecordFact label="Parent" value={record.parentInvocationId ?? 'root'} />
        <RecordFact label="Caller" value={`${record.caller.type}:${record.caller.id}`} />
        <RecordFact label="Workspace" value={record.workspaceId} />
        <RecordFact label="Agent" value={record.targetAgentId} />
        <RecordFact label="Card" value={record.agentCardVersion} />
        <RecordFact label="Release" value={record.agentReleaseId} />
        <RecordFact label="Card digest" value={record.agentCardDigest} />
        <RecordFact label="Capability" value={record.capability} />
        <RecordFact label="Latency" value={record.latencyMs === undefined ? 'n/a' : record.latencyMs + ' ms'} />
        <RecordFact label="Trace" value={record.traceId} />
        <RecordFact label="Created" value={record.createdAt} />
        {record.errorCode && <RecordFact label="Error" value={record.errorCode} danger />}
      </div>
    </div>
  );
}

function RecordFact({label, value, danger = false}: {label: string; value: string; danger?: boolean}) {
  return (
    <span className="min-w-0">
      <span className="text-fg-faint">{label}</span> <b className={`break-all font-mono font-medium ${danger ? 'text-danger' : 'text-fg'}`}>{value}</b>
    </span>
  );
}
