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
    name: 'runtime.echo',
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

test('buildAgentCard rejects malformed or duplicate capabilities', () => {
  assert.throws(
    () => buildAgentCard({
      agentId: 'runtime.echo',
      ownerId: 'team.platform',
      ownerDisplayName: 'Platform Team',
      description: 'Echoes structured input.',
      version: '1.0.0',
      endpoint: 'http://127.0.0.1:9000/a2a',
      authentication: 'none',
      permissions: [],
      capabilitiesJson: JSON.stringify({capabilities: [{id: 'same'}, {id: 'same'}]}),
      limits,
    }),
    /duplicate capability id/i,
  );
});

test('mapCatalogEntry maps disabled Catalog entries to the existing Agent view model', () => {
  const card: AgentCardV02 = {
    schemaVersion: '0.2',
    agentId: 'runtime.disabled',
    name: 'Disabled Runtime',
    description: 'A disabled runtime.',
    owner: {id: 'team.platform', displayName: 'Platform Team'},
    version: '2.0.0',
    protocol: {type: 'a2a', version: '0.3.0', transport: 'JSONRPC', endpoint: 'http://127.0.0.1:9000/a2a'},
    skills: [
      {
        id: 'runtime.echo',
        name: 'Echo',
        description: 'Echoes input.',
        inputSchema: {type: 'object'},
        outputSchema: {type: 'object'},
        requiredPermissions: [],
      },
      {
        id: 'runtime.inspect',
        name: 'Inspect',
        description: 'Inspects input.',
        inputSchema: {type: 'object'},
        outputSchema: {type: 'object'},
        requiredPermissions: [],
      },
    ],
    authentication: {type: 'none'},
    permissions: [],
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
  assert.equal(agent.status, 'disabled');
  assert.deepEqual(agent.tags, ['runtime.echo', 'runtime.inspect']);
  assert.equal(JSON.parse(agent.schema).agentId, 'runtime.disabled');
});

test('NekiroApiClient sends Catalog search requests with auth and decodes platform errors', async () => {
  const requests: Array<{url: string; init?: RequestInit}> = [];
  const client = new NekiroApiClient({
    baseUrl: 'https://api.example.test/',
    token: 'test-token',
    fetchImpl: async (input, init) => {
      requests.push({url: String(input), init});
      return new Response(JSON.stringify({
        code: 'CONFLICT',
        message: 'Catalog conflict.',
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

  assert.equal(requests[0]?.url, 'https://api.example.test/v2/agents?query=echo');
  const headers = new Headers(requests[0]?.init?.headers);
  assert.equal(headers.get('Accept'), 'application/json');
  assert.equal(headers.get('Authorization'), 'Bearer test-token');
});
