# Catalog API Integration Design

## Scope

Connect the existing Registry view to the implemented NeKiro Catalog API from
the `codex/002-catalog-registry-discovery` backend branch. Leave the
Installations, Invocations, and Ledger views unchanged because their backend
operations are not implemented yet.

## API boundary

The Console uses the public Control Plane endpoints only:

- `GET legacy v2 agent endpoints` for discovery and search
- `POST legacy v2 agent endpoints` for Agent Card registration
- `GET legacy v2 agent endpoints/{agentId}/versions/{version}` for exact reads
- `POST legacy v2 agent endpoints/{agentId}/versions/{version}/publish`
- `POST legacy v2 agent endpoints/{agentId}/versions/{version}/disable`

The API base URL, bearer token, and caller identity remain runtime configuration
through Vite environment variables. No internal Router endpoint or mock
fallback is used.

## Frontend structure

`src/api/nekiro.ts` owns request construction, authentication, JSON decoding,
Catalog response types, and conversion to the existing `Agent` view model.
`App.tsx` owns the live Catalog collection and mutation callbacks. The
Registry component keeps its current layout and form, while registration
serializes the form into a valid Agent Card v0.2 payload.

The current Registry form supplies the Card identity, owner information,
description, endpoint, version, capabilities, permissions, and runtime limits.
The adapter converts each capability into an Agent Card skill with explicit
input/output schemas. Existing unrelated tabs and their static data are not
changed.

## Error and state handling

Catalog requests expose loading and request errors to the Registry view. HTTP
errors are represented by a typed `NekiroApiError` containing status and
platform error code. A failed request never replaces live data with the old
prototype fixtures. Successful mutations refresh the Catalog list so the UI
reflects server publication state.

## Verification

Pure conversion and response-mapping behavior is covered with Vitest tests.
The project must pass TypeScript checking and Vite production build after
dependencies are installed. The existing non-Catalog tabs remain unchanged
apart from preserving their current imports and data flow.
