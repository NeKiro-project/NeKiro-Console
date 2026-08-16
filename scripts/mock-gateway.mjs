#!/usr/bin/env node
/**
 * NeKiro Console — local development mock gateway.
 *
 * A zero-dependency Node.js HTTP server (built-ins only) that stands in for the
 * real NeKiro Control Plane API so the Console UI can be visually verified
 * against realistic, stable data.
 *
 *   node scripts/mock-gateway.mjs
 *
 * Listens on 127.0.0.1:18080. State is seeded once at startup and mutated by
 * POST / PATCH / DELETE requests, mirroring a real gateway.
 *
 * The Console (src/api/nekiro.ts) validates every response with strict
 * validators — field names, semver, date formats, digests, status-dependent
 * field presence, correlations, and SSE framing. Every response below is
 * shaped to pass those validators exactly.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HOST = '127.0.0.1';
const PORT = 18080;

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

/**
 * publicUrl values returned in Catalog entries / Public shares must be the
 * canonical `origin + '/a/' + publicAgentId` the client derives from
 * VITE_NEKIRO_PUBLIC_AGENT_ORIGIN (see requirePublicAgentURL). Default to the
 * value in the repo's .env.local; allow an explicit override.
 */
function resolvePublicOrigin() {
  if (process.env.MOCK_PUBLIC_AGENT_ORIGIN && process.env.MOCK_PUBLIC_AGENT_ORIGIN.trim()) {
    return process.env.MOCK_PUBLIC_AGENT_ORIGIN.trim().replace(/\/+$/, '');
  }
  try {
    const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
    const text = fs.readFileSync(envPath, 'utf8');
    const match = /^\s*VITE_NEKIRO_PUBLIC_AGENT_ORIGIN\s*=\s*(.+?)\s*$/m.exec(text);
    if (match) return match[1].trim().replace(/\/+$/, '');
  } catch {
    /* ignore: fall back to default */
  }
  return 'http://127.0.0.1:3000';
}

const PUBLIC_ORIGIN = resolvePublicOrigin();

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, accept, x-nek-trace-id',
  // The client reads x-nek-trace-id on error responses; expose it so the
  // browser lets JS see it (it is not a CORS-safelisted response header).
  'Access-Control-Expose-Headers': 'x-nek-trace-id',
};

/* ------------------------------------------------------------------ */
/* Platform error messages — must match src/api/nekiro.ts exactly.     */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES = {
  VALIDATION_ERROR: 'The request is invalid.',
  UNAUTHENTICATED: 'Authentication is required.',
  FORBIDDEN: 'The requested operation is not allowed.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'The requested operation conflicts with current state.',
  NOT_ACCEPTABLE: 'The requested result mode is not acceptable.',
  PAYLOAD_TOO_LARGE: 'The payload is too large.',
  INTERNAL_ERROR: 'The platform could not complete the request.',
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randId(prefix, length = 12) {
  let suffix = '';
  for (let i = 0; i < length; i += 1) {
    suffix += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return prefix + suffix;
}

function hex32() {
  // 16 random bytes -> 32 lowercase hex characters.
  let out = '';
  for (let i = 0; i < 16; i += 1) {
    out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out;
}

function hex64() {
  return hex32() + hex32();
}

function nowIso() {
  return new Date().toISOString();
}

function addSeconds(iso, seconds) {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

function newTraceId() {
  return 'trace-' + hex32();
}

function log(method, pathname, status, note) {
  console.log(`${method} ${pathname} -> ${status}${note ? ` (${note})` : ''}`);
}

/** Minimal semver helpers so installs can honour version constraints. */
function parseSemver(value) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(String(value).trim());
  if (!m) return null;
  return {major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), prerelease: m[4]};
}

function cmpVersion(a, b) {
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.prerelease === undefined && b.prerelease !== undefined) return 1;
  if (a.prerelease !== undefined && b.prerelease === undefined) return -1;
  if (a.prerelease === undefined && b.prerelease === undefined) return 0;
  const ai = a.prerelease.split('.');
  const bi = b.prerelease.split('.');
  const len = Math.min(ai.length, bi.length);
  for (let i = 0; i < len; i += 1) {
    if (ai[i] === bi[i]) continue;
    const an = /^\d+$/.test(ai[i]);
    const bn = /^\d+$/.test(bi[i]);
    if (an && bn) return Number(ai[i]) < Number(bi[i]) ? -1 : 1;
    if (an) return -1;
    if (bn) return 1;
    return ai[i] < bi[i] ? -1 : 1;
  }
  return ai.length < bi.length ? -1 : ai.length > bi.length ? 1 : 0;
}

function parseVersionParts(value) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(String(value).trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: m[2] === undefined ? undefined : Number(m[2]),
    patch: m[3] === undefined ? undefined : Number(m[3]),
  };
}

function gt(a, b) { return cmpVersion(a, b) > 0; }
function gte(a, b) { return cmpVersion(a, b) >= 0; }
function lt(a, b) { return cmpVersion(a, b) < 0; }
function lte(a, b) { return cmpVersion(a, b) <= 0; }

function comparatorSet(op, version) {
  if (op === '>=') return (v) => gte(v, version);
  if (op === '<=') return (v) => lte(v, version);
  if (op === '>') return (v) => gt(v, version);
  if (op === '<') return (v) => lt(v, version);
  return (v) => cmpVersion(v, version) === 0;
}

function tokenComparators(op, raw) {
  const core = String(raw).replace(/^v/i, '').trim();
  if (core === '' || core === '*' || core === 'x' || core === 'X') return [() => true];

  // x-ranges: 1.2.x / 1.x
  const xMatch = /^(\d+)(?:\.(\d+))?[xX*]$/.exec(core);
  if (xMatch) {
    const major = Number(xMatch[1]);
    const minor = xMatch[2] === undefined ? undefined : Number(xMatch[2]);
    const lo = {major, minor: minor ?? 0, patch: 0};
    const hi = {major: minor === undefined ? major + 1 : major, minor: minor === undefined ? 0 : minor + 1, patch: 0};
    return [(v) => gte(v, lo), (v) => lt(v, hi)];
  }

  // partial versions: 1.2 -> >=1.2.0 <1.3.0 ; 1 -> >=1.0.0 <2.0.0
  const parts = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(core);
  if (!parts) return [() => false];
  const hasMinor = parts[2] !== undefined;
  const hasPatch = parts[3] !== undefined;
  const major = Number(parts[1]);
  const minor = hasMinor ? Number(parts[2]) : 0;
  const patch = hasPatch ? Number(parts[3]) : 0;
  const version = parseSemver(`${major}.${minor}.${patch}`);
  if (!version) return [() => false];

  if (op === '^') {
    const hi = major > 0
      ? {major: major + 1, minor: 0, patch: 0}
      : minor > 0
        ? {major: 0, minor: minor + 1, patch: 0}
        : {major: 0, minor: 0, patch: patch + 1};
    return [(v) => gte(v, version), (v) => lt(v, hi)];
  }
  if (op === '~') {
    const hi = hasMinor ? {major, minor: minor + 1, patch: 0} : {major: major + 1, minor: 0, patch: 0};
    return [(v) => gte(v, version), (v) => lt(v, hi)];
  }
  if (!hasPatch && !hasMinor) {
    // bare major: 1 -> >=1.0.0 <2.0.0
    return [(v) => gte(v, {major, minor: 0, patch: 0}), (v) => lt(v, {major: major + 1, minor: 0, patch: 0})];
  }
  if (!hasPatch) {
    // 1.2 -> >=1.2.0 <1.3.0
    return [(v) => gte(v, {major, minor, patch: 0}), (v) => lt(v, {major, minor: minor + 1, patch: 0})];
  }
  return [comparatorSet(op ?? '=', version)];
}

