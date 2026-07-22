import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  buildAgentCard,
  mapCatalogEntry,
  NekiroApiClient,
  NekiroApiError,
  type AgentCardV02,
  type CatalogEntry,
} from './nekiro';

const limits = {
  timeoutMs: 30_000,
  maxInputBytes: 1_048_576,
  maxOutputBytes: 1_048_576,
  streaming: true,
};

test('buildAgentCard converts registration fields into an Agent Card v0.2 payload', () => {
  const card = buildAgentCard({
    agentId: 'runtime.echo',
    name: 'Runtime Echo Agent',
    ownerId: 'team.platform',
    ownerDisplayName: 'Platform Team',
    description: 'Echoes structured input.',
    version: '1.0.0',
    endpoint: 'http://127.0.0.1:9000/a2a',
    authentication: 'none',
    permissions: [{id: 'READ_LOGS', description: 'Read logs.'}],
    capabilitiesJson: JSON.stringify({
      capabilities: [{
        id: 'runtime.echo',
        name: 'Runtime Echo',
        description: 'Echo input.',
        inputSchema: {type: 'object'},
        outputSchema: {type: 'object'},
        requiredPermissions: ['READ_LOGS'],
      }],
    }),
    limits,
  });

  assert.deepEqual(card, {
    schemaVersion: '0.2',
    agentId: 'runtime.echo',
    name: 'Runtime Echo Agent',
    description: 'Echoes structured input.',
    owner: {id: 'team.platform', displayName: 'Platform Team'},
    version: '1.0.0',
    protocol: {type: 'a2a', version: '0.3.0', transport: 'JSONRPC', endpoint: 'http://127.0.0.1:9000/a2a'},
    skills: [{
      id: 'runtime.echo',
      name: 'Runtime Echo',
      description: 'Echo input.',
      inputSchema: {type: 'object'},
      outputSchema: {type: 'object'},
      requiredPermissions: ['READ_LOGS'],
    }],
    authentication: {type: 'none'},
    permissions: [{id: 'READ_LOGS', description: 'Read logs.'}],
    limits,
  });
});

test('buildAgentCard rejects duplicate capabilities and undeclared required permissions', () => {
  assert.throws(
    () => buildAgentCard({
      agentId: 'runtime.echo',
      name: 'Runtime Echo',
      ownerId: 'team.platform',
      ownerDisplayName: 'Platform Team',
      description: 'Echoes structured input.',
      version: '1.0.0',
      endpoint: 'http://127.0.0.1:9000/a2a',
      authentication: 'none',
      permissions: [],
      capabilitiesJson: JSON.stringify({capabilities: [{id: 'same', name: 'Same', description: 'Same.', inputSchema: {}, outputSchema: {}, requiredPermissions: []}, {id: 'same', name: 'Same', description: 'Same.', inputSchema: {}, outputSchema: {}, requiredPermissions: []}]}),
      limits,
    }),
    /duplicate capability id/i,
  );

  assert.throws(
    () => buildAgentCard({
      agentId: 'runtime.echo',
      name: 'Runtime Echo',
      ownerId: 'team.platform',
      ownerDisplayName: 'Platform Team',
      description: 'Echoes structured input.',
      version: '1.0.0',
      endpoint: 'http://127.0.0.1:9000/a2a',
      authentication: 'none',
      permissions: [],
      capabilitiesJson: JSON.stringify({capabilities: [{id: 'runtime.echo', name: 'Echo', description: 'Echo.', inputSchema: {}, outputSchema: {}, requiredPermissions: ['READ_LOGS']}]}),
      limits,
    }),
    /not declared/i,
  );
});

test('mapCatalogEntry maps Catalog entries to the Console view model without deprecated state', () => {
  const card: AgentCardV02 = {
    schemaVersion: '0.2',
    agentId: 'runtime.disabled',
    name: 'Disabled Runtime',
    description: 'A disabled runtime.',
    owner: {id: 'team.platform', displayName: 'Platform Team'},
    version: '2.0.0',
    protocol: {type: 'a2a', version: '0.3.0', transport: 'JSONRPC', endpoint: 'http://127.0.0.1:9000/a2a'},
    skills: [
      {id: 'runtime.echo', name: 'Echo', description: 'Echoes input.', inputSchema: {type: 'object'}, outputSchema: {type: 'object'}, requiredPermissions: []},
      {id: 'runtime.inspect', name: 'Inspect', description: 'Inspects input.', inputSchema: {type: 'object'}, outputSchema: {type: 'object'}, requiredPermissions: []},
    ],
    authentication: {type: 'none'},
    permissions: [{id: 'READ_LOGS', description: 'Read logs.'}],
    limits,
  };
  const entry: CatalogEntry = {
    card,
    publicationStatus: 'disabled',
    registeredAt: '2026-07-14T00:00:00Z',
  };

  const agent = mapCatalogEntry(entry);

  assert.equal(agent.id, 'runtime.disabled');
  assert.equal(agent.owner, 'Platform Team');
  assert.equal(agent.ownerId, 'team.platform');
  assert.equal(agent.version, '2.0.0');
  assert.equal(agent.status, 'disabled');
  assert.deepEqual(agent.tags, ['runtime.echo', 'runtime.inspect']);
  assert.deepEqual(agent.permissions, [{id: 'READ_LOGS', description: 'Read logs.'}]);
  assert.equal(JSON.parse(agent.schema).agentId, 'runtime.disabled');
});

