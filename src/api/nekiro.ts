import type {Agent} from '../types';

export type PublicationStatus = 'draft' | 'published' | 'disabled';
export type AuthenticationType = 'none' | 'api_key' | 'http_bearer' | 'oauth2_client_credentials' | 'mutual_tls';
export type JsonObject = Record<string, unknown>;

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  inputSchema: JsonObject;
  outputSchema: JsonObject;
  requiredPermissions: string[];
}

export interface AgentPermission {
  id: string;
  description: string;
}

export interface AgentCardV02 {
  schemaVersion: '0.2';
  agentId: string;
  name: string;
  description: string;
  owner: {
    id: string;
    displayName: string;
  };
  version: string;
  protocol: {
    type: 'a2a';
    version: '0.3.0';
    transport: 'JSONRPC';
    endpoint: string;
  };
  skills: AgentSkill[];
  authentication: {
    type: AuthenticationType;
  };
  permissions: AgentPermission[];
  limits: {
    timeoutMs: number;
    maxInputBytes: number;
    maxOutputBytes: number;
    streaming: boolean;
  };
}

export interface CatalogEntry {
  card: AgentCardV02;
  publicationStatus: PublicationStatus;
  registeredAt: string;
  publishedAt?: string;
}

export interface CatalogSearchResponse {
  items: CatalogEntry[];
  nextCursor?: string;
}

export interface CatalogSearchParams {
  query?: string;
  capability?: string;
  ownerId?: string;
  limit?: number;
  cursor?: string;
}

export interface AgentCardInput {
  agentId: string;
  ownerId: string;
  ownerDisplayName: string;
  description: string;
  version: string;
  endpoint: string;
  authentication: AuthenticationType;
  permissions: AgentPermission[];
  capabilitiesJson: string;
  limits: AgentCardV02['limits'];
}

interface PlatformErrorPayload {
  code?: string;
  message?: string;
  traceId?: string;
  error?: {
    code?: string;
    message?: string;
    traceId?: string;
  };
}

export class NekiroApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly traceId?: string;

  constructor(status: number, message: string, code?: string, traceId?: string) {
    super(message);
    this.name = 'NekiroApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

interface NekiroApiClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export class NekiroApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NekiroApiClientOptions) {
    this.baseUrl = options.baseUrl.trim().replace(/\/+$/, '');
    this.token = options.token?.trim() ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  searchAgents(params: CatalogSearchParams = {}): Promise<CatalogSearchResponse> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<CatalogSearchResponse>(`/v2/agents${suffix}`);
  }

  registerAgent(card: AgentCardV02): Promise<CatalogEntry> {
    return this.request<CatalogEntry>('/v2/agents', {
      method: 'POST',
      body: JSON.stringify({card}),
    });
  }

  getAgentVersion(agentId: string, version: string): Promise<CatalogEntry> {
    return this.request<CatalogEntry>(this.versionPath(agentId, version));
  }

  publishAgentVersion(agentId: string, version: string): Promise<CatalogEntry> {
    return this.request<CatalogEntry>(`${this.versionPath(agentId, version)}/publish`, {method: 'POST'});
  }

  disableAgentVersion(agentId: string, version: string): Promise<CatalogEntry> {
    return this.request<CatalogEntry>(`${this.versionPath(agentId, version)}/disable`, {method: 'POST'});
  }

  private versionPath(agentId: string, version: string): string {
    return `/v2/agents/${encodeURIComponent(agentId)}/versions/${encodeURIComponent(version)}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new NekiroApiError(0, 'NeKiro Catalog API base URL is not configured.', 'CONFIGURATION_ERROR');
    }

    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {...init, headers});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Catalog API request failed.';
      throw new NekiroApiError(0, message, 'NETWORK_ERROR');
    }

    const responseText = await response.text();
    const payload = parseJson<PlatformErrorPayload | T>(responseText);
    if (!response.ok) {
      const platformError = isPlatformErrorPayload(payload) ? payload.error ?? payload : undefined;
      throw new NekiroApiError(
        response.status,
        platformError?.message || `NeKiro Catalog API returned HTTP ${response.status}.`,
        platformError?.code,
        platformError?.traceId,
      );
    }

    if (response.status === 204 || responseText.length === 0) {
      return undefined as T;
    }
    if (payload === undefined) {
      throw new NekiroApiError(response.status, 'NeKiro Catalog API returned invalid JSON.', 'INVALID_RESPONSE');
    }
    return payload as T;
  }
}

export function buildAgentCard(input: AgentCardInput): AgentCardV02 {
  const parsed = parseCapabilities(input.capabilitiesJson);
  const seenIds = new Set<string>();
  const skills = parsed.map((capability, index) => {
    const id = readText(capability.id ?? capability.type, `capabilities[${index}].id`);
    if (seenIds.has(id)) {
      throw new Error(`duplicate capability id: ${id}`);
    }
    seenIds.add(id);
    const name = readText(capability.name ?? id, `capabilities[${index}].name`);
    const description = readText(capability.description ?? `Capability ${name}.`, `capabilities[${index}].description`);
    const requiredPermissions = readStringArray(
      capability.requiredPermissions ?? input.permissions.map((permission) => permission.id),
      `capabilities[${index}].requiredPermissions`,
    );

    return {
      id,
      name,
      description,
      inputSchema: readJsonObject(capability.inputSchema) ?? {type: 'object'},
      outputSchema: readJsonObject(capability.outputSchema) ?? {type: 'object'},
      requiredPermissions,
    } satisfies AgentSkill;
  });

  const endpoint = readText(input.endpoint, 'endpoint');
  const endpointUrl = new URL(endpoint);
  if (!['http:', 'https:'].includes(endpointUrl.protocol)) {
    throw new Error('endpoint must use http or https');
  }

  return {
    schemaVersion: '0.2',
    agentId: readText(input.agentId, 'agentId'),
    name: readText(input.agentId, 'agentId'),
    description: readText(input.description, 'description'),
    owner: {
      id: readText(input.ownerId, 'ownerId'),
      displayName: readText(input.ownerDisplayName, 'ownerDisplayName'),
    },
    version: readText(input.version, 'version'),
    protocol: {
      type: 'a2a',
      version: '0.3.0',
      transport: 'JSONRPC',
      endpoint,
    },
    skills,
    authentication: {type: input.authentication},
    permissions: input.permissions.map((permission) => ({
      id: readText(permission.id, 'permission.id'),
      description: readText(permission.description, 'permission.description'),
    })),
    limits: input.limits,
  };
}

export function mapCatalogEntry(entry: CatalogEntry): Agent {
  return {
    id: entry.card.agentId,
    name: entry.card.name,
    version: `v${entry.card.version}`,
    owner: entry.card.owner.displayName,
    description: entry.card.description,
    tags: entry.card.skills.map((skill) => skill.id),
    status: entry.publicationStatus,
    schema: JSON.stringify(entry.card, null, 2),
  };
}

function parseCapabilities(value: string): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('capabilitiesJson must be valid JSON');
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.capabilities) || parsed.capabilities.length === 0) {
    throw new Error('capabilitiesJson must contain a non-empty capabilities array');
  }
  if (!parsed.capabilities.every(isRecord)) {
    throw new Error('every capability must be a JSON object');
  }
  return parsed.capabilities;
}

function readText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim() !== '')) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  return value.map((item) => item.trim());
}

function readJsonObject(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJson<T>(value: string): T | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function isPlatformErrorPayload(value: unknown): value is PlatformErrorPayload {
  return isRecord(value) && ('code' in value || 'message' in value || 'traceId' in value || 'error' in value);
}
