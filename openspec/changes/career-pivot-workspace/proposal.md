## Why

After pivot generation works, returning users need a workspace: list explorations, open/continue, create new without overwriting priors, and build an Action Plan after account creation. This change adds persistence and authenticated workspace UX on top of `career-pivot-generate`.

## What Changes

- Persist `PivotExploration` records; new exploration never overwrites prior ones.
- List / open / continue / new exploration APIs and UI.
- Action Plan creation gated behind authentication with continuation from guest selection.
- Point dashboard Career Pivot nav to the workspace (away from `#prototype-new-account-*`).
- Depends on `career-pivot-generate`.

## Capabilities

### New Capabilities
- `career-pivot-workspace`: exploration history, immutability, Action Plan attachment, and authenticated workspace states.

### Modified Capabilities
- None.

## Impact

- Web-server Mongo models + workspace/plan routes.
- Active client pivot workspace screens and nav.
- Coordinates with account conversion for plan gating.
