import {BookOpen, CheckCircle2, Cpu, Database, PlayCircle, ShieldCheck} from 'lucide-react';

import type {ConsoleTab} from '../types';

interface JourneyBarProps {
  activeTab: ConsoleTab;
  onNavigate: (tab: ConsoleTab) => void;
  agentCount: number;
  hasPublishedRelease: boolean;
  enabledInstallationCount: number;
  hasCorrelation: boolean;
  traceComplete: boolean;
}

export default function JourneyBar({activeTab, onNavigate, agentCount, hasPublishedRelease, enabledInstallationCount, hasCorrelation, traceComplete}: JourneyBarProps) {
  const steps = [
    {id: 'registry', label: 'Agents', detail: agentCount > 0 ? `${agentCount} visible` : 'Register or discover', icon: Database, complete: agentCount > 0},
    {id: 'trusted', label: 'Publish', detail: hasPublishedRelease ? 'Release selected' : 'Verify trust', icon: ShieldCheck, complete: hasPublishedRelease},
    {id: 'installations', label: 'Install', detail: enabledInstallationCount > 0 ? `${enabledInstallationCount} enabled` : 'Authorize access', icon: Cpu, complete: enabledInstallationCount > 0},
    {id: 'invocations', label: 'Invoke', detail: enabledInstallationCount > 0 ? 'Ready to call' : 'Needs installation', icon: PlayCircle, complete: hasCorrelation},
    {id: 'ledger', label: 'Trace', detail: traceComplete ? 'Trace inspected' : hasCorrelation ? 'Correlation ready' : 'Inspect results', icon: BookOpen, complete: traceComplete},
  ] as const;

  return (
    <section aria-label="NeKiro lifecycle" className="mb-5 overflow-x-auto rounded-xl border border-brand-outline-variant bg-brand-low p-2">
      <ol className="grid min-w-[760px] grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = step.id === activeTab;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onNavigate(step.id)}
                aria-current={active ? 'step' : undefined}
                data-journey-step={step.id}
                data-complete={step.complete}
                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-brand-primary/40 bg-brand-primary-container/20' : 'border-transparent hover:border-brand-outline-variant hover:bg-brand-container'}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${active ? 'bg-brand-primary text-white' : 'bg-brand-container text-brand-on-surface-variant'}`}>
                  {step.complete ? <CheckCircle2 size={15} /> : <Icon size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-brand-on-surface-variant">Step {index + 1}</span>
                  <span className="block text-xs font-semibold text-brand-on-surface">{step.label}</span>
                  <span className="block truncate text-[10px] text-brand-on-surface-variant">{step.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
