## ADDED Requirements

### Requirement: Playwright project exists for the active client
The repository MUST include a Playwright configuration targeting the active Clarity Coach UI (`client/client/app`, default port 3002) with agent-safe npm scripts.

#### Scenario: Scripts documented in AGENTS
- **WHEN** an agent reads `AGENTS.md` after this change
- **THEN** it finds `e2e:pulse`, `e2e:smoke`, and `e2e:p0` (or equivalent) commands and how to start the client for agents

### Requirement: Ladder semantics match icee-style gates
The outer gate MUST define at least three levels: pulse (always), smoke (routes/shell/nav), and p0 (critical product journeys), with clear when-to-run rules.

#### Scenario: Default apply ladder
- **WHEN** an OpenSpec apply changes product UI or API-for-UI under the active client or web-server
- **THEN** agents MUST run pulse and p0 before claiming apply-complete, and MUST also run smoke when routing or shell navigation changed

### Requirement: Stable selectors via data-testid
Critical interactive surfaces covered by e2e MUST expose stable `data-testid` values from a shared catalog module rather than relying on marketing copy alone.

#### Scenario: New journey needs a selector
- **WHEN** a p0 test targets a primary CTA or source switcher
- **THEN** it uses a `data-testid` from the shared catalog

### Requirement: Mocks are enough by default
Default e2e journeys MUST NOT require real payment processors, real OAuth provider UI, or live LLM spend; API-backed steps MAY use mocked or fixture-backed responses unless a journey explicitly requires a live stack.

#### Scenario: Guest market journey without live OpenAI
- **WHEN** pulse or a mocked p0 journey runs
- **THEN** it can pass without calling paid OpenAI APIs

### Requirement: Incomplete apply without outer gate
Agents MUST NOT mark OpenSpec apply complete for product UI or API-for-UI changes without adding or updating Playwright coverage and running the required ladder steps.

#### Scenario: UI feature ships without Playwright
- **WHEN** a guest workspace UI behavior changes and no Playwright spec covers it
- **THEN** the apply is incomplete
