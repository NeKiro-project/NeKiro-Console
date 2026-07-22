# Glass 2.0 production port

Date: 2026-07-21
Status: selected by user

## Goal

Make Glass 2.0 the production Console presentation while preserving the
existing three comparison routes under `#/demo`, and keep all production
surfaces connected to the real Northbound APIs.

## Requirements

- The no-hash production route uses the Glass 2.0 dark glassmorphism system:
  indigo/violet ambient mesh, translucent layered panels, gradient display
  headings, compact mono metadata, glowing status indicators, and stable hover
  feedback.
- Registry, Workspace, Installation, Invocation, and Ledger behavior remains
  backed by the existing live API client. Styling changes must not import demo
  fixtures into production data paths.
- Keep `#/demo`, `#/demo/glass`, `#/demo/terminal`, and `#/demo/saas` intact for
  future comparison.
- Preserve keyboard focus, visible focus states, readable contrast, and
  responsive layout at desktop and narrow widths.
- Do not introduce secrets, mock runtime records, or unsupported fallback
  values.

## Non-goals

- No new API contract or backend behavior.
- No deletion of the three comparison demos.
- No change to Owner-only or single active Workspace policy.

## Acceptance

- Production no-hash route visibly matches the selected Glass 2.0 direction.
- Browser can navigate between all production tabs and still invokes/reads the
  same live client methods.
- Demo launcher and all three demo routes remain reachable.
- `npm test`, `npm run lint`, and `npm run build` pass.
