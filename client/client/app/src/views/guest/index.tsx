import React, { useEffect, useState } from 'react';
import { FileDropZone } from '../../components/FileDropZone';
import { SelectField } from '../../components/forms';
import { JourneyHeader, Progress } from '../../components/layout';
import { SkillPicker } from '../../components/SkillPicker';
import { INDUSTRY_OPTIONS, LOCATION_OPTIONS, ROLE_OPTIONS } from '../../consts';
import { testIds } from '../../data-test-ids';
import { setJobUploadFile } from '../../lib/jobUploadFile';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { JobSource, Tool } from '../../types';

const SENIORITY_OPTIONS = [
  'Entry level',
  'Junior',
  'Mid-level',
  'Lead / Manager',
  'Director',
  'Executive',
];

const JOB_SOURCE_CHOICES: Array<[JobSource, string, string]> = [
  ['url', 'Job URL', 'Use a public, accessible posting'],
  ['paste', 'Paste description', 'Best when a URL blocks access'],
  ['upload', 'Upload document', 'PDF, DOCX or TXT'],
];

const PIVOT_CHALLENGES: Array<[string, string]> = [
  ['layoff', 'Recently laid off'],
  ['risk', 'Concerned about layoffs'],
  ['stuck', 'Feeling stuck'],
  ['career-change', 'Ready for a change'],
  ['disruption', 'Industry is changing'],
  ['growth', 'Seeking growth'],
];

export const PIVOT_GOALS = [
  'Better job security',
  'Higher income',
  'More growth opportunities',
  'Leave a declining industry',
  'Use my skills differently',
  'Better work-life balance',
];

const progressSteps = (tool: Tool): { step: number; names: string[] } =>
  tool === 'job'
    ? { step: 2, names: ['Your input', 'Review', 'Preview'] }
    : { step: 1, names: ['Your input', 'Preview'] };

const PROCESSING_LABELS: Record<Tool, string> = {
  job: 'job analysis',
  pivot: 'pivot options',
  market: 'market snapshot',
};

/**
 * Interstitial that runs live generate for Market Report / Job Analyzer when configured.
 */
export const Processing: React.FC<{ tool: Tool }> = ({ tool }) => {
  const { navigate, patch, state, toast } = useClarity();
  const { step, names } = progressSteps(tool);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (tool === 'pivot') {
      const timer = window.setTimeout(() => navigate('pivot-preview'), 850);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    if (tool === 'job') {
      const finishJob = async () => {
        setProgressLabel('Analyzing posting');
        const { runJobAnalysis } = await import('../job-workspace/runJobAnalysis');
        const result = await runJobAnalysis({
          source: state.jobSource,
          postingText: state.jobPostingText,
          url: state.jobUrl,
          job: state.job,
          registered: state.registered,
        });
        if (cancelled) return;

        if (result.ok && !result.fromFixtures && result.analysis) {
          patch({
            jobLiveAnalysis: result.analysis,
            jobLiveError: null,
            jobHasAnalyses: state.registered ? true : state.jobHasAnalyses,
          });
          navigate(state.registered ? 'job-workspace-result' : 'job-preview');
          return;
        }
        if (result.ok) {
          patch({ jobLiveError: null });
          navigate(state.registered ? 'job-workspace-result' : 'job-preview');
          return;
        }
        toast(result.error);
        patch({ jobLiveError: result.error });
        navigate(state.registered ? 'job-workspace-review' : 'job-review');
      };
      void finishJob();
      return () => {
        cancelled = true;
      };
    }

    const finishMarket = async () => {
      const { runMarketReportGeneration } = await import(
        '../market-workspace/runMarketReportGeneration'
      );
      const result = await runMarketReportGeneration(state.market, (update) => {
        if (!cancelled) setProgressLabel(update.message || null);
      });
      if (cancelled) return;

      if (result.ok && !result.fromFixtures) {
        patch({
          marketHasReports: true,
          marketGuestReady: true,
          marketLiveInsights: result.insights,
          marketLiveError: null,
        });
      } else if (result.ok) {
        patch({
          marketHasReports: true,
          marketGuestReady: true,
          marketLiveError: null,
        });
      } else {
        toast(result.error);
        patch({
          marketHasReports: true,
          marketGuestReady: true,
          marketLiveError: result.error,
        });
      }
      navigate('market-workspace-result');
    };

    void finishMarket();
    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    patch,
    state.job,
    state.jobHasAnalyses,
    state.jobPostingText,
    state.jobSource,
    state.jobUrl,
    state.market,
    state.registered,
    toast,
    tool,
  ]);

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={step} names={names} />
          <section className="workspace">
            <div className="body" style={{ textAlign: 'center', padding: '80px 25px' }}>
              <div
                className="score"
                style={{ margin: 'auto', borderTopColor: 'var(--green)' }}
              >
                …
              </div>
              <h2>Preparing your {PROCESSING_LABELS[tool]}</h2>
              {progressLabel ? <p style={{ marginTop: 12 }}>{progressLabel}</p> : null}
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export const JobSourceChoices: React.FC<{
  choices?: Array<[JobSource, string, string]>;
}> = ({ choices = JOB_SOURCE_CHOICES }) => {
  const { state, setJobSource } = useClarity();
  return (
    <div className="choicegrid">
      {choices.map(([key, title, hint]) => (
        <button
          key={key}
          type="button"
          data-testid={testIds.jobSource(key)}
          className={`choice ${state.jobSource === key ? 'active' : ''}`}
          onClick={() => setJobSource(key)}
        >
          <b>{title}</b>
          <small>{hint}</small>
        </button>
      ))}
    </div>
  );
};

