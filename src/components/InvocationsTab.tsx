import React from 'react';
import {Clock3, LockKeyhole, Route, ServerCog} from 'lucide-react';

import {INVOCATION_CONTRACT_ENDPOINTS} from '../data';
import type {Workspace} from '../types';

interface InvocationsTabProps {
  workspace: Workspace | null;
}

export default function InvocationsTab({workspace}: InvocationsTabProps) {
  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <div className="font-mono-label text-[10px] uppercase tracking-[0.24em] text-brand-primary mb-2">Invocations</div>
        <h2 className="text-2xl font-bold text-brand-on-surface">Invoke Runtime Gated</h2>
        <p className="text-sm text-brand-on-surface-variant mt-1 max-w-3xl">
          This Console MVP intentionally does not fabricate Agent executions. Invocation Dispatch, the A2A Router, and transient result transport are waiting on the backend headless Invoke to Record slice.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)] gap-5 flex-1 min-h-0">
        <section className="bg-brand-low border border-brand-outline-variant rounded-xl p-5 h-fit">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-brand-primary/10 border border-brand-primary/25 flex items-center justify-center text-brand-primary">
              <LockKeyhole size={20} />
            </div>
            <div>
              <div className="text-sm font-bold text-brand-on-surface">Backend capability not connected</div>
              <div className="text-xs text-brand-on-surface-variant">No mock task, fake stream, or fabricated timeout will be rendered.</div>
            </div>
          </div>
          <div className="space-y-3 text-sm text-brand-on-surface-variant">
            <p>Current Workspace: <span className="font-mono-code text-brand-on-surface">{workspace?.workspaceId ?? 'not selected'}</span></p>
            <p>The UI will become live only after Gateway Invocation Dispatch can authorize an installed Agent and hand execution to the separate A2A Router process.</p>
          </div>
        </section>

        <section className="bg-brand-low border border-brand-outline-variant rounded-xl overflow-hidden min-h-0 flex flex-col">
          <div className="px-4 py-3 border-b border-brand-outline-variant/60 flex items-center gap-2">
            <Route size={15} className="text-brand-primary" />
            <span className="text-xs font-bold text-brand-on-surface">Future Northbound contracts</span>
          </div>
          <div className="p-4 space-y-3">
            {INVOCATION_CONTRACT_ENDPOINTS.map((endpoint) => (
              <div key={endpoint} className="bg-brand-lowest border border-brand-outline-variant rounded p-3">
                <div className="font-mono-code text-[12px] text-brand-primary">{endpoint}</div>
              </div>
            ))}
          </div>
          <div className="mt-auto border-t border-brand-outline-variant/40 p-4 grid grid-cols-3 gap-3 text-xs">
            <Fact icon={<ServerCog size={14} />} label="Dispatch" value="backend gated" />
            <Fact icon={<Clock3 size={14} />} label="Result mode" value="JSON / SSE later" />
            <Fact icon={<LockKeyhole size={14} />} label="Mock policy" value="disabled" />
          </div>
        </section>
      </div>
    </div>
  );
}

function Fact({icon, label, value}: {icon: React.ReactNode; label: string; value: string}) {
  return (
    <div className="bg-brand-lowest border border-brand-outline-variant rounded p-3">
      <div className="flex items-center gap-2 text-brand-on-surface-variant mb-2">
        {icon}
        <span className="uppercase tracking-wider text-[10px]">{label}</span>
      </div>
      <div className="font-mono-code text-[11px] text-brand-on-surface">{value}</div>
    </div>
  );
}
