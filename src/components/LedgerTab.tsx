import {BookOpen, DatabaseZap, GitBranch, LockKeyhole} from 'lucide-react';

import {INVOCATION_CONTRACT_ENDPOINTS, LEDGER_CONTRACT_FACTS} from '../data';
import type {Workspace} from '../types';

interface LedgerTabProps {
  workspace: Workspace | null;
}

export default function LedgerTab({workspace}: LedgerTabProps) {
  return (
    <div className="h-full flex flex-col gap-5">
      <div>
        <div className="font-mono-label text-[10px] uppercase tracking-[0.24em] text-brand-primary mb-2">Ledger</div>
        <h2 className="text-2xl font-bold text-brand-on-surface">Record Runtime Gated</h2>
        <p className="text-sm text-brand-on-surface-variant mt-1 max-w-3xl">
          Ledger UI is contract-aware only in this MVP. It does not show simulated traces, sample timeout trees, or mock event timelines as platform facts.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(420px,1fr)_minmax(420px,1fr)] gap-5 flex-1 min-h-0">
        <section className="bg-brand-low border border-brand-outline-variant rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-outline-variant/60 flex items-center gap-2">
            <BookOpen size={15} className="text-brand-primary" />
            <span className="text-xs font-bold text-brand-on-surface">MVP boundary</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-brand-lowest border border-brand-outline-variant rounded p-4">
              <div className="text-xs uppercase tracking-wider text-brand-on-surface-variant mb-2">Current Workspace</div>
              <div className="font-mono-code text-sm text-brand-on-surface">{workspace?.workspaceId ?? 'not selected'}</div>
            </div>
            {LEDGER_CONTRACT_FACTS.map((fact) => (
              <div key={fact} className="flex items-start gap-3 text-sm text-brand-on-surface-variant">
                <LockKeyhole size={15} className="text-brand-primary mt-0.5 shrink-0" />
                <span>{fact}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-brand-low border border-brand-outline-variant rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-outline-variant/60 flex items-center gap-2">
            <GitBranch size={15} className="text-brand-primary" />
            <span className="text-xs font-bold text-brand-on-surface">Future metadata-only read surfaces</span>
          </div>
          <div className="p-5 space-y-3">
            {INVOCATION_CONTRACT_ENDPOINTS.filter((endpoint) => endpoint.startsWith('GET')).map((endpoint) => (
              <div key={endpoint} className="bg-brand-lowest border border-brand-outline-variant rounded p-3">
                <div className="font-mono-code text-[12px] text-brand-primary">{endpoint}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-brand-outline-variant/40 p-5">
            <div className="flex items-start gap-3 text-sm text-brand-on-surface-variant">
              <DatabaseZap size={17} className="text-brand-primary mt-0.5 shrink-0" />
              <span>When the backend Ledger lands, this page should read metadata-only invocation lineage and must continue to avoid Agent input/output payload persistence.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