function satisfiesVersion(version, constraint) {
  const v = parseSemver(version);
  if (!v) return false;
  const normalized = String(constraint).trim();
  if (!normalized) return false;

  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(normalized);
  if (hyphen) {
    const lower = parseVersionParts(hyphen[1]);
    const upper = parseVersionParts(hyphen[2]);
    if (!lower || !upper) return false;
    const lo = {major: lower.major, minor: lower.minor ?? 0, patch: lower.patch ?? 0};
    let checks;
    if (upper.patch !== undefined) {
      checks = [(x) => gte(x, lo), (x) => lte(x, {major: upper.major, minor: upper.minor, patch: upper.patch})];
    } else if (upper.minor !== undefined) {
      checks = [(x) => gte(x, lo), (x) => lt(x, {major: upper.major, minor: upper.minor + 1, patch: 0})];
    } else {
      checks = [(x) => gte(x, lo), (x) => lt(x, {major: upper.major + 1, minor: 0, patch: 0})];
    }
    return checks.every((check) => check(v));
  }

  const branches = normalized.split('||');
  return branches.some((branch) => {
    const re = /(>=|<=|>|<|=|\^|~)?\s*([xX*]|\d+\.\d+[xX*]|\d+[xX*]|\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?|\d+\.\d+|\d+)/g;
    const tokens = [];
    let match;
    while ((match = re.exec(branch)) !== null) tokens.push({op: match[1] ?? null, raw: match[2]});
    if (tokens.length === 0) return false;
    return tokens.every((token) => tokenComparators(token.op, token.raw).every((check) => check(v)));
  });
}

/* ------------------------------------------------------------------ */
/* In-memory state (seeded once)                                       */
/* ------------------------------------------------------------------ */

const PROVIDER_ID = 'provider.nekiro.dev';
const PROVIDER_NAME = 'NeKiro Dev Provider';
const DEFAULT_WORKSPACE_ID = 'ws-dev-local';
const DEFAULT_OWNER_ID = 'owner.dev';

const PERMS = {
  textRead: {id: 'text.read', description: 'Read text payloads.'},
  httpFetch: {id: 'http.fetch', description: 'Fetch public HTTP endpoints.'},
  imageRead: {id: 'image.read', description: 'Read image payloads.'},
  docsRead: {id: 'docs.read', description: 'Read document content and indexes.'},
  repoRead: {id: 'repo.read', description: 'Read repository contents and diffs.'},
  prWrite: {id: 'pr.write', description: 'Post review comments to pull requests.'},
  renderWrite: {id: 'render.write', description: 'Write rendered image artifacts.'},
  webScrape: {id: 'web.scrape', description: 'Scrape public web pages.'},
  synthRun: {id: 'synth.run', description: 'Run synthesis over input corpora.'},
  translateRun: {id: 'translate.run', description: 'Translate text between languages.'},
  scheduleWrite: {id: 'schedule.write', description: 'Create and update schedules.'},
};

const LIMITS = {timeoutMs: 30_000, maxInputBytes: 1_048_576, maxOutputBytes: 1_048_576, streaming: true};

function skill(id, name, description, requiredPermissions) {
  return {
    id,
    name,
    description,
    inputSchema: {type: 'object', additionalProperties: true},
    outputSchema: {type: 'object', additionalProperties: true},
    requiredPermissions,
  };
}

/** Build a full AgentCardV02 from compact seed fields. */
function makeCard({agentId, name, description, version, endpoint, authentication, permissions, skills}) {
  return {
    schemaVersion: '0.2',
    agentId,
    name,
    description,
    owner: {id: PROVIDER_ID, displayName: PROVIDER_NAME},
    version,
    protocol: {type: 'a2a', version: '0.3.0', transport: 'JSONRPC', endpoint},
    skills,
    authentication: {type: authentication},
    permissions,
    limits: LIMITS,
  };
}

function publicIdentity(publicAgentId) {
  return {
    publicAgentId,
    publicUrl: `${PUBLIC_ORIGIN}/a/${publicAgentId}`,
  };
}

/** Seed catalog entries: agentId@version -> CatalogEntry. */
function seedCatalogEntries() {
  const entries = new Map();
  const add = ({agentId, version, publicationStatus, registeredAt, publishedAt, publicAgentId, card}) => {
    const entry = {card, publicationStatus, registeredAt};
    if (publishedAt !== undefined) entry.publishedAt = publishedAt;
    if (publicAgentId !== undefined) Object.assign(entry, publicIdentity(publicAgentId));
    entries.set(`${agentId}@${version}`, entry);
  };

  add({
    agentId: 'runtime.echo',
    version: '1.0.0',
    card: makeCard({
      agentId: 'runtime.echo',
      name: 'Runtime Echo',
      description: 'Echoes structured input through the A2A JSON-RPC profile. Used for connectivity probes and contract tests.',
      version: '1.0.0',
      endpoint: 'http://127.0.0.1:9000/a2a',
      authentication: 'none',
      permissions: [PERMS.textRead],
      skills: [skill('runtime.echo', 'Echo', 'Echoes structured input back to the caller.', ['text.read'])],
    }),
    publicationStatus: 'published',
    registeredAt: '2026-06-02T09:20:00Z',
    publishedAt: '2026-06-02T10:05:00Z',
    publicAgentId: 'agt_1a2b3c4d5e6f708192a3b4c5d6e7f809',
  });

  add({
    agentId: 'docs.indexer',
    version: '1.1.0',
    card: makeCard({
      agentId: 'docs.indexer',
      name: 'Docs Indexer',
      description: 'Indexes documentation corpora and answers search queries over the resulting index.',
      version: '1.1.0',
      endpoint: 'https://docs.nekiro.dev/indexer/a2a',
      authentication: 'http_bearer',
      permissions: [PERMS.docsRead, PERMS.textRead],
      skills: [
        skill('docs.index', 'Index documents', 'Adds a document corpus to the search index.', ['docs.read']),
        skill('docs.search', 'Search indexes', 'Runs a query over the indexed corpora.', ['docs.read']),
      ],
    }),
    publicationStatus: 'draft',
    registeredAt: '2026-06-11T13:00:00Z',
  });

  add({
    agentId: 'code.reviewer',
    version: '1.4.0',
    card: makeCard({
      agentId: 'code.reviewer',
      name: 'Code Reviewer',
      description: 'Reviews pull requests against repository policy and posts structured findings.',
      version: '1.4.0',
      endpoint: 'https://review.nekiro.dev/a2a',
      authentication: 'oauth2_client_credentials',
      permissions: [PERMS.repoRead, PERMS.prWrite],
      skills: [skill('review.diff', 'Review diff', 'Reviews a pull request diff and posts findings.', ['repo.read', 'pr.write'])],
    }),
    publicationStatus: 'published',
    registeredAt: '2026-07-15T17:45:00Z',
    publishedAt: '2026-07-16T08:30:00Z',
    publicAgentId: 'agt_2b3c4d5e6f708192a3b4c5d6e7f8091a',
  });

  add({
    agentId: 'image.renderer',
    version: '2.0.1',
    card: makeCard({
      agentId: 'image.renderer',
      name: 'Image Renderer',
      description: 'Renders image assets from templates and structured scene descriptions.',
      version: '2.0.1',
      endpoint: 'https://render.nekiro.dev/a2a',
      authentication: 'api_key',
      permissions: [PERMS.imageRead, PERMS.renderWrite],
      skills: [skill('image.render', 'Render image', 'Renders an image from a scene description.', ['image.read', 'render.write'])],
    }),
    publicationStatus: 'published',
    registeredAt: '2026-06-28T15:20:00Z',
    publishedAt: '2026-06-29T10:00:00Z',
    publicAgentId: 'agt_3c4d5e6f708192a3b4c5d6e7f8091a2b',
  });

  add({
    agentId: 'web.scraper',
    version: '2.1.0',
    card: makeCard({
      agentId: 'web.scraper',
      name: 'Web Scraper',
      description: 'Fetches public web pages and extracts structured records.',
      version: '2.1.0',
      endpoint: 'https://scraper.nekiro.dev/a2a',
      authentication: 'http_bearer',
      permissions: [PERMS.httpFetch, PERMS.webScrape],
      skills: [skill('web.scrape', 'Scrape page', 'Fetches and extracts records from a public URL.', ['http.fetch', 'web.scrape'])],
    }),
    publicationStatus: 'draft',
    registeredAt: '2026-07-02T09:00:00Z',
  });

  add({
    agentId: 'data.synthesizer',
    version: '1.3.0',
    card: makeCard({
      agentId: 'data.synthesizer',
      name: 'Data Synthesizer',
      description: 'Synthesizes realistic sample datasets from seed corpora and schemas.',
      version: '1.3.0',
      endpoint: 'https://synth.nekiro.dev/a2a',
      authentication: 'none',
      permissions: [PERMS.textRead, PERMS.synthRun],
      skills: [skill('synth.run', 'Synthesize', 'Generates a sample dataset from a schema.', ['text.read', 'synth.run'])],
    }),
    publicationStatus: 'disabled',
    registeredAt: '2026-04-08T09:00:00Z',
    publishedAt: '2026-04-08T12:00:00Z',
  });

  add({
    agentId: 'translator.pro',
    version: '2.3.1',
    card: makeCard({
      agentId: 'translator.pro',
      name: 'Translator Pro',
      description: 'Translates text between 40+ languages with glossary support.',
      version: '2.3.1',
      endpoint: 'https://translate.nekiro.dev/a2a',
      authentication: 'api_key',
      permissions: [PERMS.translateRun],
      skills: [skill('translate.run', 'Translate', 'Translates text into the target language.', ['translate.run'])],
    }),
    publicationStatus: 'draft',
    registeredAt: '2026-07-20T11:30:00Z',
  });

  add({
    agentId: 'scheduler.agent',
    version: '2.2.0',
    card: makeCard({
      agentId: 'scheduler.agent',
      name: 'Scheduler Agent',
      description: 'Manages recurring schedules and dispatches downstream work on time.',
      version: '2.2.0',
      endpoint: 'https://scheduler.nekiro.dev/a2a',
      authentication: 'http_bearer',
      permissions: [PERMS.scheduleWrite],
      skills: [skill('schedule.manage', 'Manage schedules', 'Creates, updates and lists schedules.', ['schedule.write'])],
    }),
    publicationStatus: 'disabled',
    registeredAt: '2026-05-20T11:00:00Z',
    publishedAt: '2026-05-21T09:12:00Z',
  });

  return entries;
}

