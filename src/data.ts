export const INVOCATION_CONTRACT_ENDPOINTS = [
  'POST /v3/workspaces/{workspaceId}/invocations',
  'GET /v3/invocations/{invocationId}',
  'GET /v3/traces/{traceId}',
] as const;

export const LEDGER_CONTRACT_FACTS = [
  'Invocation Dispatch, A2A Router, and metadata-only Ledger remain backend-gated for this Console MVP.',
  'The Console must not render simulated trace trees or fabricated timeout events as platform facts.',
  'Future reads will use the Northbound Invocation and Trace endpoints after the headless Invoke -> Record path is delivered.',
] as const;
