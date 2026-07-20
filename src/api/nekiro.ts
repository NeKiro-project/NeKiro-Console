import type {Agent, Installation, InstallationStatus, PlatformErrorView, Workspace} from '../types';

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
  name?: string;
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

export interface InstallAgentRequest {
  agentId: string;
  versionConstraint: string;
  acceptedPermissions: string[];
}

export interface InstallationList {
  items: Installation[];
  nextCursor?: string;
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

  toView(): PlatformErrorView {
    return {
      status: this.status,
      code: this.code,
      message: this.message,
      traceId: this.traceId,
    };
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
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  searchAgents(params: CatalogSearchParams = {}): Promise<CatalogSearchResponse> {
    const suffix = this.queryString(params);
    return this.request<CatalogSearchResponse>('/v3/agents' + suffix);
  }

  registerAgent(card: AgentCardV02): Promise<CatalogEntry> {
    return this.request<CatalogEntry>('/v3/agents', {
      method: 'POST',
      body: JSON.stringify({card}),
    });
  }

  getAgentVersion(agentId: string, version: string): Promise<CatalogEntry> {
    return this.request<CatalogEntry>(this.versionPath(agentId, version));
  }

  publishAgentVersion(agentId: string, version: string): Promise<CatalogEntry> {
    return this.request<CatalogEntry>(this.versionPath(agentId, version) + '/publish', {method: 'POST'});
  }

  disableAgentVersion(agentId: string, version: string): Promise<CatalogEntry> {
    return this.request<CatalogEntry>(this.versionPath(agentId, version) + '/disable', {method: 'POST'});
  }

  createWorkspace(workspaceId: string): Promise<Workspace> {
    return this.request<Workspace>('/v3/workspaces', {
      method: 'POST',
      body: JSON.stringify({workspaceId: readText(workspaceId, 'workspaceId')}),
    });
  }

  getWorkspace(workspaceId: string): Promise<Workspace> {
    return this.request<Workspace>('/v3/workspaces/' + encodeURIComponent(readText(workspaceId, 'workspaceId')));
  }

  installAgent(workspaceId: string, request: InstallAgentRequest): Promise<Installation> {
    return this.request<Installation>(this.workspaceInstallationPath(workspaceId), {
      method: 'POST',
      body: JSON.stringify({
        agentId: readText(request.agentId, 'agentId'),
        versionConstraint: readText(request.versionConstraint, 'versionConstraint'),
        acceptedPermissions: request.acceptedPermissions,
      }),
    });
  }

  listInstallations(workspaceId: string, params: {limit?: number; cursor?: string} = {}): Promise<InstallationList> {
    const query = this.queryString({limit: params.limit ?? 25, cursor: params.cursor});
    return this.request<InstallationList>(this.workspaceInstallationPath(workspaceId) + query);
  }

  getInstallation(workspaceId: string, installationId: string): Promise<Installation> {
    return this.request<Installation>(this.installationPath(workspaceId, installationId));
  }

  updateInstallation(workspaceId: string, installationId: string, status: Exclude<InstallationStatus, 'uninstalled'>): Promise<Installation> {
    return this.request<Installation>(this.installationPath(workspaceId, installationId), {
      method: 'PATCH',
      body: JSON.stringify({status}),
    });
  }

  uninstallAgent(workspaceId: string, installationId: string): Promise<Installation> {
    return this.request<Installation>(this.installationPath(workspaceId, installationId), {method: 'DELETE'});
  }

  private versionPath(agentId: string, version: string): string {
    return '/v3/agents/' + encodeURIComponent(agentId) + '/versions/' + encodeURIComponent(version);
  }

  private workspaceInstallationPath(workspaceId: string): string {
    return '/v3/workspaces/' + encodeURIComponent(readText(workspaceId, 'workspaceId')) + '/installations';
  }

  private installationPath(workspaceId: string, installationId: string): string {
    return this.workspaceInstallationPath(workspaceId) + '/' + encodeURIComponent(readText(installationId, 'installationId'));
  }

  private queryString(params: object): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params) as Array<[string, string | number | undefined]>) {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    }
    const serialized = query.toString();
    return serialized ? '?' + serialized : '';
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) {
      throw new NekiroApiError(0, 'NeKiro Control Plane API base URL is not configured.', 'CONFIGURATION_ERROR');
    }

    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) {
      headers.set('Authorization', 'Bearer ' + this.token);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.baseUrl + '/'), {...init, headers});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'NeKiro API request failed.';
      throw new NekiroApiError(0, message, 'NETWORK_ERROR');
    }

    const responseText = await response.text();
    const payload = parseJson<PlatformErrorPayload | T>(responseText);
    if (!response.ok) {
      const platformError = isPlatformErrorPayload(payload) ? payload.error ?? payload : undefined;
      throw new NekiroApiError(
        response.status,
        platformError?.message || 'NeKiro Control Plane API returned HTTP ' + response.status + '.',
        platformError?.code,
        platformError?.traceId || response.headers.get('x-nek-trace-id') || undefined,
      );
    }

    if (response.status === 204 || responseText.length === 0) {
      return undefined as T;
    }
    if (payload === undefined) {
      throw new NekiroApiError(response.status, 'NeKiro Control Plane API returned invalid JSON.', 'INVALID_RESPONSE');
    }
    return payload as T;
  }
}

