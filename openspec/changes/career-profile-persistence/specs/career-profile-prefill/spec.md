## ADDED Requirements

### Requirement: Prefill Market Report from Career Profile
When an authenticated user has saved career context fields, Market Report setup SHALL prefill role, industry, seniority, and location from Career Profile without re-asking unchanged questions.

#### Scenario: Market setup opens with saved values
- **WHEN** a user with saved career context opens Market Report create/refresh
- **THEN** the form fields show the saved profile values and remain editable

### Requirement: Prefill Career Pivot from Career Profile
When an authenticated user has saved compatible Career Profile fields, Career Pivot SHALL prefill those fields and allow changes without silently overwriting confirmed profile facts on the server until the user explicitly saves profile updates.

#### Scenario: Pivot prefill does not auto-overwrite confirmed profile
- **WHEN** a user changes a prefilled pivot field for one exploration
- **THEN** the system MUST NOT silently overwrite the confirmed Career Profile value unless the user saves that change to the profile

### Requirement: Guest pivot answers populate profile after account creation
After a guest who completed Career Pivot creates an account, matching Career Profile fields SHALL be populated from the guest pivot answers carried through conversion.

#### Scenario: Conversion carries pivot answers
- **WHEN** a guest with completed pivot inputs creates an account
- **THEN** the matching Career Profile career-context and transferable-skills fields are available without re-entry of the same answers