export const JobInputView: React.FC = () => {
  const { state, navigate, patch, toast } = useClarity();

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={0} />
          <section className="workspace" data-testid={testIds.jobWorkspace}>
            <div className="workspacehead">
              <div>
                <div className="eyebrow">Job Analyzer</div>
                <h2>What opportunity are you considering?</h2>
                <p>
                  Provide the complete posting. Clarity Coach will not invent a job from a
                  title alone.
                </p>
              </div>
            </div>
            <div className="body">
              <JobSourceChoices />
              {state.jobSource === 'url' ? (
                <div className="field">
                  <label>
                    Public job URL <small>Required</small>
                  </label>
                  <input
                    className="input"
                    value={state.jobUrl}
                    onChange={(event) => patch({ jobUrl: event.target.value })}
                    placeholder="https://…"
                  />
                </div>
              ) : state.jobSource === 'upload' ? (
                <div className="field">
                  <label>
                    Job description file <small>Required</small>
                  </label>
                  <FileDropZone
                    accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
                    emptyLabel="Drop PDF, DOCX or TXT here, or choose a file"
                    hint="PDF, DOCX or TXT · maximum 10 MB · images are not supported"
                    selectedName={state.jobUploadFileName}
                    testId={testIds.jobUploadDropzone}
                    onInvalid={(message) => toast(message)}
                    onFile={(file) => {
                      setJobUploadFile(file);
                      patch({
                        jobUploadFileName: file.name,
                        jobPostingText: `[Uploaded file: ${file.name}]`,
                      });
                      toast(`Selected ${file.name}`);
                    }}
                  />
                </div>
              ) : (
                <div className="field">
                  <label>
                    Complete job description <small>Required</small>
                  </label>
                  <textarea
                    className="input"
                    data-testid={testIds.jobPasteTextarea}
                    style={{ minHeight: 230 }}
                    value={state.jobPostingText}
                    onChange={(event) => patch({ jobPostingText: event.target.value })}
                  />
                </div>
              )}
              <div className="formactions">
                <span className="privacy">
                  The job—not your résumé—is the required input for Hidden Expectations.
                </span>
                <button
                  type="button"
                  className="btn primary"
                  data-testid={testIds.jobReviewContinue}
                  onClick={() => {
                    if (
                      state.jobSource === 'paste' &&
                      state.jobPostingText.trim().length < 40
                    ) {
                      toast('Paste the complete job description before continuing.');
                      return;
                    }
                    if (state.jobSource === 'url' && !state.jobUrl.trim()) {
                      toast('Enter a public job URL, or switch to paste.');
                      return;
                    }
                    if (state.jobSource === 'upload' && !state.jobUploadFileName) {
                      toast('Choose a PDF, DOCX, or TXT posting file.');
                      return;
                    }
                    navigate('job-review');
                  }}
                >
                  Review job →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export const JobReviewView: React.FC = () => {
  const { state, navigate, patch } = useClarity();
  const [processing, setProcessing] = useState(false);

  if (processing) return <Processing tool="job" />;

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={1} />
          <section className="workspace">
            <div className="workspacehead">
              <div>
                <div className="eyebrow">Confirm what we found</div>
                <h2>Review the job before analysis</h2>
                <p>Correcting these details improves the result.</p>
              </div>
            </div>
            <div className="body">
              <div className="split">
                <div className="field">
                  <label>
                    Job title <small>Required</small>
                  </label>
                  <input
                    className="input"
                    value={state.job.title}
                    onChange={(event) =>
                      patch({ job: { ...state.job, title: event.target.value } })
                    }
                  />
                </div>
                <div className="field">
                  <label>
                    Company <small>Optional</small>
                  </label>
                  <input
                    className="input"
                    value={state.job.company}
                    onChange={(event) =>
                      patch({ job: { ...state.job, company: event.target.value } })
                    }
                  />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input
                    className="input"
                    value={state.job.location}
                    onChange={(event) =>
                      patch({ job: { ...state.job, location: event.target.value } })
                    }
                  />
                </div>
              </div>
              <div className="formactions">
                <a
                  className="btn secondary"
                  href="#job-input"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate('job-input');
                  }}
                >
                  ← Back
                </a>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setProcessing(true)}
                >
                  Analyze this job →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export const PivotInputView: React.FC = () => {
  const { state, patch } = useClarity();
  const [processing, setProcessing] = useState(false);

  if (processing) return <Processing tool="pivot" />;

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={0} names={['Your input', 'Preview']} />
          <section className="workspace">
            <div className="workspacehead">
              <div>
                <div className="eyebrow">Career Pivot</div>
                <h2>Find careers that fit your experience.</h2>
              </div>
            </div>
            <div className="body">
              <div className="field">
                <label>
                  Which best describes your situation? <small>Required</small>
                </label>
                <div className="chips">
                  {PIVOT_CHALLENGES.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`chip ${state.challenge === key ? 'selected' : ''}`}
                      onClick={() => patch({ challenge: key })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="split">
                <SelectField
                  label={
                    <>
                      Current or recent role <small>Required</small>
                    </>
                  }
                  value={state.pivot.title}
                  options={ROLE_OPTIONS}
                  onChange={(title) => patch({ pivot: { ...state.pivot, title } })}
                />
                <SelectField
                  label={
                    <>
                      Industry or function <small>Required</small>
                    </>
                  }
                  value={state.pivot.industry}
                  options={INDUSTRY_OPTIONS}
                  onChange={(industry) => patch({ pivot: { ...state.pivot, industry } })}
                />
                <SelectField
                  label={
                    <>
                      Experience level <small>Required</small>
                    </>
                  }
                  value={state.pivot.experience}
                  options={SENIORITY_OPTIONS}
                  onChange={(experience) =>
                    patch({ pivot: { ...state.pivot, experience } })
                  }
                />
                <SelectField
                  label={
                    <>
                      Location <small>Required</small>
                    </>
                  }
                  value={state.pivot.location}
                  options={LOCATION_OPTIONS}
                  onChange={(location) => patch({ pivot: { ...state.pivot, location } })}
                />
              </div>
              <div className="field">
                <label>
                  What should your next move improve? <small>Required</small>
                </label>
                <div className="chips">
                  {PIVOT_GOALS.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      className={`chip ${state.pivot.goal === goal ? 'selected' : ''}`}
                      onClick={() => patch({ pivot: { ...state.pivot, goal } })}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>
              <SkillPicker
                skills={state.pivot.skills}
                onChange={(skills) => patch({ pivot: { ...state.pivot, skills } })}
              />
              <div className="formactions">
                <span className="privacy">No résumé required.</span>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setProcessing(true)}
                >
                  Show my career options →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export const MarketInputView: React.FC = () => {
  const { state, patch } = useClarity();
  const [processing, setProcessing] = useState(false);

  if (processing) return <Processing tool="market" />;

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={0} names={['Your input', 'Preview']} />
          <section className="workspace" data-testid={testIds.marketWorkspace}>
            <div className="workspacehead">
              <div>
                <div className="eyebrow">Market Report</div>
                <h2>Check your career market.</h2>
              </div>
            </div>
            <div className="body">
              <div className="split">
                <SelectField
                  label={
                    <>
                      Role or career area <small>Required</small>
                    </>
                  }
                  value={state.market.role}
                  options={ROLE_OPTIONS}
                  onChange={(role) => patch({ market: { ...state.market, role } })}
                />
                <SelectField
                  label={
                    <>
                      Seniority <small>Required</small>
                    </>
                  }
                  value={state.market.level}
                  options={SENIORITY_OPTIONS}
                  onChange={(level) => patch({ market: { ...state.market, level } })}
                />
                <SelectField
                  label={
                    <>
                      City, region or country <small>Required</small>
                    </>
                  }
                  value={state.market.location}
                  options={LOCATION_OPTIONS}
                  onChange={(location) =>
                    patch({ market: { ...state.market, location } })
                  }
                />
                <div className="field">
                  <label>
                    Industry <small>Optional</small>
                  </label>
                  <select className="input" defaultValue="">
                    <option value="">Any industry</option>
                    {INDUSTRY_OPTIONS.map((industry) => (
                      <option key={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>
                    Work preference <small>Optional</small>
                  </label>
                  <select className="input" defaultValue="Any">
                    <option>Any</option>
                    <option>Remote</option>
                    <option>Hybrid</option>
                    <option>On-site</option>
                  </select>
                </div>
              </div>
              <div className="formactions">
                <span className="privacy">No résumé required.</span>
                <button
                  type="button"
                  className="btn primary"
                  data-testid={testIds.marketGenerateCta}
                  onClick={() => setProcessing(true)}
                >
                  Show my market snapshot →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

interface PreviewBaseProps {
  title: string;
  subtitle: string;
  tool: Tool;
  children: React.ReactNode;
}

const PreviewBase: React.FC<PreviewBaseProps> = ({ title, subtitle, tool, children }) => {
  const { navigate } = useClarity();
  const { step, names } = progressSteps(tool);

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={step} names={names} />
          <div className="previewbar">
            <div>
              <b>Your preview is ready</b>
              <br />
              <span>Temporarily retained in this browser session</span>
            </div>
            <span className="guesttag">Not yet saved to an account</span>
          </div>
          <section className="workspace">
            <div className="workspacehead">
              <div>
                <div className="eyebrow">{title}</div>
                <h2>{subtitle}</h2>
                <p>
                  Create a free account to unlock your full result and save your progress.
                </p>
              </div>
            </div>
            <div className="body">
              <div className="resultlayout">
                <div className="resultmain">{children}</div>
                <aside className="sidepanel">
                  <div className="unlock">
                    <span className="label">Continue in Clarity Coach</span>
                    <h3>Save this result and unlock the complete analysis</h3>
                    <p>
                      Your inputs, preview and selected starting point will carry into
                      your dashboard.
                    </p>
                    <ul>
                      <li>Full evidence-backed result</li>
                      <li>Personalized next steps</li>
                      <li>Saved history and progress</li>
                    </ul>
                    <button
                      type="button"
                      className="btn primary full"
                      onClick={() => navigate(`signup-${tool}`)}
                    >
                      Create free account →
                    </button>
                    <button
                      type="button"
                      className="btn ghost full"
                      onClick={() => navigate('signin')}
                    >
                      I already have an account
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export const JobPreviewView: React.FC = () => {
  const { state, navigate, patch } = useClarity();
  const live = state.jobLiveAnalysis?.result;
  const stated = live?.statedRequirements?.slice(0, 4) ?? [];
  const hidden = live?.hiddenExpectations?.[0];

  return (
    <PreviewBase
      title="Job Analyzer preview"
      subtitle={`${state.job.title} · ${state.job.company}`}
      tool="job"
    >
      <section className="resultsection">
        <span className="label">Role focus</span>
        <h3>{live?.roleFocus ?? 'Turn product strategy into a more reliable operating rhythm.'}</h3>
        <p className="lead" style={{ fontSize: 14 }}>
          {live?.roleFocusSummary ??
            'The posting emphasizes ownership, cross-functional alignment and measurable outcomes more often than feature delivery.'}
        </p>
      </section>
      <section className="resultsection">
        <span className="label">Key stated requirements</span>
        <div className="chips" style={{ marginTop: 12 }}>
          {(stated.length
            ? stated.map((item) => item.title)
            : [
                'Product strategy',
                'Roadmap ownership',
                'Cross-functional delivery',
                'Customer and performance data',
              ]
          ).map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>
      </section>
      <section className="resultsection">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15 }}>
          <span className="label">Likely hidden expectation</span>
          <span className={`pill ${hidden?.confidence === 'medium' ? 'medium' : 'high'}`}>
            {(hidden?.confidence ?? 'high').replace(/^./, (c) => c.toUpperCase())} confidence
          </span>
        </div>
        <h3>{hidden?.title ?? 'Stabilize cross-functional product delivery'}</h3>
        <div className="evidence">
          <b>Why this was inferred</b>
          <br />
          {hidden?.evidence?.map((e) => e.quote).join(' · ') ||
            'Repeated references to operating cadence, stakeholder alignment, dependencies and measurable execution.'}
        </div>
        <p>
          <b>What it means:</b>{' '}
          {hidden?.implication ??
            'Prepare one example showing how you restored momentum across teams without relying on formal authority.'}
        </p>
      </section>
      <section className="resultsection">
        <span className="label">Questions worth asking</span>
        <p>
          {live?.questionsWorthAsking?.join(' ') ||
            'Where does product delivery currently lose momentum? What would success look like after six months?'}
        </p>
      </section>
      <section className="resultsection">
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            patch({
              pendingGuest: 'job',
              postAuthRoute: 'job-workspace-result',
              entryPoint: 'guest-job',
            });
            navigate('signup-job');
          }}
        >
          Save full analysis →
        </button>
      </section>
    </PreviewBase>
  );
};

const PIVOT_PATHS: Array<[string, string, string]> = [
  ['1', 'Payments Platform Product Lead', 'High transferability'],
  ['2', 'Fintech Solutions Consultant', 'Strong adjacent fit'],
  ['3', 'Product Operations Lead', 'Moderate upskilling'],
];

export const PivotPreviewView: React.FC = () => {
  const { state } = useClarity();
  return (
    <PreviewBase
      title="Career Pivot preview"
      subtitle="Three adjacent paths worth investigating"
      tool="pivot"
    >
      <section className="resultsection">
        <span className="label">Your starting point</span>
        <h3>
          {state.pivot.title} · {state.pivot.industry}
        </h3>
        <p className="lead" style={{ fontSize: 14 }}>
          Your strongest portable evidence is in regulated product delivery, payments,
          stakeholder coordination and data-informed prioritization.
        </p>
      </section>
      <section className="resultsection">
        <span className="label">Potential pivot paths</span>
        {PIVOT_PATHS.map(([rank, name, confidence]) => (
          <div key={rank} className="pivotrow">
            <span className="rank">{rank}</span>
            <div>
              <b>{name}</b>
              <p>
                Builds on confirmed product, payments and cross-functional experience.
              </p>
            </div>
            <span className={`pill ${rank === '3' ? 'medium' : 'high'}`}>
              {confidence}
            </span>
          </div>
        ))}
      </section>
      <section className="resultsection">
        <span className="label">First recommendation</span>
        <h3>Test the market before committing to a full reskilling path.</h3>
        <p>
          Compare 15–20 current postings across the first two paths and validate which
          requirements your existing evidence already demonstrates.
        </p>
      </section>
    </PreviewBase>
  );
};

