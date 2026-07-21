# NeKiro Console runtime integration

Date: 2026-07-21

The production Console uses one active Workspace and Owner authorization. It
calls only public Gateway routes:

- Catalog, Workspace, and Installation: Northbound v3.
- Invoke JSON/SSE: `POST /v4/workspaces/{workspaceId}/invocations`.
- Invocation metadata: `GET /v4/workspaces/{workspaceId}/invocations/{invocationId}`.
- Trace lineage: `GET /v4/workspaces/{workspaceId}/traces/{traceId}`.

The TypeScript client is a strict handwritten mapping of Agent Card 0.2,
Platform Error v4, Invocation Result v1, Result Stream Event v2, Invocation
Event 0.3, and the v4 metadata projections. SSE success requires contiguous
event and chunk indexes, stable correlation, and one terminal event.

The development token comes only from `VITE_NEKIRO_TOKEN` and is never written
to browser storage. Agent authentication forms declare the card authentication
type only and do not collect secrets. Ledger views display metadata and event
facts, never persisted Agent input/output payloads.
