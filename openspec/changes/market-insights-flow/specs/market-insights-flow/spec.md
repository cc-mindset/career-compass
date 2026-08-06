## Purpose

Define the observable behavior for generating market insights from a location with optional job and seniority context, including cache-first responses, queue-based async processing, direct fallback when queueing is unavailable, and status polling for queued work.

## ADDED Requirements

### Requirement: Validate and normalize market-insights requests
The system MUST reject requests without a non-empty location string and MUST normalize whitespace in request tuples used for cache and queue coordination.

#### Scenario: Blank location is rejected
- **WHEN** a request omits location or sends only whitespace
- **THEN** the system returns a client error and does not queue or generate insights

#### Scenario: Equivalent location inputs map consistently
- **WHEN** two requests use the same location text with different surrounding whitespace
- **THEN** the system treats them as the same normalized request for cache and queue coordination

### Requirement: Return cached market insights before starting new work
The system MUST return a completed cached market-insights response when all required sections are active and fresh for the normalized request tuple, without queueing a new job.

#### Scenario: Cache hit short-circuits generation
- **WHEN** a request matches a fresh cached result
- **THEN** the system returns insights immediately and does not enqueue a job

### Requirement: Queue uncached requests when async processing is available
The system MUST enqueue uncached requests when the queue backend is available and MUST return a queued response containing a job identifier and queue position.

#### Scenario: Uncached request enters the queue
- **WHEN** a request misses the cache and the queue backend is available
- **THEN** the system returns a queued response with jobId and position

### Requirement: Reuse in-flight jobs for duplicate requests
The system MUST return the existing job identifier when an identical normalized request is already in flight, rather than queueing a duplicate job.

#### Scenario: Duplicate request returns same job
- **WHEN** a second request matches an already queued normalized tuple
- **THEN** the system returns the existing jobId instead of creating a new job

### Requirement: Provide a direct fallback when queueing is unavailable
The system MUST generate insights synchronously when queueing cannot be used, and the response MUST include the completed insights payload.

#### Scenario: Redis outage falls back to direct generation
- **WHEN** the queue backend is unavailable or enqueueing fails
- **THEN** the system returns completed insights instead of a queued response

### Requirement: Expose job status for queued market-insights requests
The system MUST provide a status lookup for queued market-insights jobs and MUST return completed insights when the job result is available.

#### Scenario: Completed job is visible through status lookup
- **WHEN** a client checks a queued job after processing finishes
- **THEN** the system returns a completed status and the generated insights
