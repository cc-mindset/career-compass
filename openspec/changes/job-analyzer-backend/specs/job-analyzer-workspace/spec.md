## ADDED Requirements

### Requirement: Job analysis history
Authenticated users SHALL see prior job analyses and create a new analysis without overwriting previous records.

#### Scenario: New analysis creates a distinct record
- **WHEN** a user runs a new job analysis while prior analyses exist
- **THEN** a new record is stored and prior analyses remain available in history

### Requirement: Guest preview and account gate
Guests SHALL receive a useful Job Analyzer preview without an account. Saving the full analysis and continuing to Skills Match SHALL require authentication.

#### Scenario: Guest full save gated
- **WHEN** a guest attempts to save the full analysis or open Skills Match from the result
- **THEN** the system requires account creation or sign-in and preserves continuation context

### Requirement: Workspace states
The Job Analyzer workspace SHALL support empty, history, new, review, and result states consistent with the active client routes.

#### Scenario: Empty workspace
- **WHEN** an authenticated user has no analyses
- **THEN** the empty state offers a clear action to analyze the first job without fabricated history rows
