import {useCallback, useEffect, useRef, useState} from 'react';
import {BookOpen, GitBranch, LoaderCircle, Search, ShieldAlert} from 'lucide-react';

import {toPlatformErrorView, type InvocationDetailResponseV4, type InvocationRecordV4, type NekiroApiClient, type TraceResponseV4} from '../api/nekiro';
import {isCurrentRequest, nextRequestGeneration} from '../consolePolicy';
import type {LedgerIntent, PlatformErrorView, Workspace} from '../types';
import CopyButton from './CopyButton';

export default function LedgerTab({workspace, client, initialLookup, onReadSuccess}: {workspace: Workspace | null; client: NekiroApiClient; initialLookup?: LedgerIntent; onReadSuccess?: (workspaceId: string) => void}) {
  const [invocationId, setInvocationId] = useState('');
  const [traceId, setTraceId] = useState('');
  const [detail, setDetail] = useState<InvocationDetailResponseV4 | null>(null);
  const [trace, setTrace] = useState<TraceResponseV4 | null>(null);
  const [error, setError] = useState<PlatformErrorView | null>(null);
  const [loading, setLoading] = useState(false);
  const requestGeneration = useRef(0);
  const appliedLookupSequence = useRef<number | null>(null);

  const read = useCallback(async (kind: 'invocation' | 'trace', explicitId?: string) => {
    if (!workspace) {
      setError({status: 0, code: 'CONFIGURATION_ERROR', message: 'Select the active Workspace first.'});
      return;
    }
    const requestedId = explicitId ?? (kind === 'invocation' ? invocationId : traceId);
    if (!requestedId) return;
    const generation = nextRequestGeneration(requestGeneration.current);
    requestGeneration.current = generation;
    const workspaceId = workspace.workspaceId;
    setLoading(true);
    setError(null);
    setDetail(null);
    setTrace(null);
    try {
      if (kind === 'invocation') {
        const value = await client.getInvocation(workspaceId, requestedId);
        if (isCurrentRequest(generation, requestGeneration.current)) {
          setDetail(value);
          onReadSuccess?.(workspaceId);
        }
      } else {
        const value = await client.getTrace(workspaceId, requestedId);
        if (isCurrentRequest(generation, requestGeneration.current)) {
          setTrace(value);
          onReadSuccess?.(workspaceId);
        }
      }
    } catch (value) {
      if (isCurrentRequest(generation, requestGeneration.current)) setError(toPlatformErrorView(value, 'Ledger read failed.'));
    } finally {
      if (isCurrentRequest(generation, requestGeneration.current)) setLoading(false);
    }
  }, [client, invocationId, onReadSuccess, traceId, workspace]);

  useEffect(() => {
    requestGeneration.current = nextRequestGeneration(requestGeneration.current);
    setLoading(false);
    setDetail(null);
    setTrace(null);
    setError(null);
  }, [workspace?.workspaceId]);

  useEffect(() => {
    if (!workspace || !initialLookup || appliedLookupSequence.current === initialLookup.sequence) return;
    appliedLookupSequence.current = initialLookup.sequence;
    if (initialLookup.kind === 'invocation') setInvocationId(initialLookup.id);
    else setTraceId(initialLookup.id);
    void read(initialLookup.kind, initialLookup.id);
  }, [initialLookup, read, workspace]);

  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <div className="font-mono-label text-[10px] uppercase tracking-[0.24em] text-brand-primary mb-2">Trace</div>
        <h2 className="text-2xl font-bold text-brand-on-surface">Understand what happened</h2>
        <p className="text-sm text-brand-on-surface-variant mt-1 max-w-3xl">Open a result directly from Invoke or read an exact Invocation/Trace. Only metadata and immutable provenance are shown.</p>
      </div>
      <div className="glass-split-grid grid grid-cols-[minmax(340px,0.8fr)_minmax(420px,1.2fr)] gap-5 flex-1 min-h-0">
        <section className="bg-brand-low border border-brand-outline-variant rounded-xl p-5 h-fit">
          <div className="flex items-center gap-2 text-sm font-bold mb-4"><Search size={16} className="text-brand-primary" /> Read exact metadata</div>
          <label htmlFor="ledger-invocation-id" className="block text-xs text-brand-on-surface-variant mb-1">Invocation ID</label>
          <div className="flex gap-2"><input id="ledger-invocation-id" value={invocationId} onChange={(event) => setInvocationId(event.target.value)} disabled={loading} placeholder="inv-..." className="min-w-0 flex-1 rounded-lg border border-brand-outline-variant bg-brand-lowest px-3 py-2 font-mono-code text-xs text-brand-on-surface outline-none disabled:opacity-40" /><button disabled={!workspace || !invocationId || loading} onClick={() => void read('invocation')} className="rounded-lg border border-brand-outline-variant px-3 text-xs text-brand-on-surface hover:bg-brand-high disabled:opacity-40">Read</button></div>
          <label htmlFor="ledger-trace-id" className="block text-xs text-brand-on-surface-variant mt-4 mb-1">Trace ID</label>
          <div className="flex gap-2"><input id="ledger-trace-id" value={traceId} onChange={(event) => setTraceId(event.target.value)} disabled={loading} placeholder="trace-..." className="min-w-0 flex-1 rounded-lg border border-brand-outline-variant bg-brand-lowest px-3 py-2 font-mono-code text-xs text-brand-on-surface outline-none disabled:opacity-40" /><button disabled={!workspace || !traceId || loading} onClick={() => void read('trace')} className="rounded-lg border border-brand-outline-variant px-3 text-xs text-brand-on-surface hover:bg-brand-high disabled:opacity-40">Read</button></div>
          {loading && <div className="mt-4 flex items-center gap-2 text-xs text-brand-on-surface-variant"><LoaderCircle size={14} className="animate-spin" /> Reading Router Ledger...</div>}
          {error && <div className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-xs text-red-200"><ShieldAlert size={14} className="inline mr-2" />{error.message}</div>}
        </section>
        <section className="bg-brand-low border border-brand-outline-variant rounded-xl overflow-hidden min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b border-brand-outline-variant/60 flex items-center gap-2"><BookOpen size={15} className="text-brand-primary" /><span className="text-xs font-bold">Trace timeline</span></div>
          <div className="p-4 overflow-auto flex-1">{detail && <Detail detail={detail} />}{trace && <Trace trace={trace} />}{!detail && !trace && !loading && !error && <div className="h-full flex items-center justify-center text-sm text-brand-on-surface-variant">Open a correlated result or enter an exact ID.</div>}</div>
        </section>
      </div>
    </div>
  );
}

