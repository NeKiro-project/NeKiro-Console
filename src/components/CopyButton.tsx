import {useState} from 'react';
import {Check, Copy} from 'lucide-react';

export default function CopyButton({value, label = 'Copy'}: {value: string; label?: string}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    setStatus('idle');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  const accessibleLabel = status === 'copied' ? `${label}: copied` : status === 'failed' ? `${label}: copy failed` : label;
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-brand-outline-variant bg-brand-container px-2 py-1 text-[10px] text-brand-on-surface-variant hover:text-brand-on-surface"
    >
      {status === 'copied' ? <Check size={12} /> : <Copy size={12} />}
      <span aria-live="polite">{status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : label}</span>
    </button>
  );
}