/** Seed endpoint bindings: bindingId -> EndpointBinding. */
function seedBindings() {
  const bindings = new Map();
  const verified = {
    bindingId: 'bnd-echo-verified-01',
    providerId: PROVIDER_ID,
    agentId: 'runtime.echo',
    agentCardVersion: '1.0.0',
    endpoint: 'https://echo.nekiro.dev/a2a',
    verificationMethod: 'http_well_known',
    verificationStatus: 'verified',
    verificationEvidenceDigest: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    createdAt: '2026-07-10T09:00:00Z',
    updatedAt: '2026-07-10T09:05:00Z',
    verifiedAt: '2026-07-10T09:05:00Z',
  };
  const pending = {
    bindingId: 'bnd-scraper-pending-02',
    providerId: PROVIDER_ID,
    agentId: 'web.scraper',
    agentCardVersion: '2.1.0',
    endpoint: 'https://scraper.nekiro.dev/a2a',
    verificationMethod: 'http_well_known',
    verificationStatus: 'pending',
    createdAt: '2026-07-21T14:00:00Z',
    updatedAt: '2026-07-21T14:00:00Z',
  };
  bindings.set(verified.bindingId, verified);
  bindings.set(pending.bindingId, pending);
  return bindings;
}

/** Seed releases: releaseId -> AgentRelease. */
function seedReleases(bindings) {
  const releases = new Map();
  const digest = (seed) => {
    // Deterministic-looking 64-hex digest for stable seeds.
    let out = '';
    for (let i = 0; i < seed.length; i += 1) {
      out += (seed.charCodeAt(i) * 2654435761 + 40503).toString(16).slice(-2).padStart(2, '0');
    }
    return (out + out).slice(0, 64).padEnd(64, '0');
  };
  const fromBinding = (bindingId) => {
    const binding = bindings.get(bindingId);
    if (!binding) return {origin: 'https://agent.invalid', path: '/a2a'};
    let origin;
    let pathname;
    try {
      const url = new URL(binding.endpoint);
      origin = url.origin;
      pathname = url.pathname || '/';
    } catch {
      origin = 'https://agent.invalid';
      pathname = '/a2a';
    }
    return {origin, path: pathname};
  };

  const echo = fromBinding('bnd-echo-verified-01');
  releases.set('rl-echo-published-01', {
    releaseId: 'rl-echo-published-01',
    providerId: PROVIDER_ID,
    agentId: 'runtime.echo',
    agentCardVersion: '1.0.0',
    cardDigest: digest('runtime.echo@1.0.0'),
    endpointBindingId: 'bnd-echo-verified-01',
    endpointOrigin: echo.origin,
    endpointPath: echo.path,
    verificationMethod: 'http_well_known',
    verificationEvidenceDigest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    state: 'published',
    createdAt: '2026-07-10T09:06:00Z',
    updatedAt: '2026-07-10T09:08:00Z',
    verifiedAt: '2026-07-10T09:07:00Z',
    publishedAt: '2026-07-10T09:08:00Z',
  });

  // code.reviewer's published release reuses the verified echo binding
  // (the client never cross-validates release/binding identity).
  const reviewer = fromBinding('bnd-echo-verified-01');
  releases.set('rl-reviewer-published-01', {
    releaseId: 'rl-reviewer-published-01',
    providerId: PROVIDER_ID,
    agentId: 'code.reviewer',
    agentCardVersion: '1.4.0',
    cardDigest: digest('code.reviewer@1.4.0'),
    endpointBindingId: 'bnd-echo-verified-01',
    endpointOrigin: reviewer.origin,
    endpointPath: reviewer.path,
    verificationMethod: 'http_well_known',
    verificationEvidenceDigest: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    state: 'published',
    createdAt: '2026-07-16T08:31:00Z',
    updatedAt: '2026-07-16T08:35:00Z',
    verifiedAt: '2026-07-16T08:33:00Z',
    publishedAt: '2026-07-16T08:35:00Z',
  });

  const scraper = fromBinding('bnd-scraper-pending-02');
  releases.set('rl-scraper-verified-01', {
    releaseId: 'rl-scraper-verified-01',
    providerId: PROVIDER_ID,
    agentId: 'web.scraper',
    agentCardVersion: '2.1.0',
    cardDigest: digest('web.scraper@2.1.0'),
    endpointBindingId: 'bnd-scraper-pending-02',
    endpointOrigin: scraper.origin,
    endpointPath: scraper.path,
    verificationMethod: 'http_well_known',
    verificationEvidenceDigest: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
    state: 'verified',
    createdAt: '2026-07-21T14:10:00Z',
    updatedAt: '2026-07-21T14:20:00Z',
    verifiedAt: '2026-07-21T14:20:00Z',
  });

  const scheduler = fromBinding('bnd-scraper-pending-02');
  releases.set('rl-scheduler-revoked-01', {
    releaseId: 'rl-scheduler-revoked-01',
    providerId: PROVIDER_ID,
    agentId: 'scheduler.agent',
    agentCardVersion: '2.2.0',
    cardDigest: digest('scheduler.agent@2.2.0'),
    endpointBindingId: 'bnd-scraper-pending-02',
    endpointOrigin: scheduler.origin,
    endpointPath: scheduler.path,
    verificationMethod: 'http_well_known',
    verificationEvidenceDigest: '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff',
    state: 'revoked',
    createdAt: '2026-07-05T10:00:00Z',
    updatedAt: '2026-07-06T09:30:00Z',
    verifiedAt: '2026-07-05T10:10:00Z',
    publishedAt: '2026-07-05T10:20:00Z',
    revokedAt: '2026-07-06T09:30:00Z',
  });

  return releases;
}

