# Clarity Coach — Product Requirements Document

**Clarity Coach Guest-First Experience**

v4.0 — Complete agreed flows through Career Pivot, Job Analyzer, Skills Match and Market Report

Prototype-aligned PRD for product, design, engineering, data and AI

**Status:** Implementation baseline  ·  **Date:** 31 July 2026

## Document purpose

This version preserves the structured format, rendered journey diagrams and prototype screen figures while replacing outdated routing, terminology and feature states with the current agreed product behavior.

## Document map

| Document area | What it contains |
| --- | --- |
| 1–3 | Product decisions, MVP scope, personas and success measures |
| 4–5 | End-to-end journeys, routing, state model and shared Career Profile |
| 6–10 | Detailed feature requirements and user stories |
| 11–14 | Fields, AI/RAG, backend, analytics, security and non-functional requirements |
| 15 | Prototype screen catalogue and responsive behavior |
| Appendix A | Rendered process diagrams for every major feature flow |

## 1. Executive summary and product decisions

| Decision | Agreed behavior |
| --- | --- |
| Guest-first value | Career Pivot, Job Analyzer and Market Report may begin from the landing page without an account. |
| No repeated input | Inputs submitted on the landing page carry into the guest workspace and through account creation. |
| Progressive account gate | Require an account only for saving, deeper analysis, full reports, plans or authenticated continuation. |
| Shared profile | Career Profile is the reusable career evidence layer; tools progressively read and write compatible fields. |
| Dashboard routing | Direct signup opens a new-account Home. Converted guests return to the originating feature and preserved result. |
| History | Repeat-use features show latest and previous work plus a clear create-new action. |
| No fabrication | Never invent names, profile completion, history, reports, experience or saved work. |

### MVP features

| Feature | MVP outcome | Guest availability |
| --- | --- | --- |
| Onboarding and account | Create or access an account without losing guest work. | Account boundary |
| Job Analyzer + Hidden Expectations | Explain stated requirements, inferred expectations, evidence and confidence. | Yes |
| Skills Match | Compare a role with career evidence; show strengths, partial matches and gaps. | Authenticated |
| Career Pivot + Action Plan | Show three realistic adjacent paths and convert the selected path into a plan. | Yes |
| Market Report | Show role-and-location outlook, opportunities, capabilities, actions and evidence. | Yes |
| Career Profile | Maintain reusable evidence and progressive completion. | Authenticated |
| Admin portal | Monitor users, content, prompts, runs, sources, plans and failures. | Internal |

## 2. Users, jobs-to-be-done and success measures

| Persona | Need | Design implication |
| --- | --- | --- |
| Recently laid off | A fast, reassuring first result and practical next step. | Do not force a long profile before value. |
| Layoff-concerned professional | Understand resilience, market risk and transferable options. | Use neutral, non-alarmist language. |
| Stuck or growth-seeking professional | Identify realistic next roles and evidence gaps. | Show path rationale and actions. |
| Returning user | Resume work and understand what changed. | Prioritize recent work and explicit continuation. |

| Measure | Definition |
| --- | --- |
| Time to first useful result | Median elapsed time from guest CTA to preview. |
| Guest-to-account conversion | Percentage creating an account after a useful preview. |
| Continuation recovery | Percentage of converted guests returned to the exact originating state. |
| Profile reuse | Share of tool sessions successfully prefilling valid Career Profile fields. |
| Repeat analysis | Users creating a new pivot, job analysis or market report after a prior result. |

## 3. Global navigation, authentication and account rules

- Landing navigation contains Sign in and Try it free; account creation remains available from authentication and conversion surfaces.
- Sign in and Create account support email/password, Google, LinkedIn and Facebook. Microsoft is not supported.
- Email/password account creation collects first name, email and password. Social registration uses the approved first name returned by the provider.
- Account confirmation email is sent after successful creation. Product access is not blocked unless verification policy requires it.
- The authenticated left navigation order is Home, Job Analyzer, Skills Match, Career Pivot, Market Report and Career Profile.
- The account avatar menu contains regular account Profile, Theme and Log out. Regular Profile is not Career Profile.

*Figure A1. Guest-first activation preserves work through account creation.*

