## Summary

<!-- Describe the Console behavior changed and why it belongs in this repository. -->

## Compatibility and cross-repository impact

- Gateway/Core contract revision:
- Affected routes or public types:
- NeKiro-Stack manifest or browser acceptance update:

- [ ] No public contract or route semantics changed.
- [ ] Any compatible contract change is documented and tested.
- [ ] Any breaking change has an explicit migration decision.

## Verification

Commands run:

```text
pnpm typecheck
pnpm test
pnpm build
```

Observed success signals:

<!-- Record passing test counts, successful build output, and Stack browser evidence when applicable. -->

## Security and failure semantics

- [ ] Credentials are not logged, persisted in browser storage, or committed.
- [ ] Missing, invalid, unauthorized, and dependency-failure states remain distinct.
- [ ] No retry, alternate endpoint, mock success, or silent degradation was introduced without policy evidence.

Fallback delta: removed 0, retained 0, added 0, net 0

Added fallback evidence: none

## Checklist

- [ ] The change stays behind the Gateway boundary.
- [ ] Tests cover the affected success and failure behavior.
- [ ] README or operator guidance was updated when commands or outcomes changed.
- [ ] Cross-repository references are immutable and the Stack follow-up is identified.
