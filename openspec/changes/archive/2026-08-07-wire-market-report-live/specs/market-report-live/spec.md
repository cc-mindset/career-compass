## ADDED Requirements

### Requirement: Live market report generation from workspace inputs
The system SHALL generate a Market Report from role (job), seniority, location, and optional industry using the existing market-insights pipeline (cache check, Redis queue when available, sync fallback when Redis is unavailable).

#### Scenario: Cache hit returns insights immediately
- **WHEN** a generate request is made for a combination with an active cached result for all required sections
- **THEN** the API returns `success` with `insights` and `fromCache: true` without enqueueing a new job

#### Scenario: Queue path streams progress
- **WHEN** a generate request misses cache and Redis is available
- **THEN** the API returns `queued: true` with a `jobId` and the client receives Socket.IO `progress` events until completion or error/fallback

#### Scenario: Sync fallback without Redis
- **WHEN** a generate request misses cache and Redis is unavailable
- **THEN** the API completes generation synchronously and returns `insights`

### Requirement: Active client uses live adapted data
The active Clarity Coach Market Report workspace SHALL render guest overview and full-report tabs from adapted live insights, not hardcoded fixtures, while preserving hash routes and guest gates.

#### Scenario: Guest overview after generation
- **WHEN** an unregistered user completes market generation
- **THEN** the system opens the guest market overview and does not show authenticated dashboard chrome as the first result

#### Scenario: Full report gated for guests
- **WHEN** an unregistered user attempts a gated Market Report route such as full report
- **THEN** the system requires sign-in or account creation and preserves continuation context

#### Scenario: Registered full tabs use live sections
- **WHEN** a registered user opens the full Market Report
- **THEN** Overview, Opportunities, Skills & actions, and Evidence tabs render content derived from live section payloads or an explicit partial/empty state

### Requirement: RAG without client ingestion
Generation SHALL retrieve from existing Pinecone namespaces used by market insights and MUST NOT run ai-enabler ingestion in the request path.

#### Scenario: Retrieval uses market insights namespaces
- **WHEN** market insights generation runs
- **THEN** retrieval uses the configured market-insights RAG namespaces and injects formatted context into section prompts
