import { Agent, Installation, TraceNode, LedgerEvent } from './types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'DataSynthesizer_Alpha',
    name: 'DataSynthesizer_Alpha',
    version: 'v1.4.2',
    owner: 'CoreSys',
    description: 'Aggregates distributed telemetry streams and formats into standardized JSON payloads for analysis.',
    tags: ['ETL', 'Telemetry', 'JSON'],
    status: 'published',
    schema: JSON.stringify({
      "capabilities": [
        {
          "type": "data_ingestion",
          "protocols": ["grpc", "http"],
          "max_throughput_mb": 500
        },
        {
          "type": "transformation",
          "schema_validation": true
        }
      ],
      "dependencies": {
        "required": ["logger_agent_v2", "auth_svc"]
      }
    }, null, 2)
  },
  {
    id: 'VectorEmbed_X',
    name: 'VectorEmbed_X',
    version: 'v0.9.1',
    owner: 'AI_Ops',
    description: 'High-throughput text embedding generator for semantic search indexing.',
    tags: ['NLP', 'Embeddings'],
    status: 'published',
    schema: JSON.stringify({
      "capabilities": [
        {
          "type": "vectorization",
          "dimensions": 1536,
          "batch_size": 256
        }
      ],
      "dependencies": {
        "optional": ["gpu_cluster_west"]
      }
    }, null, 2)
  },
  {
    id: 'LegacyScraper_V2',
    name: 'LegacyScraper_V2',
    version: 'v2.1.0',
    owner: 'ExtData',
    description: 'Replaced by DataSynthesizer_Alpha. Do not use for new orchestrations.',
    tags: ['Scrape', 'HTML'],
    status: 'deprecated',
    schema: JSON.stringify({
      "deprecated": true,
      "replaced_by": "DataSynthesizer_Alpha"
    }, null, 2)
  },
  {
    id: 'AuthGateway_Node',
    name: 'AuthGateway_Node',
    version: 'v3.0.0',
    owner: 'SecOps',
    description: 'Handles JWT verification and RBAC checks for downstream agent invocations.',
    tags: ['Security', 'Gateway'],
    status: 'published',
    schema: JSON.stringify({
      "auth_type": "JWT_RS256",
      "roles": ["admin", "operator", "viewer"]
    }, null, 2)
  }
];

export const INITIAL_INSTALLATIONS: Installation[] = [
  {
    id: 'ds-992a-4b1c',
    agentId: 'DataSynthesizer_Alpha',
    agentName: 'DataSynthesizer_v2',
    version: '2.1.4-stable',
    acceptedPermissions: ['READ_S3', 'EXEC_LAMBDA', 'NET_EGRESS_HTTP', 'WRITE_LOGS'],
    installedDate: '2023-10-24',
    state: 'ENABLED',
    endpoint: 'ws://nk-0814.internal/ds-992a',
    installedBy: 'sys-admin'
  },
  {
    id: 'cg-118b-9x2m',
    agentId: 'CodeGen_Assist',
    agentName: 'CodeGen_Assist',
    version: '1.0.8-beta',
    acceptedPermissions: ['READ_REPO', 'WRITE_PR'],
    installedDate: '2023-10-22',
    state: 'DISABLED',
    endpoint: 'ws://nk-0814.internal/cg-118b',
    installedBy: 'sys-admin'
  },
  {
    id: 'gw-404f-err1',
    agentId: 'AuthGateway_Node',
    agentName: 'ExtAPI_Gateway',
    version: '3.0.0',
    acceptedPermissions: ['NET_OUT'],
    installedDate: '2023-10-15',
    state: 'FAULTED',
    endpoint: 'ws://nk-0814.internal/gw-404f',
    installedBy: 'sys-admin'
  }
];

export const PERMISSIONS_DB: Record<string, { scope: string; description: string; highRisk?: boolean }> = {
  READ_S3: {
    scope: 'arn:aws:s3:::workspace-data/*',
    description: 'Allows read access to workspace objects stored in S3 datastores.'
  },
  EXEC_LAMBDA: {
    scope: 'fn-data-process-*',
    description: 'Allows triggering processing lambda functions dynamically.'
  },
  NET_EGRESS_HTTP: {
    scope: '*.api.openai.com (Unrestricted)',
    description: 'Allows external HTTP network calls to specific machine learning API nodes.',
    highRisk: true
  },
  WRITE_LOGS: {
    scope: 'arn:aws:logs:::workspace-logs/*',
    description: 'Allows writing system telemetry logs to the logging system.'
  },
  READ_REPO: {
    scope: 'github.com/org-nk-0814/*',
    description: 'Allows read-only access to source code files in connected organization git repositories.'
  },
  WRITE_PR: {
    scope: 'github.com/org-nk-0814/* (PR Creation)',
    description: 'Allows opening pull requests and submitting auto-fixes.',
    highRisk: true
  },
  NET_OUT: {
    scope: 'unrestricted://*',
    description: 'Allows full outgoing TCP/UDP connections to external gateways.',
    highRisk: true
  }
};

// Initial traces and execution logs for historical display
export interface TraceHistory {
  id: string;
  name: string;
  rootId: string;
  duration: string;
  timestamp: string;
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
  rootNode: TraceNode;
  events: LedgerEvent[];
}

