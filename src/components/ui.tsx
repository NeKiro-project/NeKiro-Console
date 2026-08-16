import {useState, type ReactNode} from 'react';
import {AlertTriangle, Check, Copy} from 'lucide-react';
import type {PlatformErrorView} from '../types';

/* ---------------------------------------------------------------------------
   Shared instrument primitives — every surface composes from these.
   ------------------------------------------------------------------------ */

export function SectionLabel({children, className = ''}: {children: ReactNode; className?: string}) {
  return <div className={`mono-label ${className}`}>{children}</div>;
}

export function Mono({children, className = ''}: {children: ReactNode; className?: string}) {
  return <span className={`font-mono ${className}`}>{children}</span>;
}

export function Skeleton({className = ''}: {className?: string}) {
  return <div className={`skeleton ${className}`} />;
}

export type Tone = 'ok' | 'warn' | 'danger' | 'accent' | 'neutral' | 'faint';

const dotTones: Record<Tone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  accent: 'bg-accent',
  neutral: 'bg-slate-400',
  faint: 'bg-slate-600',
};

export function StatusDot({tone, live = false}: {tone: Tone; live?: boolean}) {
  return <span className={`status-dot ${dotTones[tone]} ${live ? 'live' : ''}`} aria-hidden="true" />;
}

const badgeTones: Record<Tone, string> = {
  ok: 'border-ok/35 bg-ok-soft text-ok',
  warn: 'border-warn/35 bg-warn-soft text-warn',
  danger: 'border-danger/35 bg-danger-soft text-danger',
  accent: 'border-accent-line bg-accent-soft text-accent-bright',
  neutral: 'border-line bg-ink-800 text-fg-muted',
  faint: 'border-line bg-transparent text-fg-faint',
};

const statusTone: Record<string, Tone> = {
  published: 'ok',
  verified: 'ok',
  enabled: 'ok',
  succeeded: 'ok',
  pending: 'warn',
  pending_verification: 'warn',
  running: 'accent',
  suspended: 'warn',
  revoked: 'danger',
  failed: 'danger',
  error: 'danger',
  timed_out: 'danger',
  canceled: 'danger',
  draft: 'neutral',
  disabled: 'faint',
  uninstalled: 'faint',
};

export function StatusBadge({status, live = false}: {status: string; live?: boolean}) {
  const tone = statusTone[status] ?? 'neutral';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-px font-mono text-[10px] font-medium uppercase tracking-wider ${badgeTones[tone]}`}>
      <StatusDot tone={tone} live={live} />
      {status}
    </span>
  );
}

export function ErrorBanner({error}: {error: PlatformErrorView | null}) {
  if (!error) return null;
  return (
    <div className="panel flex items-start gap-3 border-danger/30 bg-danger-soft p-3" role="alert">
      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-danger" />
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-danger">
          {error.code ?? 'ERROR'} / HTTP {error.status}
        </div>
        <div className="mt-1 text-[12.5px] text-fg-muted">{error.message}</div>
        {error.traceId && (
          <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] text-fg-faint">
            <span>traceId: {error.traceId}</span>
            <CopyButton text={error.traceId} />
          </div>
        )}
      </div>
    </div>
  );
}

export function CopyButton({text}: {text: string}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost inline-flex h-5 items-center gap-1 rounded px-1.5 font-mono text-[10px]"
      onClick={() => {
        void navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={`Copy ${text}`}
    >
      {copied ? <Check size={11} className="text-ok" /> : <Copy size={11} />}
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

export function EmptyState({title, message, children}: {title: string; message: string; children?: ReactNode}) {
  return (
    <div className="panel-flat flex min-h-28 flex-col items-center justify-center gap-2 p-8 text-center">
      <div className="mono-label">{title}</div>
      <p className="max-w-md text-[12.5px] leading-relaxed text-fg-faint">{message}</p>
      {children}
    </div>
  );
}

/** Label/value fact row. e2e `readFactValue` relies on this shape: parent div, first child = exact label text, second child = value. */
export function Fact({label, value, monoValue = true}: {label: string; value: ReactNode; monoValue?: boolean}) {
  const raw = typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 py-1.5">
      <div className="shrink-0 text-[11px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div title={raw} className={`min-w-0 truncate text-right text-[12px] text-fg ${monoValue ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

export function PageHeader({eyebrow, title, description, children}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <SectionLabel>{eyebrow}</SectionLabel>
        <h1 className="mt-1.5 text-[21px] font-semibold leading-tight tracking-tight text-fg">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-fg-muted">{description}</p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

export function PanelHeader({label, children}: {label: string; children?: ReactNode}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
      <SectionLabel>{label}</SectionLabel>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
