# NeKiro Console MVP

React/Vite/TypeScript/Tailwind Console for the NeKiro Agent Operating Platform.

This Console follows the MVP spec in docs/superpowers/specs/2026-07-16-nekiro-console-mvp-spec.md.

## Live surfaces

- Registry: GET/POST /v3/agents, exact reads, publish, and disable for Agent Card v0.2.
- Workspace: POST /v3/workspaces and GET /v3/workspaces/{workspaceId} from the header.
- Installations: install, list, enable, disable, and uninstall through /v3/workspaces/{workspaceId}/installations.

## Gated surfaces

- Invocations and Ledger are intentionally contract-aware empty states.
- The UI does not render fake traces, fake task streams, or fabricated timeout events.
- These pages should become live only after the backend headless Invoke to Record path is delivered.

## Configuration

Create .env.local or export these values for local development:

    VITE_NEKIRO_API_BASE_URL=http://127.0.0.1:18080
    VITE_NEKIRO_TOKEN=
    VITE_NEKIRO_OWNER_ID=
    VITE_NEKIRO_OWNER_NAME=
    VITE_NEKIRO_DEFAULT_WORKSPACE_ID=

The bearer token is sent only as an Authorization header. It is not written to local storage.

## Run locally

    npm install
    npm run dev

## Verification

    npm test
    npm run lint
    npm run build
    rg "/v2/agents" src docs -n
    rg "INITIAL_AGENTS|INITIAL_INSTALLATIONS|TRACE_HISTORIES" src -n
