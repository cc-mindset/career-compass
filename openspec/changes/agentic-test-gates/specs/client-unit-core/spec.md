## ADDED Requirements

### Requirement: Client unit-core pack covers adapters and upload helpers
`client/client/app` MUST provide a documented unit-core script covering high-risk client logic: market insights adapter mapping, job analyzer API client contracts, and job upload file helper behavior.

#### Scenario: Unit-core script runs
- **WHEN** an agent runs the client unit-core script
- **THEN** tests for adapter mapping, job API error shaping, and upload file hold/retrieve behavior execute and pass

### Requirement: Market insights adapter mapping is covered
Live market report adapter output used by the UI MUST be locked by unit tests so fixture fallback vs live mapping regressions fail the inner gate.

#### Scenario: Live payload maps to UI fields
- **WHEN** unit-core runs with a representative live insights payload
- **THEN** the adapter produces the expected UI-facing fields without inventing missing data

### Requirement: Job upload helper is covered
The module that holds the selected job upload `File` outside React state MUST be covered by unit tests for set/get/clear behavior.

#### Scenario: Clear removes held file
- **WHEN** a file is set then cleared via the upload helper
- **THEN** subsequent get returns null

### Requirement: Client unit-core stays dependency-light
Client unit-core MUST run without a browser, without Playwright, and without a live web-server.

#### Scenario: Offline unit-core
- **WHEN** client unit-core runs in CI
- **THEN** it does not start Vite, Playwright, or call `VITE_API_URL`
