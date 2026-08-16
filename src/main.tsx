import {Component, lazy, StrictMode, Suspense, useSyncExternalStore, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';

import App from './App.tsx';
import PublicAgentPage from './components/PublicAgentPage.tsx';
import {requirePublicConsoleConfiguration} from './consoleConfig.ts';
import {demoFromHash, type DemoId} from './demos/routing';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

const DemoRoot = lazy(() => import('./demos/DemoRoot.tsx'));

function useHash(): string {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener('hashchange', callback);
      return () => window.removeEventListener('hashchange', callback);
    },
    () => window.location.hash,
  );
}

function Root() {
  const hash = useHash();
  const demo = demoFromHash(hash);
  if (demo) return <Suspense fallback={<DemoLoading />}><DemoRoot demo={demo as DemoId} /></Suspense>;
  if (window.location.pathname.startsWith('/a/')) {
    requirePublicConsoleConfiguration(import.meta.env);
    return <ConfigurationBoundary><PublicAgentPage /></ConfigurationBoundary>;
  }
  return <ConfigurationBoundary><App /></ConfigurationBoundary>;
}

class ConfigurationBoundary extends Component<{children: ReactNode}, {error: Error | null}> {
  props!: {children: ReactNode};
  state: {error: Error | null} = {error: null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Configuration errors are rendered explicitly; no API fallback is used.
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 grid place-items-center bg-ink-950 p-6">
          <div className="app-grid" aria-hidden="true" />
          <div className="relative panel max-w-lg border-danger/30 bg-ink-900 p-6">
            <div className="mono-label mb-2 text-danger">Startup error</div>
            <h1 className="text-[16px] font-semibold text-fg">Console startup error</h1>
            <p className="mt-2 font-mono text-[12px] leading-relaxed text-danger">{this.state.error.message}</p>
            <p className="mt-4 text-[12px] leading-relaxed text-fg-muted">Set the exact Gateway origin, provider and Workspace-owner credentials, and VITE_NEKIRO_DEFAULT_WORKSPACE_ID, then reload.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function DemoLoading() {
  return <div className="fixed inset-0 grid place-items-center bg-ink-950 font-mono text-[11px] uppercase tracking-wider text-fg-faint">Loading demo...</div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