## 4. End-to-end routing and state model

| Entry point | First destination | Post-account destination |
| --- | --- | --- |
| Direct Create account | Authentication | New-account Home |
| Sign in | Authentication | Resolved returning-user Home |
| Guest Career Pivot | Guest Pivot workspace | Career Pivot result/workspace |
| Guest Job Analyzer | Guest Job Analyzer workspace | Full Job Analyzer result |
| Guest Market Report | Guest report overview | Authenticated report overview, then full report |

### Dashboard Home states

| State | Primary content | Rules |
| --- | --- | --- |
| New / no saved work | Career Pivot recommended start; Job Analyzer, Skills Match and Market Report quick actions; Career Profile at 0%. | No name/history unless supplied. |
| Returning / unfinished | Resume the most recent unfinished item; show other recent work secondarily. | One dominant Continue action. |
| Returning / completed | Latest result, recommended next step and recent work. | Do not show completed Career Profile as a quick action. |
| Returning / no saved work | Fresh starting points and profile progress. | No fabricated recents. |

*Figure A2. Dashboard Home is selected from persisted account state.*

## 5. Shared Career Profile and progressive persistence

Career Profile stores reusable career facts. Tools may collect compatible facts in context, save them progressively and prefill later experiences. The user should only review missing or changed information.

| Profile group | Key fields | Used by |
| --- | --- | --- |
| Career context | Situation, current/recent role, industry/function, experience level, location | Career Pivot, Market Report |
| Career evidence | Work history, responsibilities, achievements, skills, education | Career Pivot, Skills Match |
| Direction | Desired improvement, target roles, transferable skills | Career Pivot, Skills Match |
| Preferences | Work arrangement, locations and optional compensation preferences | Market Report and future recommendations |

- LinkedIn URL, résumé upload and manual entry are offered on the Career Profile page. The selected input appears on that same page.

- Manual work experience is added or edited in focused modal forms.
- Each valid section saves independently and updates the Home progress indicator.
- Guest Career Pivot answers populate matching Career Profile fields after account creation.
- Career Profile values prefill Career Pivot and Market Report. Users can review what changed without answering the same questions again.
- Tool-specific results never silently overwrite previously confirmed profile facts.

*Figure A3. One progressive profile supports multiple features without duplicated questions.*

## 6. Career Pivot Accelerator and action plan

Career Pivot helps the user answer: Which realistic roles can I move into using what I already know, what transfers, what is missing and what should I do next?

| Input | Requirement | Behavior |
| --- | --- | --- |
| Situation | Required, single select | Recently laid off; concerned about layoffs; feeling stuck; ready for change; industry changing; seeking growth. |
| Current/recent role | Required, searchable select | Persist to Career Profile. |
| Industry/function | Required, searchable select | Persist to Career Profile. |
| Experience level | Required | Entry, mid, senior, lead/executive. |
| Location | Required, searchable select | City/region and country. |
| Desired improvement | Required, single select | Security, income, growth, industry change, use skills differently or work-life balance. |
| Skills to transfer | Required, minimum 3 | Typeahead; Enter selects highlighted skill; offer custom skill only when absent. |

### Result contract

- Return three realistic paths, ranked with transparent fit rationale.
- For each path show transferable strengths, meaningful gaps, market signal and a practical next step.
- The first result does not require a résumé.
- Strengthen my profile opens Career Profile only when deeper evidence is needed and returns to the same pivot.
- Build a plan produces a saved action plan after account creation or authenticated continuation.
- Career Pivot workspace supports empty, unfinished, saved-result and repeat-use states.
- Saved explorations appear directly in the workspace with Open or Continue actions and a New exploration button.
- A new exploration creates a separate record and never overwrites prior work.
- Do not show In progress or Completed filter chips.
- Prefill message: “Your Career Profile is already applied. We’ve prefilled this exploration with your saved role, industry, experience and skills. Review only what has changed.”

*Figure A4. Career Pivot supports immediate direction, progressive evidence and repeat exploration.*

### US-CP-01. Start a guest pivot

*User story. As a visitor, I want to explore a career pivot without creating an account so I can judge the value first.*

**Functional expectations**

