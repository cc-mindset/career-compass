## ADDED Requirements

### Requirement: Draft-only w/PR trigger exists
The repository MUST provide an agent skill and always-applied Cursor rule so the phrase `w/PR` (or documented equivalent) runs apply-if-needed, opens a feature branch, commits, pushes, and opens a **draft** pull request.

#### Scenario: w/PR opens draft
- **WHEN** a user invokes `w/PR` for an OpenSpec change with gates green
- **THEN** the agent creates or updates a draft PR and MUST NOT mark the PR ready for review

### Requirement: Gate status appears in PR body
Draft PRs created via this flow MUST list which inner and outer gates passed, failed, or were skipped (with reason).

#### Scenario: PR body reports ladder
- **WHEN** the draft PR is opened
- **THEN** its body includes Vitest focused/unit-core results and Playwright ladder steps with pass/fail/skip

### Requirement: Default commit policy remains wait-for-user
Absent an explicit `w/PR` (or documented ship) trigger, agents MUST continue to wait for the user before committing or pushing.

#### Scenario: Normal apply does not push
- **WHEN** an agent completes `/opsx:apply` without `w/PR`
- **THEN** it does not commit or push unless the user separately asked

### Requirement: Failed gates block draft PR claims
If required gates failed, the agent MUST NOT claim a successful ship; it may open a draft PR only if the user still wants visibility, and MUST clearly report failures.

#### Scenario: Failed p0
- **WHEN** `e2e:p0` fails during `w/PR`
- **THEN** the agent reports the failure and does not present the change as gate-complete
