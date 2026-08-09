## ADDED Requirements

### Requirement: Immutable exploration history
The system SHALL store Career Pivot explorations as distinct records. Creating a new exploration MUST NOT overwrite a prior exploration’s inputs or results.

#### Scenario: New exploration is a new record
- **WHEN** a returning user starts a new exploration while prior explorations exist
- **THEN** a new record is created and prior records remain unchanged

### Requirement: Open or continue prior explorations
Authenticated users SHALL be able to list explorations and open or continue an unfinished or saved exploration to its exact stored state.

#### Scenario: Open saved exploration
- **WHEN** a user opens a saved exploration from the workspace list
- **THEN** the system restores that exploration’s inputs and path results

### Requirement: Action Plan after authentication
Building an Action Plan from a selected path SHALL require an authenticated (or post-guest-conversion) session and SHALL persist the plan linked to the exploration.

#### Scenario: Guest blocked from plan until account
- **WHEN** a guest attempts to build a plan
- **THEN** the system requires account creation or sign-in and preserves the selected path context for continuation

### Requirement: Authenticated workspace navigation
The authenticated Career Pivot entry point SHALL open the pivot workspace (empty, history, or detail as appropriate), not the prototype-new-account walkthrough, once this change is applied.

#### Scenario: Sidebar opens workspace
- **WHEN** an authenticated user selects Career Pivot in the dashboard nav
- **THEN** the app navigates to the Career Pivot workspace routes backed by stored explorations
