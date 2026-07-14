export interface Agent {
  id: string;
  name: string;
  version: string;
  owner: string;
  description: string;
  tags: string[];
  status: 'published' | 'deprecated' | 'draft' | 'disabled';
  schema: string;
}

export interface Installation {
  id: string;
  agentId: string;
  agentName: string;
  version: string;
  acceptedPermissions: string[];
  installedDate: string;
  state: 'ENABLED' | 'DISABLED' | 'FAULTED';
  endpoint: string;
  installedBy: string;
}

export interface Permission {
  name: string;
  scope: string;
  description: string;
  highRisk?: boolean;
}

export interface TraceNode {
  id: string;
  name: string;
  duration?: string;
  iconName: string;
  status?: 'SUCCESS' | 'TIMEOUT' | 'ERROR' | 'PENDING';
  children?: TraceNode[];
}

export interface LedgerEvent {
  id: string;
  time: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'error' | 'default';
  details?: { label: string; value: string }[];
  errorBox?: { title: string; text: string; code: string };
}

export interface LogChunk {
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'stream' | 'chunk';
  message: string;
  details?: string;
  chunkData?: string;
}
