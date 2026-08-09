## ADDED Requirements

### Requirement: Generate three pivot paths
Given validated Career Pivot inputs (situation, role, industry, experience, location, desired improvement, and at least three transferable skills), the system SHALL return exactly three ranked paths with fit rationale, transferable strengths, meaningful gaps, and a practical next step for each path.

#### Scenario: Guest generate without résumé
- **WHEN** a guest submits valid pivot inputs without a résumé
- **THEN** the system returns three path previews and does not require an account for that first result

#### Scenario: Invalid skills rejected
- **WHEN** a generate request includes fewer than three transferable skills
- **THEN** the system rejects the request with a validation error and does not invent skills

### Requirement: Transparent, non-fabricated results
Path results SHALL include concise rationale tied to the user’s inputs and MUST NOT present deterministic employment guarantees or fear-based layoff language.

#### Scenario: Rationale present on each path
- **WHEN** generation succeeds
- **THEN** each of the three paths includes a transparent fit rationale field suitable for UI display

### Requirement: Progress for long-running generation
When generation is queued, the system SHALL expose job progress compatible with the existing Socket.IO progress pattern used in web-server.

#### Scenario: Queued pivot job
- **WHEN** pivot generation is enqueued
- **THEN** the client can subscribe with the returned `jobId` and receive completion or error progress events

### Requirement: Guest preview wiring in active client
The active client guest Career Pivot flow SHALL call the generate API and render the three-path preview from the live response.

#### Scenario: Guest processing opens live preview
- **WHEN** a guest completes valid pivot input and processing finishes successfully
- **THEN** the pivot preview shows the three returned paths instead of static prototype-only path copy
