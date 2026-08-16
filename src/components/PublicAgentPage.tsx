import React, {useEffect, useMemo, useState} from 'react';

import {NekiroApiClient, toPlatformErrorView} from '../api/nekiro';
import type {PlatformErrorView, Workspace} from '../types';
import PublicAgentInstallPanel from './PublicAgentInstallPanel';
import {ErrorBanner} from './ui';

export default function PublicAgentPage() {
  const ownerToken = import.meta.env.VITE_NEKIRO_OWNER_TOKEN;
  const defaultWorkspaceID = import.meta.env.VITE_NEKIRO_DEFAULT_WORKSPACE_ID;
  const hasOwnerContext = typeof ownerToken === 'string' && ownerToken !== '' && typeof defaultWorkspaceID === 'string' && defaultWorkspaceID !== '';
  const client = useMemo(() => new NekiroApiClient({
    baseUrl: import.meta.env.VITE_NEKIRO_API_BASE_URL,
    publicAgentOrigin: import.meta.env.VITE_NEKIRO_PUBLIC_AGENT_ORIGIN,
    ...(hasOwnerContext ? {token: ownerToken} : {anonymousOnly: true}),
  }), [hasOwnerContext, ownerToken]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState<PlatformErrorView | null>(null);
  const initialURL = import.meta.env.VITE_NEKIRO_PUBLIC_AGENT_ORIGIN
    + window.location.pathname
    + window.location.search
    + window.location.hash;

  useEffect(() => {
    if (!hasOwnerContext) return;
    let active = true;
    void client.getWorkspace(defaultWorkspaceID).then((value) => {
      if (active) setWorkspace(value);
    }).catch((value) => {
      if (active) setWorkspaceError(toPlatformErrorView(value, 'Unable to load the configured Workspace owner context.'));
    });
    return () => { active = false; };
  }, [client, defaultWorkspaceID, hasOwnerContext]);

  return (
    <main className="min-h-screen bg-ink-950 p-6 md:p-12">
      <div className="app-grid" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl space-y-5">
        <header>
          <div className="mono-label text-accent">NeKiro Public Agent</div>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-fg">Review a shared Agent</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-fg-muted">Resolve public trusted publication facts, then explicitly select one exact Release and its permissions.</p>
        </header>
        {workspaceError && <ErrorBanner error={workspaceError} />}
        <PublicAgentInstallPanel client={client} workspace={workspace} initialUrl={initialURL} />
        {!hasOwnerContext && <a href="/" className="inline-flex text-[13px] text-accent-bright underline decoration-accent-line underline-offset-4">Open the authenticated Workspace Console</a>}
      </div>
    </main>
  );
}