function Detail({detail}: {detail: InvocationDetailResponseV4}) {
  return <div className="space-y-4"><Record record={detail.invocation} /><div className="text-xs font-semibold flex items-center gap-2"><GitBranch size={13} /> committed events</div>{detail.events.map((event) => <div key={event.eventId} className="rounded-lg border border-brand-outline-variant bg-brand-lowest p-3 text-xs"><div className="font-mono-code text-brand-primary">#{event.sequence} {event.type}</div><div className="mt-1 text-brand-on-surface-variant">{event.status} / {event.occurredAt}</div>{event.error && <div className="mt-1 text-red-200">{event.error.code}</div>}</div>)}</div>;
}

function Trace({trace}: {trace: TraceResponseV4}) {
  const byId = new Map(trace.invocations.map((record) => [record.invocationId, record]));
  return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-on-surface-variant"><span>Trace <span className="font-mono-code text-brand-on-surface">{trace.traceId}</span> / {trace.invocations.length} invocation(s)</span><CopyButton value={trace.traceId} label="Copy trace ID" /></div>{trace.invocations.map((record) => <div key={record.invocationId} style={{paddingLeft: `${Math.min(traceDepth(record, byId), 6) * 20}px`}} className="relative"><Record record={record} /></div>)}</div>;
}

function traceDepth(record: InvocationRecordV4, byId: Map<string, InvocationRecordV4>): number {
  let depth = 0;
  let parentId = record.parentInvocationId;
  const visited = new Set<string>([record.invocationId]);
  while (parentId && depth < 6 && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = byId.get(parentId)?.parentInvocationId;
  }
  return depth;
}

function Record({record}: {record: InvocationRecordV4}) {
  return <div className="rounded-lg border border-brand-outline-variant bg-brand-lowest p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono-code text-xs text-brand-primary">{record.invocationId}</span><div className="flex items-center gap-2"><span className="text-[10px] uppercase text-brand-on-surface-variant">{record.status}</span><CopyButton value={record.invocationId} label="Copy invocation ID" /></div></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-brand-on-surface-variant"><span>Root task <b className="font-mono-code text-brand-on-surface">{record.rootTaskId}</b></span><span>Parent <b className="font-mono-code text-brand-on-surface">{record.parentInvocationId ?? 'root'}</b></span><span>Caller <b className="font-mono-code text-brand-on-surface">{record.caller.type}:{record.caller.id}</b></span><span>Workspace <b className="font-mono-code text-brand-on-surface">{record.workspaceId}</b></span><span>Agent <b className="font-mono-code text-brand-on-surface">{record.targetAgentId}</b></span><span>Card <b className="font-mono-code text-brand-on-surface">{record.agentCardVersion}</b></span><span>Release <b className="font-mono-code text-brand-on-surface">{record.agentReleaseId}</b></span><span>Card digest <b className="font-mono-code text-brand-on-surface">{record.agentCardDigest}</b></span><span>Capability <b className="font-mono-code text-brand-on-surface">{record.capability}</b></span><span>Latency <b className="font-mono-code text-brand-on-surface">{record.latencyMs === undefined ? 'n/a' : record.latencyMs + ' ms'}</b></span><span>Trace <b className="font-mono-code text-brand-on-surface">{record.traceId}</b></span><span>Created <b className="font-mono-code text-brand-on-surface">{record.createdAt}</b></span>{record.errorCode && <span>Error <b className="font-mono-code text-red-200">{record.errorCode}</b></span>}</div></div>;
}
