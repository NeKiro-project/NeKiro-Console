# Catalog API Integration Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task.

Goal: Connect the Registry tab to the implemented NeKiro Control Plane Catalog API while leaving Installations, Invocations, and Ledger unchanged.

Architecture: Add a typed NekiroApiClient and pure Agent Card/response adapters under src/api/. Keep server state in App.tsx, refresh it after Catalog mutations, and pass async actions into RegistryTab.tsx. The browser calls only public legacy v2 agent endpoints endpoints; no Router API or static fallback is used for Registry data.

Tech Stack: React 19, TypeScript, Vite, Tailwind CSS v4, browser fetch, and Node node:test through the existing tsx dev dependency.

## Global Constraints

- Use Agent Card v0.2 and Northbound API v2.
- Keep the existing React/Vite/TypeScript/Tailwind stack.
- Do not modify the Installations, Invocations, or Ledger behavior.
- Do not silently fall back to INITIAL_AGENTS when Catalog is unavailable.
- Do not call internal Control Plane or A2A Router endpoints from the browser.
- Keep bearer credentials in Vite runtime configuration and never commit real credentials.

---

## File Map

- Create src/api/nekiro.ts: Catalog API types, request client, typed errors, Agent Card builder, and Catalog mapping.
- Create src/api/nekiro.test.ts: request, error, Card conversion, and Catalog mapping tests.
- Modify src/App.tsx: live Catalog state, search loading, and lifecycle callbacks.
- Modify src/components/RegistryTab.tsx: required Card fields, async registration, publish/disable actions.
- Modify src/types.ts: add the disabled Agent status.
- Modify .env.example: document browser-side NeKiro configuration.
- Modify package.json: add the test script using existing tsx.

## Task 1: Establish failing Catalog adapter tests

Files:
- Create src/api/nekiro.test.ts.
- Modify package.json.

Interfaces:
- Tests import NekiroApiClient, NekiroApiError, buildAgentCard, and mapCatalogEntry from src/api/nekiro.ts before production code exists.

- [ ] Step 1: Add the test command

Add the package script:

    "test": "tsx --test"

- [ ] Step 2: Write a failing Agent Card conversion test

Call buildAgentCard with agentId runtime.echo, ownerId team.platform, ownerDisplayName Platform Team, description Echoes structured input., version 1.0.0, endpoint http://127.0.0.1:9000/a2a, authentication none, one READ_LOGS permission, a capabilities JSON object containing one skill with explicit inputSchema, outputSchema, and requiredPermissions, and limits timeoutMs 30000, maxInputBytes 1048576, maxOutputBytes 1048576, streaming true.