/** Seed a challenge for the pending binding. */
function seedChallenges() {
  const challenges = new Map();
  const challenge = {
    challengeId: 'chg-seeded-scraper-01',
    bindingId: 'bnd-scraper-pending-02',
    challengeUrl: 'https://scraper.nekiro.dev/.well-known/nekiro/challenges/chg-seeded-scraper-01',
    proof: 'proof-' + hex32(),
    expiresAt: '2026-08-01T00:00:00Z',
  };
  challenges.set(challenge.challengeId, challenge);
  return challenges;
}

/** Seed workspaces: workspaceId -> Workspace. */
function seedWorkspaces() {
  const workspaces = new Map();
  workspaces.set(DEFAULT_WORKSPACE_ID, {
    workspaceId: DEFAULT_WORKSPACE_ID,
    ownerId: DEFAULT_OWNER_ID,
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-07-18T16:42:00Z',
  });
  workspaces.set('ws-team-beta', {
    workspaceId: 'ws-team-beta',
    ownerId: 'team.beta',
    createdAt: '2026-06-20T12:00:00Z',
    updatedAt: '2026-07-12T10:15:00Z',
  });
  return workspaces;
}

/** Seed installations: installationId -> Installation. */
function seedInstallations(releases) {
  const installations = new Map();
  const add = (installation) => installations.set(installation.installationId, installation);

  add({
    installationId: 'ins-echo-a1b2',
    workspaceId: DEFAULT_WORKSPACE_ID,
    agentId: 'runtime.echo',
    versionConstraint: '1.0.0',
    installedVersion: '1.0.0',
    installedReleaseId: 'rl-echo-published-01',
    acceptedPermissions: [],
    status: 'enabled',
    installedAt: '2026-06-02T10:20:00Z',
    updatedAt: '2026-06-02T10:20:00Z',
  });

  add({
    installationId: 'ins-reviewer-c3d4',
    workspaceId: DEFAULT_WORKSPACE_ID,
    agentId: 'code.reviewer',
    versionConstraint: '1.4.0',
    installedVersion: '1.4.0',
    installedReleaseId: 'rl-reviewer-published-01',
    acceptedPermissions: ['pr.write', 'repo.read'],
    status: 'enabled',
    installedAt: '2026-07-16T09:00:00Z',
    updatedAt: '2026-07-16T09:00:00Z',
  });

  add({
    installationId: 'ins-scraper-e5f6',
    workspaceId: DEFAULT_WORKSPACE_ID,
    agentId: 'web.scraper',
    versionConstraint: '2.1.0',
    installedVersion: '2.1.0',
    acceptedPermissions: ['http.fetch', 'web.scrape'],
    status: 'disabled',
    installedAt: '2026-07-21T15:00:00Z',
    updatedAt: '2026-07-22T08:30:00Z',
  });

  add({
    installationId: 'ins-synth-g7h8',
    workspaceId: DEFAULT_WORKSPACE_ID,
    agentId: 'data.synthesizer',
    versionConstraint: '1.3.0',
    installedVersion: '1.3.0',
    acceptedPermissions: [],
    status: 'uninstalled',
    installedAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-06-30T11:15:00Z',
    uninstalledAt: '2026-06-30T11:15:00Z',
  });

  add({
    installationId: 'ins-image-i9j0',
    workspaceId: DEFAULT_WORKSPACE_ID,
    agentId: 'image.renderer',
    versionConstraint: '2.0.1',
    installedVersion: '2.0.1',
    acceptedPermissions: ['image.read', 'render.write'],
    status: 'enabled',
    installedAt: '2026-06-29T10:30:00Z',
    updatedAt: '2026-07-01T14:32:00Z',
  });

  // One installation in the secondary workspace so it is not empty.
  add({
    installationId: 'ins-beta-k1l2',
    workspaceId: 'ws-team-beta',
    agentId: 'runtime.echo',
    versionConstraint: '1.0.0',
    installedVersion: '1.0.0',
    installedReleaseId: 'rl-echo-published-01',
    acceptedPermissions: [],
    status: 'disabled',
    installedAt: '2026-06-21T09:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
  });

  return installations;
}

/* ------------------------------------------------------------------ */
/* Invocation / ledger helpers                                         */
/* ------------------------------------------------------------------ */

function buildRecord({invocationId, rootTaskId, parentInvocationId, traceId, caller, workspaceId, targetAgentId, agentCardVersion, agentReleaseId, agentCardDigest, capability, status, latencyMs, errorCode, createdAt, updatedAt}) {
  const record = {
    invocationId,
    rootTaskId,
    traceId,
    caller,
    workspaceId,
    targetAgentId,
    agentCardVersion,
    capability,
    status,
    createdAt,
    updatedAt,
  };
  if (parentInvocationId !== undefined) record.parentInvocationId = parentInvocationId;
  if (agentReleaseId !== undefined) {
    record.agentReleaseId = agentReleaseId;
    record.agentCardDigest = agentCardDigest;
  }
  if (latencyMs !== undefined) record.latencyMs = latencyMs;
  if (errorCode !== undefined) record.errorCode = errorCode;
  return record;
}

/**
 * Build the ledger events for a succeeded invocation. Every event carries the
 * exact correlation fields (including optional provenance + parent id) so
 * validateInvocationDetail's per-event correlation check passes.
 */
function buildSucceededEvents(record, startIso, chunkSizes, latencyMs) {
  const base = {
    schemaVersion: '0.3',
    invocationId: record.invocationId,
    rootTaskId: record.rootTaskId,
    traceId: record.traceId,
    caller: record.caller,
    workspaceId: record.workspaceId,
    targetAgentId: record.targetAgentId,
    agentCardVersion: record.agentCardVersion,
    capability: record.capability,
  };
  if (record.parentInvocationId !== undefined) base.parentInvocationId = record.parentInvocationId;
  if (record.agentReleaseId !== undefined) {
    base.agentReleaseId = record.agentReleaseId;
    base.agentCardDigest = record.agentCardDigest;
  }
  const at = (offset) => addSeconds(startIso, offset);
  const [firstChunkBytes, secondChunkBytes] = chunkSizes;
  return [
    {...base, eventId: randId('evt-', 10), sequence: 0, occurredAt: at(0), type: 'created', status: 'pending'},
    {...base, eventId: randId('evt-', 10), sequence: 1, occurredAt: at(1), type: 'routing', status: 'routing'},
    {...base, eventId: randId('evt-', 10), sequence: 2, occurredAt: at(2), type: 'started', status: 'running'},
    {...base, eventId: randId('evt-', 10), sequence: 3, occurredAt: at(3), type: 'stream', status: 'running', chunkIndex: 0, chunkBytes: firstChunkBytes},
    {...base, eventId: randId('evt-', 10), sequence: 4, occurredAt: at(4), type: 'stream', status: 'running', chunkIndex: 1, chunkBytes: secondChunkBytes},
    {...base, eventId: randId('evt-', 10), sequence: 5, occurredAt: at(5), type: 'succeeded', status: 'succeeded', latencyMs},
  ];
}

