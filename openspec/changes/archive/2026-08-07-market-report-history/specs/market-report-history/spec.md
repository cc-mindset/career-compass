## ADDED Requirements

### Requirement: User-owned latest report pointer
For an authenticated user, the system SHALL persist a latest Market Report record including inputs, generation metadata, and the insights payload (or references) needed to render the overview and full report.

#### Scenario: Create new report updates latest without deleting history
- **WHEN** an authenticated user generates a new Market Report after a previous one exists
- **THEN** the system stores an immutable snapshot of the previous latest and points latest at the new report

### Requirement: Review dated snapshots
The system SHALL allow an authenticated user to open a previous snapshot by id/date without mutating the current latest report.

#### Scenario: Review snapshot is read-only relative to latest
- **WHEN** a user opens a previous snapshot from history
- **THEN** the UI shows that snapshot’s content and a path back to the current report without overwriting latest

### Requirement: History list in workspace
The authenticated Market Report workspace SHALL show the current report summary and previous reports with Review actions, and MUST NOT fabricate history rows when empty.

#### Scenario: Empty history shows setup
- **WHEN** an authenticated user has no saved Market Reports
- **THEN** the workspace presents create/setup rather than fabricated rows