Assert the returned object has exactly:

    schemaVersion: 0.2
    agentId: runtime.echo
    name: runtime.echo
    description: Echoes structured input.
    owner: { id: team.platform, displayName: Platform Team }
    version: 1.0.0
    protocol: { type: a2a, version: 0.3.0, transport: JSONRPC, endpoint: http://127.0.0.1:9000/a2a }
    one matching skill
    authentication: { type: none }
    one matching permission
    the supplied limits

- [ ] Step 3: Write a failing Catalog mapping test

Create a CatalogEntry with a disabled publication status, an owner display name, two skills, and a complete Card. Assert mapCatalogEntry maps the Card to the existing Agent view model, keeps disabled distinct from deprecated, derives tags from skill IDs, and serializes the complete Card into schema.

- [ ] Step 4: Write a failing request and error test

Inject a fake fetch into NekiroApiClient, call searchAgents with query echo, and assert the request URL is https://api.example.testlegacy v2 agent endpoints?query=echo, the Accept header is application/json, and the Authorization header is Bearer test-token. Return a 409 Platform Error and assert rejection with NekiroApiError status 409 and code CONFLICT.

- [ ] Step 5: Run the focused test and verify RED

Run:

    npm install --no-package-lock
    npx tsx --test src/api/nekiro.test.ts

Expected: failure because src/api/nekiro.ts does not exist. Fix only test typos if the failure is unrelated.

## Task 2: Implement the typed Catalog client and adapters

Files:
- Create src/api/nekiro.ts.

Interfaces:
- Produce AgentCardV02, CatalogEntry, CatalogSearchResponse, NekiroApiError, NekiroApiClient, buildAgentCard, and mapCatalogEntry for later tasks.

- [ ] Step 1: Define contract-facing TypeScript types

Define strict types for Agent Card v0.2, CatalogEntry, CatalogSearchResponse, CatalogSearchParams, and AgentCardInput. AgentCardV02 must include schemaVersion, agentId, name, description, owner, version, protocol, skills, authentication, permissions, and limits.

Use:

    type PublicationStatus = 'draft' | 'published' | 'disabled'
    type AuthenticationType = 'none' | 'api_key' | 'http_bearer' | 'oauth2_client_credentials' | 'mutual_tls'

- [ ] Step 2: Implement typed HTTP error decoding

NekiroApiError preserves status, optional Platform Error code, message, and traceId. A non-JSON error still produces a useful HTTP-status error. A missing base URL rejects with a configuration error instead of making a relative request.

- [ ] Step 3: Implement NekiroApiClient

Expose:

    searchAgents(params?: CatalogSearchParams): Promise<CatalogSearchResponse>
    registerAgent(card: AgentCardV02): Promise<CatalogEntry>
    getAgentVersion(agentId: string, version: string): Promise<CatalogEntry>
    publishAgentVersion(agentId: string, version: string): Promise<CatalogEntry>
    disableAgentVersion(agentId: string, version: string): Promise<CatalogEntry>

Use JSON Accept, Content-Type for bodies, optional Authorization Bearer token, encoded path segments, omitted undefined query parameters, and one normalized trailing slash.

- [ ] Step 4: Implement buildAgentCard

Parse capabilitiesJson, require a non-empty capabilities array, preserve explicit skill schemas and permission IDs, and reject malformed entries or duplicate skill IDs. Build protocol a2a/0.3.0/JSONRPC, owner, authentication, permissions, and limits without inventing an endpoint.

- [ ] Step 5: Implement mapCatalogEntry

Map card.agentId to Agent.id and Agent.name, card.owner.displayName to Agent.owner, skill IDs to Agent.tags, publicationStatus to Agent.status including disabled, and the full Card to formatted Agent.schema.

- [ ] Step 6: Run focused tests and verify GREEN

Run:

    npx tsx --test src/api/nekiro.test.ts

Expected: all adapter/client tests pass.

- [ ] Step 7: Commit the isolated client

    git add src/api/nekiro.ts src/api/nekiro.test.ts package.json
    git commit -m "feat: add NeKiro catalog client"

## Task 3: Add runtime configuration and App Catalog state

Files:
- Modify .env.example.
- Modify src/App.tsx.

Interfaces:
- Consume NekiroApiClient from Task 2.
- Produce async Registry callbacks handleRegisterAgent, handlePublishAgent, and handleDisableAgent.

- [ ] Step 1: Add browser configuration

Append to .env.example without real values:

    VITE_NEKIRO_API_BASE_URL=http://127.0.0.1:18080
    VITE_NEKIRO_TOKEN=
    VITE_NEKIRO_OWNER_ID=
    VITE_NEKIRO_OWNER_NAME=

- [ ] Step 2: Replace static Registry initialization

Remove INITIAL_AGENTS from App.tsx and initialize agents as an empty Agent array. Keep INITIAL_INSTALLATIONS untouched for the placeholder tab.

- [ ] Step 3: Create one configured API client

Use useMemo with import.meta.env.VITE_NEKIRO_API_BASE_URL and import.meta.env.VITE_NEKIRO_TOKEN. Do not put the token in source or local storage.

- [ ] Step 4: Add one Catalog loader

Create loadAgents(query?: string) with useCallback. Set loading state, call client.searchAgents, map items, preserve the previous live collection on errors, and store the error for Registry rendering. Debounce searchQuery by about 250ms using the existing useEffect import.

- [ ] Step 5: Add mutation callbacks

Each callback calls its client method and then reloads the current query. Use Agent id and semver version for publish/disable. Do not modify Installation, Invocation, or Ledger state.

- [ ] Step 6: Pass Catalog state and callbacks to RegistryTab

Add catalogLoading, catalogError, onPublishAgent, and onDisableAgent props while keeping all existing props and layout.

- [ ] Step 7: Run TypeScript checking

    npx tsc --noEmit

Expected: no TypeScript errors.

## Task 4: Make Registry registration and lifecycle actions use Catalog

Files:
- Modify src/components/RegistryTab.tsx.
- Modify src/types.ts.

Interfaces:
- Consume AgentCardInput, buildAgentCard, and async callbacks from Tasks 2 and 3.
- Produce valid registration payloads and Catalog lifecycle actions without changing other tabs.

- [ ] Step 1: Extend Agent status

Add disabled to Agent.status and retain deprecated for existing fixture data.

- [ ] Step 2: Add required Card form state

Add controlled semver version and HTTP(S) A2A endpoint state. Keep Agent ID, Namespace, Description, capabilities JSON, and the current permission list. Replace the old ws:// endpoint and static version display with editable values; never submit the old placeholder endpoint.

- [ ] Step 3: Write the failing submission test

Cover that registration is disabled until endpoint, owner/namespace, version, and valid non-empty capabilities are present, and that successful submit invokes onRegisterAgent with a v0.2 Card. Run the focused test and verify it fails before changing component behavior.

- [ ] Step 4: Implement async registration

Build the Card with buildAgentCard, await onRegisterAgent, close the workbench only after success, and keep the workbench open when the API rejects. Preserve existing reset behavior after success.

- [ ] Step 5: Implement lifecycle buttons

For draft cards call onPublishAgent. For published cards call onDisableAgent. Show disabled separately and keep deprecated fixture styling unchanged. Stop event propagation from action buttons.

- [ ] Step 6: Render loading/error state only inside Registry

Use the existing Registry empty-state area for loading/error text and do not change the other tabs.

- [ ] Step 7: Run focused tests and TypeScript checking

    npx tsx --test src/api/nekiro.test.ts
    npx tsc --noEmit

Expected: tests pass and TypeScript reports no errors.

- [ ] Step 8: Commit the Registry integration

    git add .env.example src/App.tsx src/components/RegistryTab.tsx src/types.ts
    git commit -m "feat: connect registry to NeKiro catalog"

## Task 5: Full verification and handoff

Files:
- No additional production files.

- [ ] Step 1: Run all frontend tests

    npm test

Expected: all node:test suites pass.

- [ ] Step 2: Run build and typecheck

    npm run lint
    npm run build

Expected: both exit with code 0 after dependencies are installed.

- [ ] Step 3: Verify stack boundaries and unchanged placeholder tabs

    rg "vue|@vitejs/plugin-vue|vue-router|pinia|vue-i18n" package.json vite.config.ts src -n
    rg --files src | rg "\.(vue|js|jsx)$"
    git diff HEAD~2 -- src/components/InstallationsTab.tsx src/components/InvocationsTab.tsx src/components/LedgerTab.tsx
    git status --short --branch

Expected: no Vue files or dependencies, the three placeholder components have no changes, and the worktree is clean.

- [ ] Step 4: Report runtime configuration and verification results

Report the required VITE_NEKIRO_* variables, the fact that Catalog is the only connected surface, the exact test/build commands, and any remaining environment limitation.
