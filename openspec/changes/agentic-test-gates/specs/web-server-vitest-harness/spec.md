## ADDED Requirements

### Requirement: Focused Vitest is the web-server inner gate
Agents and CI MUST be able to run focused Vitest against individual files or name patterns under `web-server/` without requiring live MongoDB, Redis, OpenAI, or Pinecone.

#### Scenario: Focused service test run
- **WHEN** an agent runs the documented focused Vitest command for a service or route test file
- **THEN** the suite completes using mocks or in-memory doubles and reports pass/fail for that slice only

### Requirement: Logic-shaped web-server work uses TDD
Logic-shaped web-server changes MUST add or extend a failing Vitest first, then implement until green, then re-run the focused command before the next task.

#### Scenario: New validation rule
- **WHEN** a change adds or tightens request/response validation in `web-server`
- **THEN** a colocated or adjacent `*.test.ts` fails before production code lands and passes after implementation

### Requirement: External dependencies are mocked in unit tests
Web-server unit tests MUST mock MongoDB, Redis, OpenAI, Pinecone, and similar I/O so the inner gate stays local and deterministic.

#### Scenario: Persistence test without live Mongo
- **WHEN** a persistence or route unit test runs
- **THEN** it does not require a reachable MongoDB or Redis instance

### Requirement: Incomplete apply without unit proof
A web-server logic change without new or updated unit tests that would catch the regression MUST be considered an incomplete OpenSpec apply.

#### Scenario: Helper change ships without tests
- **WHEN** a merge/dedupe/validation helper changes and no Vitest covers the new behavior
- **THEN** agents MUST NOT mark the related apply tasks complete