/** Seed invocations + the trace linking them (parent -> child). */
function seedInvocations() {
  const invocations = new Map();
  const traceId = 'trace-demo-echo-01';
  const rootTaskId = 'task-demo-echo-01';
  const parentId = 'inv-demo-echo-parent-01';
  const childId = 'inv-demo-index-child-01';

  const parentRecord = buildRecord({
    invocationId: parentId,
    rootTaskId,
    traceId,
    caller: {type: 'user', id: DEFAULT_OWNER_ID},
    workspaceId: DEFAULT_WORKSPACE_ID,
    targetAgentId: 'runtime.echo',
    agentCardVersion: '1.0.0',
    agentReleaseId: 'rl-echo-published-01',
    agentCardDigest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    capability: 'runtime.echo',
    status: 'succeeded',
    latencyMs: 214,
    createdAt: '2026-07-18T09:00:00Z',
    updatedAt: '2026-07-18T09:00:05Z',
  });
  invocations.set(parentId, {
    record: parentRecord,
    events: buildSucceededEvents(parentRecord, '2026-07-18T09:00:00Z', [312, 468], 214),
  });

  const childRecord = buildRecord({
    invocationId: childId,
    rootTaskId,
    parentInvocationId: parentId,
    traceId,
    caller: {type: 'agent', id: 'runtime.echo'},
    workspaceId: DEFAULT_WORKSPACE_ID,
    targetAgentId: 'docs.indexer',
    agentCardVersion: '1.1.0',
    capability: 'docs.search',
    status: 'succeeded',
    latencyMs: 96,
    createdAt: '2026-07-18T09:00:02Z',
    updatedAt: '2026-07-18T09:00:03Z',
  });
  invocations.set(childId, {
    record: childRecord,
    events: buildSucceededEvents(childRecord, '2026-07-18T09:00:02Z', [128, 0], 96),
  });

  const traces = new Map();
  traces.set(traceId, {traceId, invocations: [parentRecord, childRecord]});
  return {invocations, traces};
}

/* ------------------------------------------------------------------ */
/* State assembly                                                      */
/* ------------------------------------------------------------------ */

const cards = seedCatalogEntries();
const bindings = seedBindings();
const releases = seedReleases(bindings);
const challenges = seedChallenges();
const workspaces = seedWorkspaces();
const installations = seedInstallations(releases);
const {invocations, traces} = seedInvocations();

/* ------------------------------------------------------------------ */
/* HTTP plumbing                                                       */
/* ------------------------------------------------------------------ */

function respond(res, status, body, headers = {}, logPath = null, logMethod = null, note) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
    ...headers,
  });
  res.end(payload);
  if (logPath !== null) log(logMethod, logPath, status, note);
}

function sendError(res, status, code, traceId = newTraceId(), logPath = null, logMethod = null, note) {
  respond(res, status, {code, message: ERROR_MESSAGES[code] ?? code, traceId}, {'x-nek-trace-id': traceId}, logPath, logMethod, note ?? code);
}

function sendNotFound(res, reqPath, method) {
  sendError(res, 404, 'NOT_FOUND', undefined, reqPath, method);
}

function preflight(res, reqPath, method) {
  res.writeHead(204, {...CORS_HEADERS});
  res.end();
  log(method, reqPath, 204);
}

function readBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text.length === 0 ? undefined : JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */
/* Catalog helpers                                                     */
/* ------------------------------------------------------------------ */

function catalogEntryFor(agentId, version) {
  return cards.get(`${agentId}@${version}`);
}

function makePublicAgentRelease(release) {
  const entry = catalogEntryFor(release.agentId, release.agentCardVersion);
  const card = entry?.card;
  return {
    releaseId: release.releaseId,
    agentId: release.agentId,
    name: card?.name ?? release.agentId,
    description: card?.description ?? '',
    owner: card ? card.owner : {id: PROVIDER_ID, displayName: PROVIDER_NAME},
    agentCardVersion: release.agentCardVersion,
    cardDigest: release.cardDigest,
    publishedAt: release.publishedAt,
    authenticationType: card?.authentication.type ?? 'none',
    skills: card?.skills ?? [],
    permissions: card?.permissions ?? [],
    limits: card?.limits ?? LIMITS,
  };
}

function publicShareFor(publicAgentId) {
  let entryWithId = null;
  for (const entry of cards.values()) {
    if (entry.publicAgentId === publicAgentId) {
      entryWithId = entry;
      break;
    }
  }
  if (!entryWithId) return null;
  const publishedReleases = [...releases.values()].filter(
    (release) => release.agentId === entryWithId.card.agentId
      && release.agentCardVersion === entryWithId.card.version
      && release.state === 'published',
  );
  const share = {
    schemaVersion: '1',
    publicAgentId,
    publicUrl: `${PUBLIC_ORIGIN}/a/${publicAgentId}`,
    registeredAt: entryWithId.registeredAt,
    availability: publishedReleases.length > 0 ? 'installable' : 'not_installable',
    releases: publishedReleases.map(makePublicAgentRelease),
  };
  return share;
}

/** Resolve the trusted release for an install request, if any. */
function resolvePublishedRelease(agentId, versionConstraint) {
  const candidates = [...releases.values()].filter(
    (release) => release.agentId === agentId && release.state === 'published',
  );
  const satisfying = candidates.filter((release) => satisfiesVersion(release.agentCardVersion, versionConstraint));
  if (satisfying.length > 0) {
    // Newest published release wins when several satisfy the constraint.
    satisfying.sort((a, b) => Date.parse(b.publishedAt ?? b.updatedAt) - Date.parse(a.publishedAt ?? a.updatedAt));
    return satisfying[0];
  }
  // Fall back to any published release for the agent (constraint is usually an
  // exact version the client already validated).
  return candidates[0];
}

function createInstallation({workspaceId, agentId, versionConstraint, acceptedPermissions}) {
  const release = resolvePublishedRelease(agentId, versionConstraint);
  let installedVersion;
  let installedReleaseId;
  if (release) {
    installedVersion = release.agentCardVersion;
    installedReleaseId = release.releaseId;
  } else {
    // No published trusted release: pin to the card version that satisfies the
    // constraint (or the agent's card version as a best effort).
    const candidates = [...cards.values()].filter((entry) => entry.card.agentId === agentId);
    const satisfying = candidates.find((entry) => satisfiesVersion(entry.card.version, versionConstraint));
    const entry = satisfying ?? candidates[0];
    if (entry) {
      installedVersion = entry.card.version;
    } else if (parseSemver(versionConstraint)) {
      installedVersion = versionConstraint;
    } else {
      return null; // caller answers 400 VALIDATION_ERROR
    }
  }
  const now = nowIso();
  const installation = {
    installationId: randId('ins-', 12),
    workspaceId,
    agentId,
    versionConstraint,
    installedVersion,
    acceptedPermissions: [...(acceptedPermissions ?? [])].sort(),
    status: 'enabled',
    installedAt: now,
    updatedAt: now,
  };
  if (installedReleaseId !== undefined) installation.installedReleaseId = installedReleaseId;
  return installation;
}

/** Locate the installed version / release provenance for an invocation. */
function invocationTarget(workspaceId, agentId) {
  const installation = [...installations.values()].find(
    (item) => item.workspaceId === workspaceId && item.agentId === agentId && item.status === 'enabled',
  );
  if (installation) {
    const release = installation.installedReleaseId ? releases.get(installation.installedReleaseId) : undefined;
    return {
      agentCardVersion: installation.installedVersion,
      agentReleaseId: release ? release.releaseId : undefined,
      agentCardDigest: release ? release.cardDigest : undefined,
    };
  }
  const entry = [...cards.values()].find((item) => item.card.agentId === agentId);
  return {agentCardVersion: entry?.card.version ?? '1.0.0', agentReleaseId: undefined, agentCardDigest: undefined};
}