- Open the compact pivot form from the landing page.
- Carry all landing inputs into the guest workspace.
- Validate all required fields and at least three transferable skills.

**Acceptance criteria**

1. Valid inputs produce three path previews.
2. No résumé or account is required.
3. Refresh recovery does not discard a submitted guest result.

### US-CP-02. Continue with an existing Career Profile

*User story. As an authenticated user with saved profile data, I want Career Pivot prefilled so I only review changes.*

**Functional expectations**

- Prefill shared fields from Career Profile.
- Clearly distinguish saved values from missing tool-specific answers.
- Do not display redundant explanatory panels.

**Acceptance criteria**

1. Saved fields appear accurately.
2. The user can change the exploration without silently overwriting confirmed profile facts.
3. The approved concise profile-applied message is shown.

### US-CP-03. Resume or create another pivot

*User story. As a returning user, I want to open past pivot work or start a new exploration so I can compare options over time.*

**Functional expectations**

- Show unfinished and saved explorations in one list.
- Provide Continue/Open actions and a visible New exploration action.
- Do not use status-filter chips.

**Acceptance criteria**

1. Opening an item restores its exact state.
2. New exploration creates a distinct record.
3. Prior records remain unchanged.

## 7. Job Analyzer and Hidden Expectations

The analyzed job is supplied by the user. The system does not invent or autonomously select a job role. Pasted job-description text is the primary input; a URL may be retrieved only when supported and successfully parsed.

| Output | What the user sees |
| --- | --- |
| Role summary | Role, seniority, core mandate and explicit requirements. |
| Hidden expectations | Inferred business outcomes, operating expectations and unstated success criteria. |
| Evidence | Quoted or paraphrased job-language signals supporting each inference. |
| Confidence | High, medium or low with a plain-language reason. |
| Risks/questions | Ambiguities, stretch expectations and interview questions to validate. |
| Next step | Assess my match when sufficient Career Profile evidence exists. |

- The guest job description carries into the guest workspace; do not show the same input step again.

- Authenticated Job Analyzer uses the same approved analysis hierarchy as the guest experience.
- Workspace shows latest analysis, previous analyses and New analysis.
- Full result, saving and Skills Match require an account.

*Figure A5. Job Analyzer preserves the user-supplied job and supports repeat analyses.*

### US-JA-01. Analyze a supplied job

*User story. As a visitor, I want to paste a job description and see what it really asks for so I can decide whether to pursue it.*

**Functional expectations**

- Accept job text and optional supported URL.
- Extract explicit requirements and infer hidden expectations.
- Separate evidence from inference.

**Acceptance criteria**

1. The submitted job is preserved.
2. Every hidden expectation includes evidence and confidence.
3. Unsupported URL retrieval returns a recoverable paste-text option.

### US-JA-02. Manage job analyses

*User story. As an authenticated user, I want to review previous analyses and create a new one so I can compare roles.*

**Functional expectations**

- Show latest and previous analyses in the Job Analyzer workspace.
- Provide Open and New analysis actions.
- Keep the feature active in the left navigation.

**Acceptance criteria**

1. Opening a saved analysis restores the full result.
2. New analysis does not replace prior analyses.
3. Empty history shows a clear first-analysis state.

## 8. Skills Match

Skills Match compares a specific role or analyzed job with evidence in Career Profile. It must not claim a personal match from market data alone.

| Prerequisite state | Experience |
| --- | --- |
| Target + sufficient profile | Run immediately using saved evidence; no repeated questions. |
| Target missing | Ask the user to choose a saved job analysis or target role. |
| Profile evidence insufficient | Open Career Profile at the missing section and retain the target. |
| Both missing | Explain both requirements and start with the shortest recoverable step. |

| Result area | Requirement |
| --- | --- |
| Overall match | 0–100 score with model-version and confidence metadata. |
| Matched strengths | Skills/evidence clearly supporting the target. |
| Partial matches | Relevant but weak, old or insufficiently evidenced capabilities. |
| Priority gaps | Only gaps materially affecting fit. |
| Evidence trace | Source profile item or job requirement behind each classification. |
| Actions | Evidence to add, skills to strengthen and next recommended workflow. |

