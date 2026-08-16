import React, {useEffect, useState} from 'react';
import {Loader2, ShieldCheck} from 'lucide-react';

import {toPlatformErrorView, validatePublicInstallation, type NekiroApiClient, type PublicAgentRelease, type PublicAgentShare} from '../api/nekiro';
import {parsePublicAgentUrl} from '../publicAgentUrl';
import type {PlatformErrorView, Workspace} from '../types';
import {ErrorBanner, Fact, SectionLabel} from './ui';

interface PublicAgentInstallPanelProps {
  client: NekiroApiClient;
  workspace: Workspace | null;
  onInstalled?: () => Promise<void> | void;
  initialUrl?: string;
}

export default function PublicAgentInstallPanel({client, workspace, onInstalled, initialUrl = ''}: PublicAgentInstallPanelProps) {
  const [url, setUrl] = useState(initialUrl);
  const [share, setShare] = useState<PublicAgentShare | null>(null);
  const [selectedReleaseID, setSelectedReleaseID] = useState('');
  const [acceptedPermissions, setAcceptedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [installedReleaseID, setInstalledReleaseID] = useState('');
  const [error, setError] = useState<PlatformErrorView | null>(null);
  const selectedRelease = share?.releases.find((release) => release.releaseId === selectedReleaseID);

  const resolveURL = async (candidate: string) => {
    setLoading(true);
    setError(null);
    setShare(null);
    setSelectedReleaseID('');
    setAcceptedPermissions([]);
    setInstalledReleaseID('');
    try {
      const publicAgentID = parsePublicAgentUrl(candidate, import.meta.env.VITE_NEKIRO_PUBLIC_AGENT_ORIGIN);
      const value = await client.resolvePublicAgent(publicAgentID);
      setShare(value);
    } catch (value) {
      setError(toPlatformErrorView(value, 'Unable to resolve this canonical Public Agent URL.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialUrl) void resolveURL(initialUrl);
  // The initial direct-route URL is resolved exactly once for each route value.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const resolve = (event: React.FormEvent) => {
    event.preventDefault();
    void resolveURL(url);
  };

  const install = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspace || !selectedRelease) return;
    setSubmitting(true);
    setError(null);
    try {
      const installation = await client.installAgent(workspace.workspaceId, {
        agentId: selectedRelease.agentId,
        versionConstraint: selectedRelease.agentCardVersion,
        acceptedPermissions,
      });
      validatePublicInstallation(installation, selectedRelease, workspace.workspaceId, acceptedPermissions);
      setInstalledReleaseID(selectedRelease.releaseId);
      await onInstalled?.();
    } catch (value) {
      setError(toPlatformErrorView(value, 'Unable to install the selected exact trusted Release.'));
    } finally {
      setSubmitting(false);
    }
  };

  const togglePermission = (permissionID: string) => setAcceptedPermissions((current) => current.includes(permissionID)
    ? current.filter((item) => item !== permissionID)
    : [...current, permissionID].sort());

  return (
    <section className="panel space-y-4 p-4">
      <div>
        <SectionLabel className="text-accent">Public Share</SectionLabel>
        <h3 className="mt-1.5 text-[15px] font-semibold text-fg">Install from a canonical NeKiro URL</h3>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fg-faint">This public URL is discovery metadata, never an Agent endpoint or invitation secret.</p>
      </div>
      <form onSubmit={resolve} className="flex gap-2">
        <input aria-label="Public Agent URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://agents.nekiro.dev/a/agt_..." className="field min-w-0 flex-1 font-mono text-[12px]" />
        <button disabled={loading || !url} className="btn">{loading ? 'Resolving...' : 'Resolve'}</button>
      </form>
      {error && <ErrorBanner error={error} />}
      {share && (
        <div className="space-y-4">
          <div className="rounded border border-line bg-ink-900 p-3">
            <div className={`text-[12.5px] font-semibold ${share.availability === 'installable' ? 'text-ok' : 'text-fg-muted'}`}>
              {share.availability === 'installable' ? 'Installable trusted Releases' : 'Not currently installable'}
            </div>
            <div className="mt-1 font-mono text-[11px] text-fg-muted">{share.publicAgentId}</div>
            <div className="mt-1 font-mono text-[10.5px] text-fg-faint">Registered {share.registeredAt}</div>
          </div>
          {share.availability === 'not_installable' ? (
            <div className="text-[12.5px] text-fg-muted">No published trusted Release is available. Draft Card details remain private.</div>
          ) : (
            <form onSubmit={install} className="space-y-3">
              <label className="flex flex-col gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
                Select one exact Release (required)
                <select aria-label="Exact public Release" value={selectedReleaseID} onChange={(event) => { setSelectedReleaseID(event.target.value); setAcceptedPermissions([]); setInstalledReleaseID(''); }} className="field font-mono text-[12px]">
                  <option value="">Select a Release</option>
                  {share.releases.map((release) => <option key={release.releaseId} value={release.releaseId}>{release.name} · {release.agentCardVersion} · {release.releaseId}</option>)}
                </select>
              </label>
              {selectedRelease && <ReleaseReview release={selectedRelease} acceptedPermissions={acceptedPermissions} togglePermission={togglePermission} />}
              {!workspace && <div className="rounded border border-accent-line/60 bg-accent-soft/60 p-3 text-[12px] text-accent-bright">Authenticate and select an authorized Workspace before installation.</div>}
              <button disabled={!workspace || !selectedRelease || submitting} className="btn btn-primary h-8 w-full justify-center">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}Install exact Release
              </button>
              {installedReleaseID && (
                <div className="rounded border border-ok/30 bg-ok-soft p-3 text-[12.5px] text-ok">Installed exact Release <span className="font-mono">{installedReleaseID}</span>.</div>
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}

function ReleaseReview({release, acceptedPermissions, togglePermission}: {release: PublicAgentRelease; acceptedPermissions: string[]; togglePermission: (id: string) => void}) {
  return (
    <div className="space-y-2.5 rounded border border-line bg-ink-900 p-3">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Fact label="Agent" value={release.name} monoValue={false} />
        <Fact label="Version" value={release.agentCardVersion} />
        <Fact label="Release" value={release.releaseId} />
        <Fact label="Card digest" value={release.cardDigest} />
        <Fact label="Owner" value={`${release.owner.displayName} (${release.owner.id})`} />
        <Fact label="Published" value={release.publishedAt} />
      </div>
      <div className="border-t border-line pt-2.5">
        <SectionLabel className="mb-2">Declared permissions</SectionLabel>
        {release.permissions.length === 0 ? (
          <div className="text-[12px] text-fg-faint">No permissions declared.</div>
        ) : (
          <div className="space-y-1.5">
            {release.permissions.map((permission) => (
              <label key={permission.id} className={`flex cursor-pointer items-start gap-2.5 rounded border px-2.5 py-2 transition-colors duration-100 ${acceptedPermissions.includes(permission.id) ? 'border-accent-line bg-accent-soft' : 'border-line hover:border-line-strong'}`}>
                <input type="checkbox" checked={acceptedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} className="mt-0.5 h-3.5 w-3.5 accent-sky-400" />
                <span className="min-w-0">
                  <span className={`block font-mono text-[11px] ${acceptedPermissions.includes(permission.id) ? 'text-accent-bright' : 'text-fg'}`}>{permission.id}</span>
                  <span className="mt-0.5 block text-[11.5px] leading-relaxed text-fg-muted">{permission.description}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