/* ------------------------------------------------------------------ */
/* Request router                                                      */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const method = req.method ?? 'GET';
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const reqPath = url.pathname;
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  const query = url.searchParams;

  if (method === 'OPTIONS') {
    preflight(res, reqPath, method);
    return;
  }

  const route = matchRoute(segments, method);
  if (!route) {
    sendNotFound(res, reqPath, method);
    return;
  }

  try {
    await route.handler(req, res, route.params, query, reqPath, method);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(method, reqPath, 500, `handler error: ${message}`);
    if (!res.headersSent) sendError(res, 500, 'INTERNAL_ERROR', undefined, reqPath, method, message);
    else res.end();
  }
});

function matchRoute(segments, requestMethod) {
  const routes = [
    // v3 Catalog
    {pattern: ['v3', 'agents'], methods: ['GET', 'POST'], handler: handleAgents},
    {pattern: ['v3', 'agents', '{a}', 'versions', '{v}'], methods: ['GET'], handler: handleAgentVersion},
    {pattern: ['v3', 'agents', '{a}', 'versions', '{v}', 'publish'], methods: ['POST'], handler: handlePublishAgentVersion},
    {pattern: ['v3', 'agents', '{a}', 'versions', '{v}', 'disable'], methods: ['POST'], handler: handleDisableAgentVersion},
    // v3 Workspaces + Installations
    {pattern: ['v3', 'workspaces'], methods: ['POST'], handler: handleCreateWorkspace},
    {pattern: ['v3', 'workspaces', '{w}'], methods: ['GET'], handler: handleGetWorkspace},
    {pattern: ['v3', 'workspaces', '{w}', 'installations'], methods: ['GET', 'POST'], handler: handleInstallations},
    {pattern: ['v3', 'workspaces', '{w}', 'installations', '{i}'], methods: ['GET', 'PATCH', 'DELETE'], handler: handleInstallation},
    // v4 Trusted Publication
    {pattern: ['v4', 'providers', '{p}', 'agents', '{a}', 'endpoint-bindings'], methods: ['GET', 'POST'], handler: handleEndpointBindings},
    {pattern: ['v4', 'providers', '{p}', 'endpoint-bindings', '{b}'], methods: ['GET'], handler: handleGetBinding},
    {pattern: ['v4', 'providers', '{p}', 'endpoint-bindings', '{b}', 'challenges'], methods: ['POST'], handler: handleCreateChallenge},
    {pattern: ['v4', 'providers', '{p}', 'endpoint-bindings', '{b}', 'challenges', '{c}', 'complete'], methods: ['POST'], handler: handleCompleteChallenge},
    {pattern: ['v4', 'providers', '{p}', 'agents', '{a}', 'releases'], methods: ['POST'], handler: handleCreateRelease},
    {pattern: ['v4', 'releases', '{r}'], methods: ['GET'], handler: handleGetRelease},
    {pattern: ['v4', 'releases', '{r}', 'verify'], methods: ['POST'], handler: (req, res, params, q, path, method) => handleReleaseAction(req, res, params.r, 'verify', path, method)},
    {pattern: ['v4', 'releases', '{r}', 'publish'], methods: ['POST'], handler: (req, res, params, q, path, method) => handleReleaseAction(req, res, params.r, 'publish', path, method)},
    {pattern: ['v4', 'releases', '{r}', 'suspend'], methods: ['POST'], handler: (req, res, params, q, path, method) => handleReleaseAction(req, res, params.r, 'suspend', path, method)},
    {pattern: ['v4', 'releases', '{r}', 'revoke'], methods: ['POST'], handler: (req, res, params, q, path, method) => handleReleaseAction(req, res, params.r, 'revoke', path, method)},
    // v4 Public share
    {pattern: ['v4', 'public', 'agents', '{id}'], methods: ['GET'], handler: handlePublicAgent},
    // v4 Invocations + Ledger
    {pattern: ['v4', 'workspaces', '{w}', 'invocations'], methods: ['POST'], handler: handleInvoke},
    {pattern: ['v4', 'workspaces', '{w}', 'invocations', '{i}'], methods: ['GET'], handler: handleGetInvocation},
    {pattern: ['v4', 'workspaces', '{w}', 'traces', '{t}'], methods: ['GET'], handler: handleGetTrace},
  ];

  for (const route of routes) {
    if (route.pattern.length !== segments.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < segments.length; i += 1) {
      const expected = route.pattern[i];
      if (expected.startsWith('{')) {
        params[expected.slice(1, -1)] = segments[i];
      } else if (expected !== segments[i]) {
        matched = false;
        break;
      }
    }
    if (matched && route.methods.includes(requestMethod)) {
      return {...route, params};
    }
    if (matched) {
      return {pattern: route.pattern, methods: route.methods, params, handler: null};
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* v3 Catalog handlers                                                 */
/* ------------------------------------------------------------------ */

function searchCards(query) {
  const params = {
    text: query.get('query') ?? '',
    capability: query.get('capability') ?? '',
    owner: query.get('owner') ?? query.get('ownerId') ?? '',
    limit: query.get('limit') ? Number(query.get('limit')) : undefined,
    cursor: query.get('cursor') ?? '',
  };
  const offset = /^cursor-(\d+)$/.test(params.cursor) ? Number(/^cursor-(\d+)$/.exec(params.cursor)[1]) : 0;

  let items = [...cards.values()];
  if (params.owner) {
    items = items.filter((entry) => entry.card.owner.id === params.owner);
  }
  if (params.capability) {
    items = items.filter((entry) => entry.card.skills.some((s) => s.id === params.capability));
  }
  if (params.text) {
    const needle = params.text.toLowerCase();
    items = items.filter((entry) => {
      const haystack = [
        entry.card.agentId,
        entry.card.name,
        entry.card.owner.id,
        entry.card.owner.displayName,
        entry.card.description,
        entry.card.version,
        entry.publicationStatus,
        ...entry.card.skills.map((s) => s.id),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }
  items.sort((a, b) => a.card.agentId.localeCompare(b.card.agentId));
  const page = typeof params.limit === 'number' && params.limit >= 1 ? items.slice(offset, offset + params.limit) : items.slice(offset);
  const response = {items: page};
  if (typeof params.limit === 'number' && params.limit >= 1 && offset + params.limit < items.length) {
    response.nextCursor = `cursor-${offset + params.limit}`;
  }
  return response;
}

async function handleAgents(req, res, params, query, reqPath, method) {
  if (method === 'GET') {
    const response = searchCards(query);
    respond(res, 200, response, {}, reqPath, method);
    return;
  }
  // POST /v3/agents — register a draft card.
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log(method, reqPath, 400, `invalid body: ${error instanceof Error ? error.message : 'parse failure'}`);
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
    return;
  }
  const card = body?.card;
  if (!card || typeof card !== 'object' || typeof card.agentId !== 'string' || typeof card.version !== 'string') {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'missing card.agentId/version');
    return;
  }
  const key = `${card.agentId}@${card.version}`;
  const entry = {card, publicationStatus: 'draft', registeredAt: nowIso()};
  cards.set(key, entry);
  respond(res, 201, entry, {}, reqPath, method);
}

async function handleAgentVersion(req, res, params, query, reqPath, method) {
  const entry = catalogEntryFor(params.a, params.v);
  if (!entry) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, entry, {}, reqPath, method);
}

async function handlePublishAgentVersion(req, res, params, query, reqPath, method) {
  const entry = catalogEntryFor(params.a, params.v);
  if (!entry) {
    sendNotFound(res, reqPath, method);
    return;
  }
  entry.publicationStatus = 'published';
  entry.publishedAt = nowIso();
  if (!entry.publicAgentId) Object.assign(entry, publicIdentity('agt_' + hex32()));
  respond(res, 200, entry, {}, reqPath, method);
}

async function handleDisableAgentVersion(req, res, params, query, reqPath, method) {
  const entry = catalogEntryFor(params.a, params.v);
  if (!entry) {
    sendNotFound(res, reqPath, method);
    return;
  }
  entry.publicationStatus = 'disabled';
  respond(res, 200, entry, {}, reqPath, method);
}

/* ------------------------------------------------------------------ */
/* v3 Workspace / Installation handlers                                */
/* ------------------------------------------------------------------ */

async function handleCreateWorkspace(req, res, params, query, reqPath, method) {
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log(method, reqPath, 400, 'invalid body');
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
    return;
  }
  const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : undefined;
  if (!workspaceId) {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'workspaceId required');
    return;
  }
  let workspace = workspaces.get(workspaceId);
  if (!workspace) {
    const now = nowIso();
    workspace = {workspaceId, ownerId: DEFAULT_OWNER_ID, createdAt: now, updatedAt: now};
    workspaces.set(workspaceId, workspace);
  }
  respond(res, 201, workspace, {}, reqPath, method);
}

async function handleGetWorkspace(req, res, params, query, reqPath, method) {
  const workspace = workspaces.get(params.w);
  if (!workspace) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, workspace, {}, reqPath, method);
}

