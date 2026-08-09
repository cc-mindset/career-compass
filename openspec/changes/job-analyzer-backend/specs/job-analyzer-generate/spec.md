## ADDED Requirements

### Requirement: Analyze user-supplied job postings only
The system SHALL analyze only job content supplied by the user (paste, upload, or successfully retrieved URL) and MUST NOT invent or autonomously select a job role or posting.

#### Scenario: Paste analysis
- **WHEN** a user submits a complete pasted job description with required review fields
- **THEN** the system returns an analysis for that posting

#### Scenario: Missing posting rejected
- **WHEN** a generate request has no usable job description text
- **THEN** the system rejects the request and does not fabricate a posting

### Requirement: Separate stated requirements from Hidden Expectations
The analysis result SHALL distinguish explicitly stated requirements from inferred Hidden Expectations, and each inference SHALL include evidence and a confidence indicator.

#### Scenario: Hidden expectation includes evidence
- **WHEN** generation succeeds and includes at least one Hidden Expectation
- **THEN** each Hidden Expectation includes evidence supporting the inference and a confidence value suitable for UI display

### Requirement: Generation metadata for observability
Successful analyses SHALL record model/prompt version identifiers (or equivalent run metadata) needed for PRD observability of AI executions.

#### Scenario: Metadata returned or stored
- **WHEN** an analysis completes
- **THEN** run metadata required for traceability is stored with the analysis record and/or returned to the client
