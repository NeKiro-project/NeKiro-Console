import assert from 'node:assert/strict';
import test from 'node:test';

import type {AgentRelease} from './api/nekiro';
import {agentKey, canContinueToTrustedPublication, canEndpointChallenge, canReleaseAction, compatibleSkills, inputTemplateFromSchema, invocationCorrelation, isCurrentRequest, isTrustedEnabledInstallation, matchesPublishedRelease, nextRequestGeneration, shouldClearEndpointChallenge} from './consolePolicy';

const agent = {id: 'agent.echo', version: '1.2.3', ownerId: 'provider-1'};
const release = {
  releaseId: 'release-1',
  providerId: 'provider-1',
  agentId: 'agent.echo',
  agentCardVersion: '1.2.3',
  state: 'published',
  verificationEvidenceDigest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  verifiedAt: '2026-07-26T00:00:01Z',
  publishedAt: '2026-07-26T00:00:02Z',
} as AgentRelease;

test('console policy keeps Agent version identity in selection keys', () => {
  assert.equal(agentKey(agent), 'agent.echo@1.2.3');
  assert.notEqual(agentKey(agent), agentKey({id: 'agent.echo', version: '1.2.4'}));
});

test('console policy enforces the trusted Release lifecycle matrix', () => {
  assert.equal(canReleaseAction('pending_verification', 'verify'), true);
  assert.equal(canReleaseAction('pending_verification', 'publish'), false);
  assert.equal(canReleaseAction('verified', 'publish'), true);
  assert.equal(canReleaseAction('published', 'suspend'), true);
  assert.equal(canReleaseAction('suspended', 'revoke'), true);
  assert.equal(canReleaseAction('revoked', 'revoke'), false);
});

test('console policy requires Release provenance before invocation', () => {
  const base = {installationId: 'installation-1', workspaceId: 'workspace-1', agentId: 'agent.echo', versionConstraint: '1.2.3', installedVersion: '1.2.3', acceptedPermissions: [], installedAt: '2026-07-26T00:00:00Z', updatedAt: '2026-07-26T00:00:00Z'};
  assert.equal(isTrustedEnabledInstallation({...base, status: 'enabled', installedReleaseId: 'release-1'}), true);
  assert.equal(isTrustedEnabledInstallation({...base, status: 'enabled'}), false);
  assert.equal(isTrustedEnabledInstallation({...base, status: 'disabled', installedReleaseId: 'release-1'}), false);
  assert.equal(matchesPublishedRelease(release, agent), true);
  assert.equal(matchesPublishedRelease({...release, state: 'suspended'}, agent), false);
  assert.equal(matchesPublishedRelease({...release, providerId: 'provider-2'}, agent), false);
  assert.equal(matchesPublishedRelease({...release, verificationEvidenceDigest: undefined}, agent), false);
  assert.equal(matchesPublishedRelease({...release, verifiedAt: undefined}, agent), false);
  assert.equal(matchesPublishedRelease({...release, publishedAt: undefined}, agent), false);
});

test('console policy distinguishes stale request generations', () => {
  const first = nextRequestGeneration(0);
  const second = nextRequestGeneration(first);
  assert.equal(isCurrentRequest(first, second), false);
  assert.equal(isCurrentRequest(second, second), true);
});

test('console policy permits failed Binding challenge recovery and clears replaced challenges', () => {
  assert.equal(canEndpointChallenge('pending'), true);
  assert.equal(canEndpointChallenge('failed'), true);
  assert.equal(canEndpointChallenge('verified'), false);
  assert.equal(canEndpointChallenge('revoked'), false);
  assert.equal(canEndpointChallenge(undefined), false);

  const pending = {bindingId: 'binding-1', verificationStatus: 'pending' as const};
  assert.equal(shouldClearEndpointChallenge(pending, pending), false);
  assert.equal(shouldClearEndpointChallenge(pending, {...pending, verificationStatus: 'failed'}), true);
  assert.equal(shouldClearEndpointChallenge(pending, {bindingId: 'binding-2', verificationStatus: 'pending'}), true);
  assert.equal(shouldClearEndpointChallenge(null, pending), false);
});

test('console policy exposes only capabilities authorized by an Installation', () => {
  const skills = [
    {id: 'echo', name: 'Echo', description: 'Echo input', inputSchema: {type: 'object'}, outputSchema: {type: 'object'}, requiredPermissions: []},
    {id: 'documents.read', name: 'Read', description: 'Read a document', inputSchema: {type: 'object'}, outputSchema: {type: 'object'}, requiredPermissions: ['documents.read']},
    {id: 'documents.write', name: 'Write', description: 'Write a document', inputSchema: {type: 'object'}, outputSchema: {type: 'object'}, requiredPermissions: ['documents.write']},
  ];
  assert.deepEqual(compatibleSkills({skills}, {acceptedPermissions: ['documents.read']}).map((skill) => skill.id), ['echo', 'documents.read']);
});

test('console policy creates a bounded starter object from declared input schema', () => {
  assert.deepEqual(inputTemplateFromSchema({
    type: 'object',
    required: ['message', 'count', 'options'],
    properties: {
      message: {type: 'string', examples: ['hello']},
      count: {type: 'integer', default: 2},
      options: {type: 'object', required: ['stream'], properties: {stream: {type: 'boolean'}}},
      mode: {type: 'string', enum: ['safe', 'fast']},
      omitted: {type: 'string'},
    },
  }), {message: 'hello', count: 2, options: {stream: false}, mode: 'safe'});
  assert.deepEqual(inputTemplateFromSchema({type: 'array'}), {});
});

test('console policy only continues provider-owned Agents to Trusted Publication', () => {
  assert.equal(canContinueToTrustedPublication({ownerId: 'provider.main'}, 'provider.main'), true);
  assert.equal(canContinueToTrustedPublication({ownerId: 'provider.other'}, 'provider.main'), false);
});

test('console policy preserves correlation from the latest validated SSE event', () => {
  assert.deepEqual(invocationCorrelation(null, [
    {invocationId: 'inv-1', traceId: 'trace-1'},
    {invocationId: 'inv-1', traceId: 'trace-1'},
  ], {invocationId: undefined, traceId: undefined}), {invocationId: 'inv-1', traceId: 'trace-1'});
  assert.deepEqual(invocationCorrelation(null, [], {invocationId: 'inv-2', traceId: 'trace-2'}), {invocationId: 'inv-2', traceId: 'trace-2'});
});