*Figure A6. Skills Match branches only when target or evidence is missing.*

### US-SM-01. Assess a ready match

*User story. As a user with a target and sufficient Career Profile evidence, I want an immediate skills assessment so I can focus on the gaps that matter.*

**Functional expectations**

- Reuse target and profile evidence.
- Avoid repeating profile questions.
- Return score, matches, partial matches, gaps and actions.

**Acceptance criteria**

1. Result classifications link to evidence.
2. No prerequisite form is displayed when inputs already exist.
3. The user can return to the originating job or market recommendation.

### US-SM-02. Recover missing prerequisites

*User story. As a user missing required evidence, I want a clear path to complete only what is necessary so I can finish the match.*

**Functional expectations**

- Identify the missing prerequisite precisely.
- Route to the relevant Career Profile section.
- Preserve the target and return route.

**Acceptance criteria**

1. Completion returns to Skills Match.
2. Previously supplied target is retained.
3. The user is not sent through full onboarding.

## 9. Market Report

Market Report answers: How healthy is demand for this role in this location, what is changing, which opportunities are credible, what capabilities matter next and what evidence supports the conclusion?

| Input | Requirement |
| --- | --- |
| Role | Required; profile-prefilled when available. |
| Industry/function | Required; profile-prefilled when available. |
| Seniority | Required; profile-prefilled when available. |
| Location | Required city/region and country; profile-prefilled when available. |

### Report hierarchy

| Surface | Contents |
| --- | --- |
| Overview | Outlook hero; role demand, competition and 12-month outlook; three personalized shifts; recommended next step; one path worth exploring. |
| Opportunities | Role opportunities combining best-fit and roles-to-watch; hiring sectors; locations; risks to watch. |
| Skills & actions | Three priority capabilities, evidence-building action for each and 30-day focus; Skills Match handoff. |
| Evidence | Grouped lenses, named sources, publication/update period, geography, confidence and limitations. |

- Guest Market Report begins from the landing page and opens a guest workspace, not the authenticated dashboard.

- At 100% generation progress, automatically open the report overview; no View report button.
- In guest overview, See all insights, Assess my skills, See all recommendations, Explore this path and View full report trigger account creation.
- After account creation, route to authenticated report overview before the full report.
- Full report uses horizontal tabs: Overview, Opportunities, Skills & actions and Evidence.
- The authenticated workspace shows the latest report and previous reports directly on the page.
- Review opens a dated snapshot; Create new Market Report opens the compact form with latest parameters prefilled.
- A new report creates a new dated record and preserves earlier snapshots.
- Share and Download PDF are not shown in the guest state.

*Figure A7. Market Report supports guest value, authenticated depth and repeat reports.*

### US-MR-01. Generate a guest overview

*User story. As a visitor, I want a useful market overview before registering so I can judge whether the report is relevant.*

**Functional expectations**

- Collect role, industry, seniority and location.
- Show a compact circular generation state.
- Automatically display the overview at 100%.

**Acceptance criteria**

1. No dashboard is shown before authentication.
2. The overview contains outlook, three insights, one recommendation and one path.
3. Deeper actions open the account gate without losing the report.

### US-MR-02. Use profile-prefilled market inputs

*User story. As an authenticated user with a Career Profile, I want report fields prefilled so I can generate quickly.*

**Functional expectations**

- Prefill valid role, industry, seniority and location.
- Allow edits before generation.
- Do not show internal profile-reuse explanations.

**Acceptance criteria**

1. All prefilled values match the current profile.
2. Edits apply to the report request.
3. Generation persists parameters before starting.

### US-MR-03. Create and review recurring reports

*User story. As a returning user, I want to see prior reports and create a new dated report so I can track changes.*

**Functional expectations**

- Show latest report and prior snapshots inline.
- Provide Review and Create new Market Report actions.
- Keep old snapshots immutable.

**Acceptance criteria**

1. Review opens the selected report.
2. New report preserves previous records.
3. The latest report becomes the default after successful generation.

## 10. Account, onboarding and conversion user stories

### US-AUTH-01. Create an account directly

*User story. As a visitor, I want to create an account from the landing or authentication page so I can access the workspace without running a demo.*