test('NekiroApiClient sends v3 Catalog search requests with auth and decodes platform errors', async () => {
  const requests: Array<{url: string; init?: RequestInit}> = [];
  const client = new NekiroApiClient({
    baseUrl: 'https://api.example.test/',
    token: 'test-token',
    fetchImpl: async (input, init) => {
      requests.push({url: String(input), init});
      return new Response(JSON.stringify({
        code: 'CONFLICT',
        message: 'The requested operation conflicts with current state.',
        traceId: 'trace-1',
      }), {
        status: 409,
        headers: {'Content-Type': 'application/json'},
      });
    },
  });

  await assert.rejects(
    () => client.searchAgents({query: 'echo'}),
    (error: unknown) => {
      assert.ok(error instanceof NekiroApiError);
      assert.equal(error.status, 409);
      assert.equal(error.code, 'CONFLICT');
      assert.equal(error.traceId, 'trace-1');
      return true;
    },
  );

  assert.equal(requests[0]?.url, 'https://api.example.test/v3/agents?query=echo');
  const headers = new Headers(requests[0]?.init?.headers);
  assert.equal(headers.get('Accept'), 'application/json');
  assert.equal(headers.get('Authorization'), 'Bearer test-token');
});

test('NekiroApiClient covers Workspace and Installation v3 paths', async () => {
  const requests: Array<{url: string; init?: RequestInit}> = [];
  const client = new NekiroApiClient({
    baseUrl: 'https://api.example.test',
    token: 'test-token',
    fetchImpl: async (input, init) => {
      requests.push({url: String(input), init});
      return new Response(JSON.stringify({items: []}), {status: 200});
    },
  });

  await client.listInstallations('workspace.alpha', {limit: 50, cursor: 'next'});

  assert.equal(requests[0]?.url, 'https://api.example.test/v3/workspaces/workspace.alpha/installations?limit=50&cursor=next');
});

