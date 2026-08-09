## ADDED Requirements

### Requirement: Unit-core pack exists for high-risk web-server logic
`web-server` MUST provide a documented `test:core` (or equivalent) script that runs a curated Vitest pack covering high-risk logic used by product features.

#### Scenario: Agent runs unit-core
- **WHEN** an agent or CI runs the web-server unit-core script
- **THEN** the pack includes tests for job-analyzer validation/response shape, market-report persistence invariants, and market-insights or job-analyzer service contracts already identified as critical

### Requirement: Job analyzer validation is unit-core covered
Job analyzer input validation and result shape checks MUST be covered by the unit-core pack.

#### Scenario: Empty posting rejected
- **WHEN** unit-core runs
- **THEN** tests assert empty or invalid postings are rejected with the expected error contract

### Requirement: Market report persistence immutability is unit-core covered
User market report create/latest/snapshot immutability behavior MUST be covered by the unit-core pack.

#### Scenario: Create-new snapshots previous latest
- **WHEN** unit-core runs
- **THEN** tests assert creating a new report snapshots prior latest rather than overwriting history

### Requirement: Unit-core stays focused and fast
The unit-core pack MUST stay limited to high-risk pure or heavily mocked logic and MUST remain runnable without live cloud dependencies.

#### Scenario: No live LLM required
- **WHEN** unit-core executes in CI
- **THEN** it completes without calling OpenAI or Pinecone APIs
