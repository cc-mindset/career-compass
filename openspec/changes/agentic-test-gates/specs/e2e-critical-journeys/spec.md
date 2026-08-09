## ADDED Requirements

### Requirement: Guest market report p0 journey
Playwright p0 MUST include a guest market report journey that starts from landing tool selection, fills required market fields, and reaches a processing or result surface without requiring an account.

#### Scenario: Guest generates market preview path
- **WHEN** p0 runs the market report journey
- **THEN** the test asserts the guest can progress from landing market inputs into the market guest workspace flow using stable test ids

### Requirement: Guest job analyze p0 journey
Playwright p0 MUST include a guest job analyze journey covering paste source at minimum, progressing into the job guest workspace review or processing path.

#### Scenario: Guest paste job description
- **WHEN** p0 runs the job analyze paste journey
- **THEN** the test asserts the guest can select analyze-a-job, paste a description meeting minimum length, and continue into the job flow

### Requirement: Upload source smoke within job journey or sibling spec
Job upload source switching and file drop zone interactivity MUST be covered by Playwright (p0 or smoke sibling) so dead drop zones regress visibly.

#### Scenario: Upload source shows drop zone
- **WHEN** the guest selects Upload file on the job tool
- **THEN** the drop zone with its data-testid is visible and clickable (file chooser may be stubbed)

### Requirement: Shell or route smoke covers primary nav entry
Smoke tests MUST cover that primary landing or app shell routes needed for guest tools remain reachable.

#### Scenario: Landing loads
- **WHEN** `e2e:smoke` runs
- **THEN** the landing (or configured base URL) loads and exposes the try/tools entry used by guest flows

### Requirement: Journeys fail on invented success states
Critical journeys MUST assert on durable UI contracts (test ids, route/hash, required fields) and MUST NOT treat marketing-only copy as the sole oracle.

#### Scenario: Copy change does not break p0 alone
- **WHEN** non-contract marketing headline text changes but test ids remain
- **THEN** p0 journeys continue to pass
