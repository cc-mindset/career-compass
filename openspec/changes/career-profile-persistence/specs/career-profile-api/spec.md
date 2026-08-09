## ADDED Requirements

### Requirement: Load and save Career Profile
The system SHALL allow a client to load a user’s Career Profile by user id (clerk id) and to patch profile fields without deleting unspecified sections.

#### Scenario: Get profile for existing user
- **WHEN** the client requests `GET /api/users/:userId` for a known user
- **THEN** the response includes the stored profile payload used by Career Profile UI

#### Scenario: Patch merges section data
- **WHEN** the client sends `PATCH /api/users/:userId/profile` with a section update
- **THEN** the server persists that section’s fields and does not wipe other saved sections

### Requirement: Résumé upload updates evidence for review
The system SHALL accept résumé upload via the existing résumé endpoint, parse structured profile evidence, and return it for user review before treating values as confirmed Career Profile facts.

#### Scenario: Successful résumé parse
- **WHEN** a user uploads a supported résumé file with a user id
- **THEN** the API returns parsed profile data and persists résumé metadata on the user without inventing work history beyond the parse result

### Requirement: Section completion progress
The Career Profile system SHALL expose enough section completion state for Home and Career Profile UI to show progressive completion without fabricating completed sections.

#### Scenario: Incomplete profile shows partial progress
- **WHEN** only career context fields are saved
- **THEN** completion progress reflects partial completion and does not claim 100%