export const TRACE_HISTORIES: TraceHistory[] = [
  {
    id: 'trace-1',
    name: 'Telemetry Ingestion Stream',
    rootId: '9a7b-4c21-8f3e-001d',
    duration: '24ms',
    timestamp: '14:02:45',
    status: 'TIMEOUT',
    rootNode: {
      id: 'r1',
      name: 'Orchestrator.EntryPoint',
      duration: '24ms',
      iconName: 'adjust',
      status: 'TIMEOUT',
      children: [
        {
          id: 'n1',
          name: 'Auth.VerifyToken',
          duration: '4ms',
          iconName: 'sync_alt',
          status: 'SUCCESS',
          children: [
            {
              id: 'n1-1',
              name: 'DB.Query.UserRole',
              duration: '2ms',
              iconName: 'database',
              status: 'SUCCESS'
            }
          ]
        },
        {
          id: 'n2',
          name: 'Agent.Spawn.DataProcessor',
          duration: '18ms',
          iconName: 'mediation',
          status: 'TIMEOUT',
          children: [
            {
              id: 'n2-1',
              name: 'S3.FetchObject.Meta',
              duration: '12ms',
              iconName: 'cloud_upload',
              status: 'SUCCESS'
            },
            {
              id: 'n2-2',
              name: 'Compute.Transform.Hash',
              duration: '5ms',
              iconName: 'memory',
              status: 'SUCCESS'
            },
            {
              id: 'n2-3',
              name: 'External.API.Callback',
              duration: 'TIMEOUT',
              iconName: 'link_off',
              status: 'TIMEOUT'
            }
          ]
        }
      ]
    },
    events: [
      {
        id: 'e1',
        time: '14:02:45.001',
        title: 'Trace Initiated',
        subtitle: 'Orchestration process generated dynamically.',
        details: [{ label: 'id', value: 'req_8f72h2' }]
      },
      {
        id: 'e2',
        time: '14:02:45.025',
        title: 'Auth Validated',
        subtitle: 'User access tokens parsed and authenticated.',
        details: [{ label: 'role_hash', value: 'a7x...9p1' }],
        badgeText: 'AUTH_OK',
        badgeType: 'success'
      },
      {
        id: 'e3',
        time: '14:02:45.029',
        title: 'Agent Spawned',
        subtitle: 'Initiating worker node for computing pipeline.',
        badgeText: 'SPWN_OK',
        badgeType: 'success',
        details: [
          { label: 'inst_id', value: 'i-0x98abf' },
          { label: 'mem_alloc', value: '512MB' }
        ]
      },
      {
        id: 'e4',
        time: '14:02:45.052',
        title: 'Callback Timeout',
        subtitle: 'External telemetry bridge fails to respond.',
        badgeText: 'ERR_504',
        badgeType: 'error',
        errorBox: {
          title: 'TIMEOUT IN DELEGATED EXECUTION',
          text: 'The orchestrator waited for external service callback but exceeded the security threshold.',
          code: 'dest: ext.svc.cluster.local\nttl: reached (10000ms)'
        }
      }
    ]
  },
  {
    id: 'trace-2',
    name: 'Embeddings Generation Run',
    rootId: 'b33a-8cc2-1a4f-9e87',
    duration: '128ms',
    timestamp: '14:15:10',
    status: 'SUCCESS',
    rootNode: {
      id: 'r2',
      name: 'Embeddings.EntryPoint',
      duration: '128ms',
      iconName: 'adjust',
      status: 'SUCCESS',
      children: [
        {
          id: 't1',
          name: 'RateLimiter.Check',
          duration: '1ms',
          iconName: 'sync_alt',
          status: 'SUCCESS'
        },
        {
          id: 't2',
          name: 'VectorProcessor.BatchCompute',
          duration: '125ms',
          iconName: 'memory',
          status: 'SUCCESS',
          children: [
            {
              id: 't2-1',
              name: 'TextTokenizer.Process',
              duration: '15ms',
              iconName: 'database',
              status: 'SUCCESS'
            },
            {
              id: 't2-2',
              name: 'GPU.MatrixMultiply',
              duration: '110ms',
              iconName: 'memory',
              status: 'SUCCESS'
            }
          ]
        }
      ]
    },
    events: [
      {
        id: 'e2-1',
        time: '14:15:10.005',
        title: 'Trace Initiated',
        details: [{ label: 'id', value: 'req_v77b9s' }]
      },
      {
        id: 'e2-2',
        time: '14:15:10.012',
        title: 'Rate Limit Checked',
        subtitle: 'Verified workspace quota constraints.',
        badgeText: 'QUOTA_OK',
        badgeType: 'success',
        details: [{ label: 'tokens_remaining', value: '450,299' }]
      },
      {
        id: 'e2-3',
        time: '14:15:10.020',
        title: 'GPU Allocated',
        subtitle: 'Provisioned dynamic execution thread.',
        badgeText: 'GPU_ALLOC',
        badgeType: 'success',
        details: [{ label: 'cluster_node', value: 'gpu-west-node4' }]
      },
      {
        id: 'e2-4',
        time: '14:15:10.133',
        title: 'Orchestration Complete',
        subtitle: 'Successfully generated high-density vector embeddings.',
        badgeText: 'COMPLETED',
        badgeType: 'success',
        details: [
          { label: 'vectors_written', value: '256' },
          { label: 'dimensions', value: '1536' }
        ]
      }
    ]
  }
];