async function handleInstallations(req, res, params, query, reqPath, method) {
  const workspace = workspaces.get(params.w);
  if (!workspace) {
    sendNotFound(res, reqPath, method);
    return;
  }
  const all = [...installations.values()].filter((item) => item.workspaceId === params.w);

  if (method === 'GET') {
    const limit = query.get('limit') ? Number(query.get('limit')) : 100;
    const offset = /^cursor-(\d+)$/.test(query.get('cursor') ?? '') ? Number(/^cursor-(\d+)$/.exec(query.get('cursor'))[1]) : 0;
    const page = all.slice(offset, offset + limit);
    const response = {items: page};
    if (offset + limit < all.length) response.nextCursor = `cursor-${offset + limit}`;
    respond(res, 200, response, {}, reqPath, method);
    return;
  }

  // POST — install an agent into the workspace.
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log(method, reqPath, 400, 'invalid body');
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
    return;
  }
  if (!body || typeof body.agentId !== 'string' || typeof body.versionConstraint !== 'string' || !Array.isArray(body.acceptedPermissions)) {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'agentId/versionConstraint/acceptedPermissions required');
    return;
  }
  const installation = createInstallation({
    workspaceId: params.w,
    agentId: body.agentId,
    versionConstraint: body.versionConstraint,
    acceptedPermissions: body.acceptedPermissions,
  });
  if (!installation) {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'no version satisfies versionConstraint');
    return;
  }
  installations.set(installation.installationId, installation);
  respond(res, 201, installation, {}, reqPath, method);
}

async function handleInstallation(req, res, params, query, reqPath, method) {
  const installation = installations.get(params.i);
  if (!installation || installation.workspaceId !== params.w) {
    sendNotFound(res, reqPath, method);
    return;
  }
  if (method === 'GET') {
    respond(res, 200, installation, {}, reqPath, method);
    return;
  }
  if (method === 'PATCH') {
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      log(method, reqPath, 400, 'invalid body');
      sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
      return;
    }
    if (!body || (body.status !== 'enabled' && body.status !== 'disabled')) {
      sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'status must be enabled or disabled');
      return;
    }
    installation.status = body.status;
    installation.updatedAt = nowIso();
    delete installation.uninstalledAt;
    respond(res, 200, installation, {}, reqPath, method);
    return;
  }
  // DELETE — uninstall.
  const now = nowIso();
  installation.status = 'uninstalled';
  installation.updatedAt = now;
  installation.uninstalledAt = now;
  respond(res, 200, installation, {}, reqPath, method);
}

/* ------------------------------------------------------------------ */
/* v4 Trusted Publication handlers                                     */
/* ------------------------------------------------------------------ */

async function handleEndpointBindings(req, res, params, query, reqPath, method) {
  if (method === 'GET') {
    const items = [...bindings.values()].filter(
      (binding) => binding.providerId === params.p && binding.agentId === params.a,
    );
    respond(res, 200, {items}, {}, reqPath, method);
    return;
  }
  // POST — create a pending endpoint binding.
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log(method, reqPath, 400, 'invalid body');
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
    return;
  }
  if (!body || typeof body.endpoint !== 'string' || typeof body.version !== 'string') {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'endpoint/version required');
    return;
  }
  const now = nowIso();
  const binding = {
    bindingId: randId('bnd-', 14),
    providerId: params.p,
    agentId: params.a,
    agentCardVersion: body.version,
    endpoint: body.endpoint,
    verificationMethod: 'http_well_known',
    verificationStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  bindings.set(binding.bindingId, binding);
  respond(res, 201, binding, {}, reqPath, method);
}

async function handleGetBinding(req, res, params, query, reqPath, method) {
  const binding = bindings.get(params.b);
  if (!binding || binding.providerId !== params.p) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, binding, {}, reqPath, method);
}

async function handleCreateChallenge(req, res, params, query, reqPath, method) {
  const binding = bindings.get(params.b);
  if (!binding || binding.providerId !== params.p) {
    sendNotFound(res, reqPath, method);
    return;
  }
  let challengeUrl;
  try {
    challengeUrl = new URL(binding.endpoint).origin + '/.well-known/nekiro/challenges/';
  } catch {
    challengeUrl = 'https://agent.invalid/.well-known/nekiro/challenges/';
  }
  const challengeId = randId('chg-', 14);
  const challenge = {
    challengeId,
    bindingId: binding.bindingId,
    challengeUrl: challengeUrl + challengeId,
    proof: 'proof-' + hex32(),
    expiresAt: addSeconds(nowIso(), 900),
  };
  challenges.set(challengeId, challenge);
  respond(res, 201, challenge, {}, reqPath, method);
}

async function handleCompleteChallenge(req, res, params, query, reqPath, method) {
  const binding = bindings.get(params.b);
  const challenge = challenges.get(params.c);
  if (!binding || binding.providerId !== params.p) {
    sendNotFound(res, reqPath, method);
    return;
  }
  if (!challenge || challenge.bindingId !== binding.bindingId) {
    sendError(res, 404, 'NOT_FOUND', undefined, reqPath, method, 'challenge not found');
    return;
  }
  const now = nowIso();
  binding.verificationStatus = 'verified';
  binding.verificationEvidenceDigest = hex64();
  binding.verifiedAt = now;
  binding.updatedAt = now;
  challenges.delete(challenge.challengeId);
  respond(res, 200, binding, {}, reqPath, method);
}

async function handleCreateRelease(req, res, params, query, reqPath, method) {
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log(method, reqPath, 400, 'invalid body');
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
    return;
  }
  if (!body || typeof body.version !== 'string' || typeof body.endpointBindingId !== 'string') {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'version/endpointBindingId required');
    return;
  }
  const binding = bindings.get(body.endpointBindingId);
  let origin = 'https://agent.invalid';
  let endpointPath = '/a2a';
  if (binding) {
    try {
      const url = new URL(binding.endpoint);
      origin = url.origin;
      endpointPath = url.pathname || '/';
    } catch {
      /* keep fallbacks */
    }
  }
  const now = nowIso();
  const release = {
    releaseId: randId('rl-', 14),
    providerId: params.p,
    agentId: params.a,
    agentCardVersion: body.version,
    cardDigest: hex64(),
    endpointBindingId: body.endpointBindingId,
    endpointOrigin: origin,
    endpointPath,
    verificationMethod: 'http_well_known',
    state: 'pending_verification',
    createdAt: now,
    updatedAt: now,
  };
  releases.set(release.releaseId, release);
  respond(res, 201, release, {}, reqPath, method);
}

