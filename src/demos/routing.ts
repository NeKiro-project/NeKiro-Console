export type DemoId = 'launcher' | 'glass' | 'terminal' | 'saas';

export function demoFromHash(hash: string): DemoId | null {
  if (!hash.startsWith('#/demo')) return null;
  if (hash.includes('glass')) return 'glass';
  if (hash.includes('terminal')) return 'terminal';
  if (hash.includes('saas')) return 'saas';
  return 'launcher';
}
