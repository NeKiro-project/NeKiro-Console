import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';

import Header from './Header';
import Sidebar from './Sidebar';
import type {Workspace} from '../types';

const workspace: Workspace = {
  workspaceId: 'ws-contract',
  ownerId: 'owner.contract',
  createdAt: '2026-08-16T00:00:00Z',
  updatedAt: '2026-08-16T00:00:00Z',
};

test('Sidebar exposes the five surfaces plus Settings and Support by exact name', () => {
  const markup = renderToStaticMarkup(
    <Sidebar activeTab="registry" setActiveTab={() => {}} onOpenSettings={() => {}} onOpenSupport={() => {}} />,
  );
  for (const name of ['Registry', 'Trusted Publication', 'Installations', 'Invocations', 'Ledger', 'Settings', 'Support']) {
    assert.match(markup, new RegExp(`aria-label="${name}"`), `expected nav entry "${name}"`);
  }
  assert.match(markup, /NeKiro/);
  assert.match(markup, /Agent Control Plane/);
});

test('Header renders the exact Gateway and Workspace status contract strings', () => {
  const markup = renderToStaticMarkup(
    <Header
      searchQuery=""
      setSearchQuery={() => {}}
      searchPlaceholder="Search agent name, description, capability..."
      workspace={workspace}
      workspaceDraft={workspace.workspaceId}
      setWorkspaceDraft={() => {}}
      workspaceLoading={false}
      workspaceError={null}
      onReadWorkspace={() => {}}
      onCreateWorkspace={() => {}}
      userLabel="owner.contract"
      apiConfigured={true}
    />,
  );
  assert.match(markup, /API: configured/);
  assert.match(markup, new RegExp(`Workspace: ${workspace.workspaceId}`));
  assert.match(markup, /placeholder="workspace id"/);
  assert.match(markup, /aria-label="Create workspace"/);
  assert.match(markup, />Load</);
  assert.match(markup, />Create</);
});