**Functional expectations**

- Support email/password, Google, LinkedIn and Facebook.
- Collect/approve first name.
- Send account confirmation email.
- Open new-account Home.

**Acceptance criteria**

1. Microsoft is absent.
2. Legal consent text and policy links are shown.
3. No fabricated name or work appears on Home.

### US-AUTH-02. Convert from a guest result

*User story. As a guest, I want my preview and inputs preserved when I create an account so I can continue without starting over.*

**Functional expectations**

- Persist guest context before opening authentication.
- Restore the originating feature, record and next action after authentication.
- Handle existing-account sign-in from the same gate.

**Acceptance criteria**

1. No submitted input is repeated.
2. The correct feature is active in dashboard navigation.
3. Failure leaves the guest preview recoverable.

### US-HOME-01. See a useful new-account Home

*User story. As a newly registered user with no saved work, I want clear starting points so I can decide what to do first.*

**Functional expectations**

- Show the Career Pivot recommended start.
- Show Job Analyzer, Skills Match and Market Report quick actions.
- Show a separate Start Career Profile action and 0% progress.

**Acceptance criteria**

1. Quick actions are not duplicated by another Get started module.
2. Career Profile is last in the menu.
3. No recent history is fabricated.

### US-HOME-02. Resume unfinished work

*User story. As a returning user with unfinished work, I want Home to prioritize the exact task I left so I can continue quickly.*

**Functional expectations**

- Resolve most recent unfinished work.
- Show one dominant Continue action.
- Display secondary recent work below.

**Acceptance criteria**

1. Continue restores exact feature state.
2. Completed items are not presented as unfinished.
3. The route survives a new session.

## 11. Field dictionary and validation

| Field | Type | Required | Validation / behavior |
| --- | --- | --- | --- |
| First name | Text | Account creation | 1–60 characters; approved social value or user entry. |
| Email | Email | Email auth | Normalized, unique, verified format. |
| Password | Password | Email auth | Minimum 8 characters; strength and breached-password policy enforced server-side. |
| Role | Searchable select | Pivot/Market | Choose taxonomy value or supported custom value. |
| Industry/function | Searchable select | Pivot/Market | Choose taxonomy value. |
| Seniority | Single select | Pivot/Market | Controlled vocabulary. |
| Location | Searchable location | Pivot/Market | Resolved city/region/country. |
| Transferable skills | Multi-select typeahead | Pivot | Minimum 3; Enter selects highlight; custom only if absent. |
| Job description | Long text | Job Analyzer | Minimum useful length; sanitize markup; preserve source. |
| LinkedIn URL | URL | Profile source option | Valid linkedin.com profile URL; authorization and retrieval rules apply. |
| Résumé | File upload | Profile source option | PDF/DOC/DOCX; size/type validation; malware scan. |

## 12. AI, RAG and evidence requirements

| Capability | Required controls |
| --- | --- |
| Job inference | Separate explicit text from inference; evidence span, confidence, model/prompt version. |
| Pivot ranking | Use user inputs, role taxonomy, transferable-skill graph and current market signals; expose concise rationale. |
| Skills Match | Trace each match/gap to job requirement and profile evidence; prevent unsupported scoring. |
| Market Report | Use current, geographically relevant and authoritative sources; record source, date, geography and confidence. |
| Safety | Avoid deterministic employment promises, fear-based layoff language and protected-attribute inference. |
| Observability | Store run ID, latency, source set, model version, prompt version, validation result and fallback path. |

## 13. Backend, data, security and admin

| Area | Requirement |
| --- | --- |
| Guest session | Opaque guest session ID, encrypted payload, expiry and authenticated claim/merge. |
| Profile | Section-level save, completion state, source provenance and user-confirmed values. |
| Feature records | Separate immutable/snapshotted analysis records; latest pointers; status and timestamps. |
| Routing | Persist origin feature, record ID, pending action and return destination. |
| Security | Encryption in transit/at rest, least privilege, file scanning, rate limiting, audit events and deletion controls. |
| Admin | Search users and feature runs; inspect failures, sources and versions; manage taxonomies and prompt releases; no silent user-data edits. |

