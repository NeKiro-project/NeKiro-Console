# NeKiro Console MVP

React/Vite/TypeScript/Tailwind Console for the NeKiro Agent Operating Platform.

This Console follows the MVP spec in docs/superpowers/specs/2026-07-16-nekiro-console-mvp-spec.md.

## Live surfaces

- Registry: GET/POST /v3/agents, exact reads, publish, and disable for Agent Card v0.2.
- Workspace: POST /v3/workspaces and GET /v3/workspaces/{workspaceId} from the header.
- Installations: install, list, enable, disable, and uninstall through /v3/workspaces/{workspaceId}/installations.
- Trusted Publication: provider-owned Binding, Challenge, and immutable Release lifecycle through public /v4 Gateway routes.
- Installation trust handoff: an explicit Release ID is preflighted through GET /v4/releases/{releaseId}; Catalog publication alone is not trusted publication.

## Runtime surfaces

- Invocations uses `POST /v4/workspaces/{workspaceId}/invocations` for JSON and
  SSE results, with strict correlation and terminal-event validation.
- Ledger reads metadata-only Invocation and Trace projections through the same
  Workspace-scoped Gateway API. No fake traces, task streams, or timeout events
  are rendered.
- The canonical nested path is `Agent B -> Agent SDK -> A2A Router -> Agent A`.
  The Console invokes B through Gateway v4 and reads the root/child lineage from
  the metadata-only Ledger; it never accepts an Agent endpoint or runtime
  credential in the form.
- The browser uses separate provider and Workspace-owner bearer contexts. Agent
  authentication is declaration-only and never collects Agent secrets.

## Configuration

Create .env.local or export these values for local development:

    VITE_NEKIRO_API_BASE_URL=https://gateway.example.test
    VITE_NEKIRO_PROVIDER_ID=
    VITE_NEKIRO_PROVIDER_NAME=
    VITE_NEKIRO_PROVIDER_TOKEN=
    VITE_NEKIRO_OWNER_TOKEN=
    VITE_NEKIRO_DEFAULT_WORKSPACE_ID=

`VITE_NEKIRO_PROVIDER_TOKEN` is used only for provider Catalog and Trusted
Publication operations. `VITE_NEKIRO_OWNER_TOKEN` is used only for Discovery,
Workspace, Installation, Invocation, and Ledger operations. Both are sent only
as Authorization headers and are not written to browser storage.

The operational path is:

1. Register an Agent Card with the provider context.
2. Create and verify an Endpoint Binding, then create, verify, and publish an immutable Release.
3. Give the Release ID to the Workspace owner.
4. Preflight that exact Release in Installations, accept permissions, and install the exact Card version.
5. Invoke only an enabled Installation that has a returned `installedReleaseId`.

## Failure and recovery ownership

The Console preserves the Gateway HTTP status, stable error code, trace ID, and
correlated invocation IDs where the contract returns them. Timeout, cancellation,
unavailable endpoint, disabled Installation, suspended/revoked Release, invalid
proof, expired/reused challenge, and malformed SSE are distinct failure
categories; the Console does not retry or turn them into success.

Provider recovery is owned by the provider: issue a fresh challenge, repair the
declared endpoint, or create a new Release when the server requires it. Workspace
owner recovery is owned by the owner: review the exact Release ID and permissions,
enable or uninstall an Installation according to the server state, and submit a
new invocation only through an enabled trusted Installation. Router and Ledger
facts remain server-owned and are inspected through the public Gateway.

## Run locally

    npm install
    npm run dev

## Verification

    npm test
    npm run typecheck
    npm run lint
    npm run build
    rg "/v4/workspaces/.+invocations|/v4/workspaces/.+traces" src docs -n
    rg "INITIAL_AGENTS|INITIAL_INSTALLATIONS|TRACE_HISTORIES" src -n

## Browser acceptance

The browser acceptance suite runs against a fresh real Gateway and Compose
environment. It requires an explicitly installed Chromium and these values:

    NEKIRO_E2E_BASE_URL=http://127.0.0.1:4173
    NEKIRO_E2E_COMPOSE_FILE=/absolute/path/to/deploy/compose.yaml
    NEKIRO_E2E_COMPOSE_PROJECT=nekiro-browser-acceptance
    VITE_NEKIRO_API_BASE_URL=http://gateway.nekiro.test
    VITE_NEKIRO_PROVIDER_ID=browser-provider
    VITE_NEKIRO_PROVIDER_NAME=Browser Provider
    VITE_NEKIRO_PROVIDER_TOKEN=...
    VITE_NEKIRO_OWNER_TOKEN=...
    VITE_NEKIRO_DEFAULT_WORKSPACE_ID=workspace-browser

Build the production Console with the five VITE_NEKIRO_* values before
running npm run test:e2e. Missing or whitespace-padded values fail
configuration. The suite uses the Gateway only, creates server-backed state,
and never stores credentials or challenge proofs in browser storage.

Playwright traces, screenshots, videos, and HTML reports are disabled for this
acceptance path and are ignored by Git if a local runner creates them.
