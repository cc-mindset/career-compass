## ADDED Requirements

### Requirement: Active client has a Vitest harness
`client/client/app` MUST provide Vitest (and React Testing Library where UI logic is dense) with npm scripts for full and focused unit test runs.

#### Scenario: Package scripts available
- **WHEN** a developer or agent inspects `client/client/app/package.json`
- **THEN** scripts exist to run Vitest in CI mode and to run a focused path or name pattern

### Requirement: Client logic-shaped work uses TDD
Logic-shaped active-client changes (adapters, helpers, hooks, non-trivial state transitions) MUST follow failing Vitest then implement-until-green before the next OpenSpec task.

#### Scenario: Adapter mapping change
- **WHEN** a market or job API adapter mapping changes
- **THEN** a colocated unit test fails first and passes after the mapping update

### Requirement: Presentational UI prefers outer gate
Pure presentational view changes without dense logic MUST NOT require RTL coverage when Playwright outer-gate coverage locks the journey; RTL MAY be used when client logic is dense.

#### Scenario: Copy-only view tweak
- **WHEN** a change only adjusts presentational copy or layout without logic
- **THEN** the inner gate does not require new RTL tests if the outer gate journey still covers the surface

### Requirement: Legacy client is out of harness scope
The active-client Vitest harness MUST NOT depend on modernizing `client/legacy-client/app` tests.

#### Scenario: Apply targets active client only
- **WHEN** agents add client unit tests under this capability
- **THEN** new tests live under `client/client/app` and do not mix into legacy-client
