# NeKiro Console — Three Redesign Demos

Date: 2026-07-20
Status: approved by user ("都做，你自由发挥" — all three directions, free rein)

## Goal

Produce three visual redesigns of the NeKiro Console as **navigable in-app demos**, so the user can compare directions side by side and pick one for production. The existing app stays untouched.

## Non-goals

- Demos do not call the backend; they remain local visual comparison artifacts.
- Demos do not replace the production runtime integration in `App.tsx` / `components/`.

## Access & routing

Hash-based, no router dependency:

- `#/demo` — launcher page with three preview cards
- `#/demo/glass` — Demo 1
- `#/demo/terminal` — Demo 2
- `#/demo/saas` — Demo 3
- any other hash / no hash — existing production app (unchanged)

`main.tsx` listens to `hashchange` and swaps the root component. Each demo has a floating pill to jump between demos and back to the launcher.

## The three directions

### Demo 1 — Glass 2.0 (`src/demos/glass/GlassDemo.tsx`)

Deepen the current dark glassmorphism. Same indigo/violet DNA, but with:

- subtler, slower mesh background; vignette to focus the center
- layered cards (glass panel → inner tinted panel) instead of flat lists
- gradient display typography, glowing status dots, hover lift + border-glow micro-interactions
- stats row (counts of published / drafts / installations) for information scent

### Demo 2 — Terminal (`src/demos/terminal/TerminalDemo.tsx`)

Bloomberg-terminal minimalism:

- near-black, everything monospace, amber (#ffb000) single accent
- high-density rows (table-like agent list), uppercase micro-labels, ASCII dividers
- keyboard-shortcut hints (`g r`, `g i`, …) shown in the sidebar; subtle scanline overlay
- no rounded corners, no shadows — information density is the aesthetic

### Demo 3 — Light SaaS (`src/demos/saas/SaasDemo.tsx`)

Vercel/Stripe-style approachability:

- light gray canvas (#f6f7f9), white cards, soft layered shadows, generous radius
- indigo brand color, colored status badges (green / amber / red tints)
- agent grid cards instead of master-detail list; friendlier copy

## Shared demo scope

Each demo renders the same realistic mock dataset (`src/demos/mockData.ts`):

- 6 agents (mix of published / draft / disabled, varied permissions)
- 1 workspace + 4 installations (enabled / disabled / uninstalled)
- Registry view (primary, fully styled) + Installations view + styled runtime boundary views for Invocations / Ledger
- working sidebar tab switch + client-side search filter

## Error handling / testing

- Type safety via `npm run lint` (`tsc --noEmit`) and `npm run build` must pass.
- No unit tests for demos (visual artifacts); existing `nekiro.test.ts` untouched.

## Rollout

Demos are dev artifacts. After the user picks a direction, a follow-up spec will port the winner onto the real components and delete the other two.