async function handleGetRelease(req, res, params, query, reqPath, method) {
  const release = releases.get(params.r);
  if (!release) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, release, {}, reqPath, method);
}

async function handleReleaseAction(req, res, releaseId, action, reqPath, method) {
  const release = releases.get(releaseId);
  if (!release) {
    sendNotFound(res, reqPath, method);
    return;
  }
  const now = nowIso();
  switch (action) {
    case 'verify':
      if (release.state !== 'pending_verification') {
        sendError(res, 409, 'CONFLICT', undefined, reqPath, method, `cannot verify from ${release.state}`);
        return;
      }
      release.state = 'verified';
      release.verificationEvidenceDigest = hex64();
      release.verifiedAt = now;
      release.updatedAt = now;
      break;
    case 'publish':
      if (release.state !== 'verified') {
        sendError(res, 409, 'CONFLICT', undefined, reqPath, method, `cannot publish from ${release.state}`);
        return;
      }
      release.state = 'published';
      release.publishedAt = now;
      release.updatedAt = now;
      break;
    case 'suspend':
      if (release.state !== 'verified' && release.state !== 'published') {
        sendError(res, 409, 'CONFLICT', undefined, reqPath, method, `cannot suspend from ${release.state}`);
        return;
      }
      release.state = 'suspended';
      release.suspendedAt = now;
      release.updatedAt = now;
      break;
    case 'revoke':
      if (release.state !== 'verified' && release.state !== 'published' && release.state !== 'suspended') {
        sendError(res, 409, 'CONFLICT', undefined, reqPath, method, `cannot revoke from ${release.state}`);
        return;
      }
      release.state = 'revoked';
      release.revokedAt = now;
      release.updatedAt = now;
      break;
    default:
      sendNotFound(res, reqPath, method);
      return;
  }
  respond(res, 200, release, {}, reqPath, method);
}

/* ------------------------------------------------------------------ */
/* v4 Public share handler                                             */
/* ------------------------------------------------------------------ */

async function handlePublicAgent(req, res, params, query, reqPath, method) {
  const share = publicShareFor(params.id);
  if (!share) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, share, {}, reqPath, method);
}

/* ------------------------------------------------------------------ */
/* v4 Invocation + Ledger handlers                                     */
/* ------------------------------------------------------------------ */

async function handleInvoke(req, res, params, query, reqPath, method) {
  const workspace = workspaces.get(params.w);
  if (!workspace) {
    sendNotFound(res, reqPath, method);
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    log(method, reqPath, 400, 'invalid body');
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method);
    return;
  }
  const agentId = typeof body?.agentId === 'string' ? body.agentId : undefined;
  const capability = typeof body?.capability === 'string' ? body.capability : undefined;
  const input = body?.input;
  if (!agentId || !capability || typeof input !== 'object' || input === null || Array.isArray(input)) {
    sendError(res, 400, 'VALIDATION_ERROR', undefined, reqPath, method, 'agentId/capability/input required');
    return;
  }

  const invocationId = randId('inv-', 14);
  const rootTaskId = randId('task-', 14);
  const traceId = newTraceId();
  const startedAt = nowIso();
  const target = invocationTarget(params.w, agentId);
  const latencyMs = 120 + Math.floor(Math.random() * 280);

  if (body.stream === true) {
    // SSE result stream: accepted -> chunk -> chunk -> completed.
    const events = [
      {schemaVersion: '2', sequence: 0, type: 'accepted', status: 'pending', invocationId, rootTaskId, traceId},
      {schemaVersion: '2', sequence: 1, type: 'chunk', status: 'running', invocationId, rootTaskId, traceId, chunkIndex: 0, chunk: {part: 'first', echo: input}},
      {schemaVersion: '2', sequence: 2, type: 'chunk', status: 'running', invocationId, rootTaskId, traceId, chunkIndex: 1, chunk: {part: 'second', note: 'streamed mock chunk'}},
      {schemaVersion: '2', sequence: 3, type: 'completed', status: 'succeeded', invocationId, rootTaskId, traceId},
    ];

    const record = buildRecord({
      invocationId,
      rootTaskId,
      traceId,
      caller: {type: 'user', id: workspace.ownerId},
      workspaceId: params.w,
      targetAgentId: agentId,
      agentCardVersion: target.agentCardVersion,
      agentReleaseId: target.agentReleaseId,
      agentCardDigest: target.agentCardDigest,
      capability,
      status: 'succeeded',
      latencyMs,
      createdAt: startedAt,
      updatedAt: addSeconds(startedAt, 4),
    });
    invocations.set(invocationId, {
      record,
      events: buildSucceededEvents(record, startedAt, [512, 384], latencyMs),
    });
    traces.set(traceId, {traceId, invocations: [record]});

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...CORS_HEADERS,
    });
    for (const event of events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
    log(method, reqPath, 200, `SSE ${events.length} events (${invocationId})`);
    return;
  }

  // Non-streaming JSON result.
  const completedAt = addSeconds(startedAt, Math.ceil(latencyMs / 1000));
  const record = buildRecord({
    invocationId,
    rootTaskId,
    traceId,
    caller: {type: 'user', id: workspace.ownerId},
    workspaceId: params.w,
    targetAgentId: agentId,
    agentCardVersion: target.agentCardVersion,
    agentReleaseId: target.agentReleaseId,
    agentCardDigest: target.agentCardDigest,
    capability,
    status: 'succeeded',
    latencyMs,
    createdAt: startedAt,
    updatedAt: completedAt,
  });
  invocations.set(invocationId, {
    record,
    events: buildSucceededEvents(record, startedAt, [1024, 512], latencyMs),
  });
  traces.set(traceId, {traceId, invocations: [record]});
  const result = {
    ok: true,
    echo: input,
    capability,
    agent: agentId,
    agentVersion: target.agentCardVersion,
    chunks: 2,
    latencyMs,
    completedAt,
    note: 'Mock gateway response — no real Agent executed.',
  };
  const payload = {
    schemaVersion: '1',
    invocationId,
    rootTaskId,
    traceId,
    status: 'succeeded',
    result,
  };
  respond(res, 200, payload, {}, reqPath, method, invocationId);
}

async function handleGetInvocation(req, res, params, query, reqPath, method) {
  const entry = invocations.get(params.i);
  if (!entry || entry.record.workspaceId !== params.w) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, {invocation: entry.record, events: entry.events}, {}, reqPath, method);
}

async function handleGetTrace(req, res, params, query, reqPath, method) {
  const trace = traces.get(params.t);
  if (!trace) {
    sendNotFound(res, reqPath, method);
    return;
  }
  respond(res, 200, trace, {}, reqPath, method);
}

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */

server.listen(PORT, HOST, () => {
  console.log('NeKiro Console mock gateway listening');
  console.log(`  http://${HOST}:${PORT}`);
  console.log(`  Public agent origin (VITE_NEKIRO_PUBLIC_AGENT_ORIGIN): ${PUBLIC_ORIGIN}`);
  console.log(`  Seeded: ${cards.size} catalog cards, ${workspaces.size} workspaces, ${installations.size} installations, ${bindings.size} bindings, ${releases.size} releases, ${invocations.size} invocations`);
  console.log('  Ctrl+C to stop.');
});

function shutdown() {
  console.log('\nMock gateway shutting down.');
  server.close(() => process.exit(0));
  // Force-exit if connections linger.
  setTimeout(() => process.exit(0), 500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