export function buildAgentCard(input: AgentCardInput): AgentCardV02 {
  const agentId = readIdentifier(input.agentId, 'agentId');
  const permissions = input.permissions.map((permission, index) => ({
    id: readIdentifier(permission.id, 'permissions[' + index + '].id'),
    description: readText(permission.description, 'permissions[' + index + '].description'),
  }));
  ensureUnique(permissions.map((permission) => permission.id), 'permission id');

  const declaredPermissions = new Set(permissions.map((permission) => permission.id));
  const parsed = parseCapabilities(input.capabilitiesJson);
  const seenSkillIds = new Set<string>();
  const skills = parsed.map((capability, index) => {
    const id = readIdentifier(capability.id ?? capability.type, 'capabilities[' + index + '].id');
    if (seenSkillIds.has(id)) {
      throw new Error('duplicate capability id: ' + id);
    }
    seenSkillIds.add(id);
    const requiredPermissions = readStringArray(
      capability.requiredPermissions ?? permissions.map((permission) => permission.id),
      'capabilities[' + index + '].requiredPermissions',
    );
    for (const permissionId of requiredPermissions) {
      if (!declaredPermissions.has(permissionId)) {
        throw new Error('required permission is not declared in permissions: ' + permissionId);
      }
    }

    return {
      id,
      name: readText(capability.name ?? id, 'capabilities[' + index + '].name'),
      description: readText(capability.description ?? 'Capability ' + id + '.', 'capabilities[' + index + '].description'),
      inputSchema: readJsonObject(capability.inputSchema) ?? {type: 'object'},
      outputSchema: readJsonObject(capability.outputSchema) ?? {type: 'object'},
      requiredPermissions,
    } satisfies AgentSkill;
  });

  const endpoint = readText(input.endpoint, 'endpoint');
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new Error('endpoint must be an absolute http or https URL');
  }
  if (!['http:', 'https:'].includes(endpointUrl.protocol)) {
    throw new Error('endpoint must use http or https');
  }
  if (endpointUrl.username || endpointUrl.password) {
    throw new Error('endpoint must not contain userinfo credentials');
  }

  const version = readText(input.version, 'version');
  if (!isSemver(version)) {
    throw new Error('version must be strict SemVer');
  }

  return {
    schemaVersion: '0.2',
    agentId,
    name: readText(input.name ?? input.agentId, 'name'),
    description: readText(input.description, 'description'),
    owner: {
      id: readIdentifier(input.ownerId, 'ownerId'),
      displayName: readText(input.ownerDisplayName, 'ownerDisplayName'),
    },
    version,
    protocol: {
      type: 'a2a',
      version: '0.3.0',
      transport: 'JSONRPC',
      endpoint,
    },
    skills,
    authentication: {type: input.authentication},
    permissions,
    limits: input.limits,
  };
}

export function mapCatalogEntry(entry: CatalogEntry): Agent {
  return {
    id: entry.card.agentId,
    name: entry.card.name,
    version: entry.card.version,
    owner: entry.card.owner.displayName,
    ownerId: entry.card.owner.id,
    description: entry.card.description,
    tags: entry.card.skills.map((skill) => skill.id),
    status: entry.publicationStatus,
    schema: JSON.stringify(entry.card, null, 2),
    permissions: entry.card.permissions,
    registeredAt: entry.registeredAt,
    publishedAt: entry.publishedAt,
  };
}

export function toPlatformErrorView(error: unknown, fallbackMessage: string): PlatformErrorView {
  if (error instanceof NekiroApiError) {
    return error.toView();
  }
  return {
    status: 0,
    code: 'CLIENT_ERROR',
    message: error instanceof Error ? error.message : fallbackMessage,
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
    throw new Error(field + ' must be a non-empty string');
  }
  return value.trim();
}

function readIdentifier(value: unknown, field: string): string {
  const text = readText(value, field);
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9._:-]{0,127})$/.test(text)) {
    throw new Error(field + ' must be a NeKiro safe identifier');
  }
  return text;
}

function readStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim() !== '')) {
    throw new Error(field + ' must be an array of non-empty strings');
  }
  return value.map((item) => item.trim());
}

function readJsonObject(value: unknown): JsonObject | undefined {
  return isRecord(value) ? value : undefined;
}

function ensureUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error('duplicate ' + label + ': ' + value);
    }
    seen.add(value);
  }
}

function isSemver(value: string): boolean {
  return /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
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
