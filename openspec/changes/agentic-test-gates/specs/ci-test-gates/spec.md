## ADDED Requirements

### Requirement: PR CI runs web-server Vitest
A GitHub Actions workflow MUST run `web-server` Vitest (full or unit-core plus changed-pack equivalent) on pull requests that touch relevant paths.

#### Scenario: Web-server PR check
- **WHEN** a PR changes files under `web-server/`
- **THEN** CI runs Vitest and fails the check on test failure

### Requirement: PR CI runs active client unit tests
CI MUST run `client/client/app` Vitest unit tests on pull requests that touch the active client.

#### Scenario: Client unit PR check
- **WHEN** a PR changes files under `client/client/app/`
- **THEN** CI runs the client unit test script and fails on test failure

### Requirement: PR CI runs e2e pulse and p0
CI MUST run Playwright `e2e:pulse` and `e2e:p0` (or documented equivalents) on pull requests that touch active client or web-server product surfaces, with the client app served for agents.

#### Scenario: UI path triggers e2e
- **WHEN** a PR changes active client product UI or web-server routes used by UI
- **THEN** CI executes pulse and p0 and fails on journey failure

### Requirement: CI does not require live paid APIs
Default CI jobs MUST NOT require production OpenAI, Pinecone, or MongoDB Atlas credentials; tests MUST use mocks, fixtures, or local doubles.

#### Scenario: Fork-friendly secrets
- **WHEN** CI runs on a PR without paid API secrets
- **THEN** unit and default e2e jobs still execute using mocks or fixtures

### Requirement: CI status is the machine outer gate
A failing required workflow check MUST block merge confidence; agents MUST treat red CI as a failed outer/inner gate for ship readiness.

#### Scenario: Red CI after w/PR
- **WHEN** CI fails after a draft PR opens
- **THEN** the change is not considered gate-complete until checks are green or failures are fixed