| Core entity | Purpose |
| --- | --- |
| User / Account | Identity, auth methods, settings and plan. |
| GuestSession | Pre-account inputs, preview and conversion context. |
| CareerProfile / ProfileSection | Reusable evidence and completion. |
| PivotExploration / PivotPath / ActionPlan | Career Pivot history and selected plan. |
| JobAnalysis / HiddenExpectation | Job result and evidence. |
| SkillsAssessment | Target, evidence snapshot and result. |
| MarketReport / MarketSnapshot | Latest and historical reports. |
| AIExecution / EvidenceSource | Traceability and governance. |

## 14. Analytics, accessibility and non-functional requirements

| Category | Requirement |
| --- | --- |
| Analytics | Track entry point, guest start/complete, account-gate trigger, conversion, continuation success, profile section save, new/history actions and report tabs. |
| Performance | Primary pages interactive within 2.5 s on standard broadband; input feedback under 100 ms; generation progress responsive. |
| Accessibility | WCAG 2.2 AA; keyboard operation; visible focus; labels/errors; 44 px touch targets; non-color status cues. |
| Responsive | Desktop sidebar; tablet compact navigation; mobile stacked layout with persistent primary action only when it does not obscure content. |
| Reliability | Idempotent create operations; retryable AI failures; preserved inputs; explicit partial/fallback states. |
| Privacy | Clear purpose, data minimization, consent, retention and deletion; no third-party sharing claims without legal validation. |

## 15. Prototype screen catalogue and behavior contract

These figures are retained as implementation references. They show hierarchy and state rather than final pixel-perfect production styling. Engineering must implement the interaction rules in this PRD even where a static figure cannot show every state.

*Prototype screen P01. Updated state aligned to the current agreed flow.*

*Prototype screen P02. Updated state aligned to the current agreed flow.*

*Prototype screen P03. Updated state aligned to the current agreed flow.*

*Prototype screen P04. Updated state aligned to the current agreed flow.*

*Prototype screen P05. Updated state aligned to the current agreed flow.*

*Prototype screen P06. Updated state aligned to the current agreed flow.*

*Prototype screen P07. Updated state aligned to the current agreed flow.*

| Viewport | Behavior |
| --- | --- |
| ≥1200 px | Persistent left navigation; content max-width; two- or three-column supporting layouts. |
| 768–1199 px | Compact/collapsible navigation; two-column where readable; horizontal tabs remain scrollable. |
| <768 px | Stack content; forms one column; bottom/flyout navigation; no clipped tables; account gates stack beneath preview. |

## 16. Error handling, traceability and definition of done

| Failure | Required recovery |
| --- | --- |
| Guest context unavailable | Return to the relevant compact form with retained local values where possible. |
| Social auth cancelled | Return to authentication without losing guest result. |
| URL retrieval fails | Explain and offer paste-text input. |
| Résumé parsing incomplete | Show extracted fields for review and allow manual correction. |
| AI generation fails | Keep inputs, show retry and log failure; do not create empty record. |
| Source freshness insufficient | Show evidence limitation and avoid definitive market claims. |

### Definition of done

- All user stories and acceptance criteria have passing product, design and engineering tests.
- All diagrams, prototype figures, routes, labels and menu order match this PRD.
- Guest-to-account continuation is tested for Career Pivot, Job Analyzer and Market Report.
- Dashboard states are tested with empty, unfinished, completed and no-saved-work data.
- Career Profile progressive save and cross-feature prefill are tested in both directions.
- Career Pivot, Job Analyzer and Market Report history/new-item states preserve older records.
- AI outputs include evidence, confidence and version metadata required by their feature.
- Keyboard, screen-reader, responsive, loading, empty, error and retry states pass review.

## Appendix A. Rendered user-journey diagrams

The diagrams below are embedded as images so they remain visible in Word, exported PDF and document viewers. They are not raw Mermaid text.

*Appendix A1. Current approved process flow.*

*Appendix A2. Current approved process flow.*

*Appendix A3. Current approved process flow.*

*Appendix A4. Current approved process flow.*

*Appendix A5. Current approved process flow.*

*Appendix A6. Current approved process flow.*

*Appendix A7. Current approved process flow.*
