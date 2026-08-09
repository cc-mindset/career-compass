## ADDED Requirements

### Requirement: AGENTS documents inner and outer gates
`AGENTS.md` MUST document a Vitest-focused inner gate and a Playwright outer-gate ladder for agents working in this repository.

#### Scenario: Agent reads gate playbook
- **WHEN** an agent opens `AGENTS.md`
- **THEN** it finds a focused Vitest command table by surface (`web-server`, `client/client/app`) and a Playwright ladder (`e2e:pulse`, `e2e:smoke`, `e2e:p0`) with when-to-run guidance

### Requirement: OpenSpec config forces TDD and outer-gate tasks
`openspec/config.yaml` MUST include artifact rules so new changes encode TDD pairs and an outer-gate section in `tasks.md`.

#### Scenario: Propose generates gated tasks
- **WHEN** an agent proposes a logic-shaped or UI/API-for-UI change under the updated config
- **THEN** `tasks.md` MUST order work as failing-test then implement-until-green pairs and MUST include an outer-gate section for Playwright add/update and ladder runs when product UI or API-for-UI is touched

### Requirement: Apply skill blocks incomplete applies
The OpenSpec apply skill MUST instruct agents not to claim apply-complete unless the inner gate is green for logic changes and the outer gate is satisfied for product UI or API-for-UI changes.

#### Scenario: Logic change without unit tests
- **WHEN** an apply touches pure helpers, adapters, validation, or persistence logic without new or updated focused Vitest
- **THEN** the apply MUST be treated as incomplete

#### Scenario: UI change without e2e coverage
- **WHEN** an apply touches product UI or API used by UI without adding or updating Playwright coverage and running the required ladder steps
- **THEN** the apply MUST be treated as incomplete

### Requirement: Coverage posture rejects global percentage chase
Agent instructions MUST require change-scoped proof and unit-core packs, and MUST NOT define done as meeting a repository-wide coverage percentage.

#### Scenario: Agent self-validates a change
- **WHEN** an agent finishes a logic-shaped task
- **THEN** it proves the change with focused Vitest for that slice rather than running or optimizing for full-repo coverage percent