test('NekiroApiClient constructs a strict v4 JSON invocation request', async () => {
  const requests: Array<{url: string; init?: RequestInit}> = [];
  const client = new NekiroApiClient({
    baseUrl: 'https://api.example.test',
    token: 'exact-token',
    fetchImpl: async (input, init) => {
      requests.push({url: String(input), init});
      return new Response(JSON.stringify({schemaVersion: '1', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1', status: 'succeeded', result: {ok: true}}), {status: 200});
    },
  });
  const result = await client.invoke('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {message: 'hello'}, stream: false});
  assert.deepEqual(result.result, {ok: true});
  assert.equal(requests[0]?.url, 'https://api.example.test/v4/workspaces/workspace.alpha/invocations');
  assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {agentId: 'runtime.echo', capability: 'runtime.echo', input: {message: 'hello'}, stream: false});
});

test('NekiroApiClient preserves correlated Platform Error v4 fields', async () => {
  const client = new NekiroApiClient({
    baseUrl: 'https://api.example.test',
    token: 'test-token',
    fetchImpl: async () => new Response(JSON.stringify({code: 'TIMEOUT', message: 'The invocation timed out.', traceId: 'trace-1', invocationId: 'inv-1', rootTaskId: 'task-1'}), {status: 504}),
  });
  await assert.rejects(() => client.invoke('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {}, stream: false}), (error: unknown) => {
    assert.ok(error instanceof NekiroApiError);
    assert.equal(error.code, 'TIMEOUT');
    assert.equal(error.traceId, 'trace-1');
    assert.equal(error.invocationId, 'inv-1');
    assert.equal(error.rootTaskId, 'task-1');
    return true;
  });
});

test('NekiroApiClient reads Workspace-scoped v4 Invocation and Trace paths', async () => {
  const requests: string[] = [];
  const record = {invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1', caller: {type: 'user', id: 'owner-a'}, workspaceId: 'workspace.alpha', targetAgentId: 'runtime.echo', agentCardVersion: '1.0.0', capability: 'runtime.echo', status: 'pending', createdAt: '2026-07-21T00:00:00Z', updatedAt: '2026-07-21T00:00:00Z'};
  const event = {schemaVersion: '0.3', eventId: 'evt-1', sequence: 0, occurredAt: '2026-07-21T00:00:00Z', type: 'created', status: 'pending', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1', caller: {type: 'user', id: 'owner-a'}, workspaceId: 'workspace.alpha', targetAgentId: 'runtime.echo', agentCardVersion: '1.0.0', capability: 'runtime.echo'};
  const client = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify(String(input).includes('/traces/') ? {traceId: 'trace-1', invocations: [record]} : {invocation: record, events: [event]}), {status: 200});
  }});
  await client.getInvocation('workspace.alpha', 'inv-1');
  await client.getTrace('workspace.alpha', 'trace-1');
  assert.deepEqual(requests, ['https://api.example.test/v4/workspaces/workspace.alpha/invocations/inv-1', 'https://api.example.test/v4/workspaces/workspace.alpha/traces/trace-1']);
});

test('NekiroApiClient validates ordered SSE events and requires a terminal event', async () => {
  const accepted = {schemaVersion: '2', sequence: 0, type: 'accepted', status: 'pending', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1'};
  const completed = {schemaVersion: '2', sequence: 1, type: 'completed', status: 'succeeded', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1'};
  const body = `data: ${JSON.stringify(accepted)}\n\ndata: ${JSON.stringify(completed)}\n\n`;
  const client = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async () => new Response(body, {status: 200, headers: {'Content-Type': 'text/event-stream'}})});
  const seen: number[] = [];
  const events = await client.invokeStream('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {}}, (event) => seen.push(event.sequence));
  assert.deepEqual(seen, [0, 1]);
  assert.equal(events[1]?.type, 'completed');

  const interrupted = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async () => new Response(`data: ${JSON.stringify(accepted)}\n\n`, {status: 200, headers: {'Content-Type': 'text/event-stream'}})});
  await assert.rejects(() => interrupted.invokeStream('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {}}), /ended before a terminal event/);
});

test('NekiroApiClient rejects SSE gaps, correlation changes, and mismatched terminal errors', async () => {
  const accepted = {schemaVersion: '2', sequence: 0, type: 'accepted', status: 'pending', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1'};
  const gap = {schemaVersion: '2', sequence: 2, type: 'completed', status: 'succeeded', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1'};
  const gapClient = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async () => new Response(`data: ${JSON.stringify(accepted)}\n\ndata: ${JSON.stringify(gap)}\n\n`, {status: 200, headers: {'Content-Type': 'text/event-stream'}})});
  await assert.rejects(() => gapClient.invokeStream('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {}}), /sequence is not contiguous/);

  const changed = {...gap, sequence: 1, traceId: 'trace-other'};
  const changedClient = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async () => new Response(`data: ${JSON.stringify(accepted)}\n\ndata: ${JSON.stringify(changed)}\n\n`, {status: 200, headers: {'Content-Type': 'text/event-stream'}})});
  await assert.rejects(() => changedClient.invokeStream('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {}}), /correlation changed/);

  const failed = {schemaVersion: '2', sequence: 1, type: 'failed', status: 'failed', invocationId: 'inv-1', rootTaskId: 'task-1', traceId: 'trace-1', error: {code: 'TIMEOUT', message: 'The invocation timed out.', traceId: 'trace-1', invocationId: 'inv-1', rootTaskId: 'task-1'}};
  const failedClient = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async () => new Response(`data: ${JSON.stringify(accepted)}\n\ndata: ${JSON.stringify(failed)}\n\n`, {status: 200, headers: {'Content-Type': 'text/event-stream'}})});
  await assert.rejects(() => failedClient.invokeStream('workspace.alpha', {agentId: 'runtime.echo', capability: 'runtime.echo', input: {}}), /failed stream event error code/);
});

test('NekiroApiClient rejects omitted Installation limits instead of inventing one', () => {
  const client = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token'});
  assert.throws(() => client.listInstallations('workspace.alpha', undefined as never), /limit must be an integer/);
});

test('NekiroApiClient rejects missing or whitespace bearer configuration', () => {
  assert.throws(() => new NekiroApiClient({baseUrl: 'https://api.example.test', token: ''}), /bearer token is required/);
  assert.throws(() => new NekiroApiClient({baseUrl: 'https://api.example.test', token: ' token'}), /must not contain whitespace/);
});

test('NekiroApiClient rejects an empty JSON success body', async () => {
  const client = new NekiroApiClient({baseUrl: 'https://api.example.test', token: 'test-token', fetchImpl: async () => new Response('', {status: 200})});
  await assert.rejects(() => client.searchAgents(), /empty success response/);
});
