import React, { useEffect, useState } from 'react';
import { FileDropZone } from '../../components/FileDropZone';
import { DashboardShell } from '../../components/DashboardShell';
import { Progress } from '../../components/layout';
import { getClarityUserId } from '../../lib/clarityUserId';
import { setJobUploadFile } from '../../lib/jobUploadFile';
import {
  fetchJobAnalysis,
  listJobAnalyses,
  type JobAnalysisSummary,
} from '../../services/jobAnalyzer/api';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { JobSource } from '../../types';
import { runJobAnalysis } from './runJobAnalysis';

interface JobWorkspaceShellProps {
  label: string;
  children: React.ReactNode;
}

const JobWorkspaceShell: React.FC<JobWorkspaceShellProps> = ({ label, children }) => (
  <DashboardShell title="Job Analyzer" subtitle={label} activeNav="job">
    {children}
  </DashboardShell>
);

const NEW_JOB_SOURCES: Array<[JobSource, string, string]> = [
  ['url', 'Job URL', 'Use a public, accessible posting'],
  ['paste', 'Paste description', 'Best when a URL blocks access'],
  ['upload', 'Upload document', 'PDF, DOCX or TXT'],
];

const SavedAnalysesLink: React.FC = () => {
  const { navigate } = useClarity();
  return (
    <a
      className="textlink"
      href="#job-workspace-history"
      onClick={(event) => {
        event.preventDefault();
        navigate('job-workspace-history');
      }}
    >
      View saved analyses →
    </a>
  );
};

export const JobWorkspaceEmptyView: React.FC = () => {
  const { navigate, patch } = useClarity();

  useEffect(() => {
    patch({ jobHasAnalyses: false });
  }, [patch]);

  const openNew = (event: React.MouseEvent) => {
    event.preventDefault();
    navigate('job-workspace-new');
  };

  return (
    <JobWorkspaceShell label="Saved analyses">
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Job Analyzer</div>
          <h1>Understand what a role is really asking for.</h1>
          <p>
            Analyze complete job postings, review likely hidden expectations and keep every
            result in one workspace.
          </p>
        </div>
        <a className="btn primary" href="#job-workspace-new" onClick={openNew}>
          New job analysis →
        </a>
      </div>
      <section
        className="flowPanel"
        style={{
          minHeight: 390,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <span className="featureIcon" style={{ margin: 'auto' }}>
            ⌕
          </span>
          <h2>No job analyses yet</h2>
          <p className="lead" style={{ fontSize: 16 }}>
            Add a job URL, paste a complete description or upload the posting. Your saved
            analyses will appear here.
          </p>
          <a className="btn primary" href="#job-workspace-new" onClick={openNew}>
            Analyze my first job →
          </a>
        </div>
      </section>
    </JobWorkspaceShell>
  );
};

export const JobWorkspaceHistoryView: React.FC = () => {
  const { navigate, patch, toast } = useClarity();
  const [rows, setRows] = useState<JobAnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const analyses = await listJobAnalyses(getClarityUserId());
        if (cancelled) return;
        if (analyses.length === 0) {
          patch({ jobHasAnalyses: false });
          navigate('job-workspace-empty');
          return;
        }
        setRows(analyses);
        patch({ jobHasAnalyses: true });
      } catch (error) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : 'Could not load analyses');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate, patch, toast]);

  const openAnalysis = async (analysisId: string) => {
    try {
      const record = await fetchJobAnalysis(getClarityUserId(), analysisId);
      patch({
        job: {
          title: record.title,
          company: record.company,
          location: record.location,
        },
        jobLiveAnalysis: {
          analysisId: record.analysisId,
          result: record.result,
          metadata: record.metadata,
          saved: true,
        },
        jobHasAnalyses: true,
      });
      navigate('job-workspace-result');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not open analysis');
    }
  };

  return (
    <JobWorkspaceShell label="Saved analyses">
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Job Analyzer</div>
          <h1>Your job analyses</h1>
          <p>
            Open a previous result or analyze another opportunity using the same trusted
            flow.
          </p>
        </div>
        <a
          className="btn primary"
          href="#job-workspace-new"
          onClick={(event) => {
            event.preventDefault();
            navigate('job-workspace-new');
          }}
        >
          New job analysis →
        </a>
      </div>
      <section className="flowPanel">
        {loading ? (
          <p>Loading saved analyses…</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map((row) => (
              <div key={row.analysisId} className="recentRow">
                <div>
                  <b>{row.title}</b>
                  <p>
                    {row.company || 'Company'} · {row.location || 'Location'} ·{' '}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="pill high">
                  {row.hiddenExpectationCount} hidden expectation
                  {row.hiddenExpectationCount === 1 ? '' : 's'}
                </span>
                <a
                  href="#job-workspace-result"
                  onClick={(event) => {
                    event.preventDefault();
                    void openAnalysis(row.analysisId);
                  }}
                >
                  Open →
                </a>
              </div>
            ))}
          </div>
        )}
      </section>
    </JobWorkspaceShell>
  );
};

export const JobWorkspaceNewView: React.FC = () => {
  const { state, setJobSource, navigate, patch, toast } = useClarity();

  return (
    <JobWorkspaceShell label="New analysis">
      <Progress active={0} />
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Job Analyzer</div>
          <h1>What opportunity are you considering?</h1>
          <p>
            Provide the complete posting. Clarity Coach will not invent a job from a title
            alone.
          </p>
        </div>
        <SavedAnalysesLink />
      </div>
      <section className="flowPanel">
        <div className="choicegrid">
          {NEW_JOB_SOURCES.map(([key, title, hint]) => (
            <button
              key={key}
              type="button"
              className={`choice ${state.jobSource === key ? 'active' : ''}`}
              onClick={() => setJobSource(key)}
            >
              <b>{title}</b>
              <small>{hint}</small>
            </button>
          ))}
        </div>
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
              emptyLabel="Drop a file here or browse"
              hint="PDF, DOCX or TXT · maximum 10 MB · images are not supported"
              selectedName={state.jobUploadFileName}
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
              style={{ minHeight: 190 }}
              value={state.jobPostingText}
              onChange={(event) => patch({ jobPostingText: event.target.value })}
            />
          </div>
        )}
        <div className="flowActions">
          <a
            className="btn secondary"
            href="#job-workspace-history"
            onClick={(event) => {
              event.preventDefault();
              navigate(state.jobHasAnalyses ? 'job-workspace-history' : 'job-workspace-empty');
            }}
          >
            Cancel
          </a>
          <a
            className="btn primary"
            href="#job-workspace-review"
            onClick={(event) => {
              event.preventDefault();
              if (state.jobSource === 'paste' && state.jobPostingText.trim().length < 40) {
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
              navigate('job-workspace-review');
            }}
          >
            Review job details →
          </a>
        </div>
      </section>
    </JobWorkspaceShell>
  );
};

export const JobWorkspaceReviewView: React.FC = () => {
  const { state, navigate, patch, toast } = useClarity();
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    setBusy(true);
    const result = await runJobAnalysis({
      source: state.jobSource,
      postingText: state.jobPostingText,
      url: state.jobUrl,
      job: state.job,
      registered: true,
    });
    setBusy(false);

    if (result.ok && !result.fromFixtures && result.analysis) {
      patch({
        jobLiveAnalysis: result.analysis,
        jobLiveError: null,
        jobHasAnalyses: true,
      });
      navigate('job-workspace-result');
      return;
    }
    if (result.ok) {
      patch({ jobLiveError: null, jobHasAnalyses: true });
      navigate('job-workspace-result');
      return;
    }
    toast(result.error);
    patch({ jobLiveError: result.error });
  };

  return (
    <JobWorkspaceShell label="Review">
      <Progress active={1} />
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Job Analyzer</div>
          <h1>Review what we found in the posting.</h1>
          <p>
            Correct the role details before analysis. Nothing is added to your Career
            Profile.
          </p>
        </div>
        <SavedAnalysesLink />
      </div>
      <section className="flowPanel">
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
            <label>
              Location <small>Optional</small>
            </label>
            <input
              className="input"
              value={state.job.location}
              onChange={(event) =>
                patch({ job: { ...state.job, location: event.target.value } })
              }
            />
          </div>
        </div>
        <div className="flowActions">
          <a
            className="btn secondary"
            href="#job-workspace-new"
            onClick={(event) => {
              event.preventDefault();
              navigate('job-workspace-new');
            }}
          >
            ← Back
          </a>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void analyze()}
          >
            {busy ? 'Analyzing…' : 'Analyze this job →'}
          </button>
        </div>
      </section>
    </JobWorkspaceShell>
  );
};

export const JobWorkspaceResultView: React.FC = () => {
  const { state, navigate, patch } = useClarity();
  const live = state.jobLiveAnalysis?.result;
  const required = live?.statedRequirements.filter((r) => r.category === 'required') ?? [];
  const preferred = live?.statedRequirements.filter((r) => r.category === 'preferred') ?? [];
  const hidden = live?.hiddenExpectations ?? [];

  const openSkillsMatch = () => {
    // Skills Match backend is out of scope — navigation stub only.
    if (!state.registered) {
      patch({
        pendingGuest: 'job',
        postAuthRoute: 'skills-match',
        entryPoint: 'guest-job',
      });
      navigate('signup-job');
      return;
    }
    navigate('skills-match');
  };

  return (
    <JobWorkspaceShell label="Analysis result">
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Complete job analysis</div>
          <h1>What this role is really asking for</h1>
          <p>
            {state.job.title} · {state.job.company}
          </p>
        </div>
        <div className="actions">
          <a
            className="btn secondary"
            href="#job-workspace-history"
            onClick={(event) => {
              event.preventDefault();
              navigate('job-workspace-history');
            }}
          >
            All analyses
          </a>
          <a
            className="btn primary"
            href="#job-workspace-new"
            onClick={(event) => {
              event.preventDefault();
              navigate('job-workspace-new');
            }}
          >
            New job analysis →
          </a>
        </div>
      </div>
      <section className="fullresult">
        <div className="fullgrid">
          <div>
            {(required.length ? required : [{ title: 'Strategy, delivery and measurable outcomes', summary: 'Own the roadmap, align multiple functions and connect decisions to performance.' }]).map(
              (item) => (
                <div key={item.title} className="plainsection">
                  <span className="label">Required</span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                </div>
              ),
            )}
            {(preferred.length
              ? preferred
              : [
                  {
                    title: 'Regulated financial product experience',
                    summary:
                      'Domain language suggests a preference even where it is not written as mandatory.',
                  },
                ]
            ).map((item) => (
              <div key={item.title} className="plainsection">
                <span className="label">Preferred</span>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </div>
            ))}
          </div>
          <div>
            <div className="plainsection">
              <span className="label">Hidden expectations</span>
              {(hidden.length
                ? hidden
                : [
                    {
                      title: 'Stabilize delivery',
                      summary: 'High confidence · repeated cadence and dependency language.',
                      confidence: 'high' as const,
                      implication: '',
                      evidence: [],
                    },
                    {
                      title: 'Influence senior stakeholders',
                      summary: 'High confidence · decision and alignment language.',
                      confidence: 'high' as const,
                      implication: '',
                      evidence: [],
                    },
                    {
                      title: 'Improve measurement discipline',
                      summary: 'Medium confidence · recurring outcome language.',
                      confidence: 'medium' as const,
                      implication: '',
                      evidence: [],
                    },
                  ]
              ).map((item, index) => (
                <React.Fragment key={item.title}>
                  <h3>
                    {index + 1}. {item.title}
                  </h3>
                  <p>
                    {item.confidence
                      ? `${item.confidence.charAt(0).toUpperCase()}${item.confidence.slice(1)} confidence`
                      : 'Confidence'}
                    {' · '}
                    {item.summary}
                  </p>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="evidence">
          <b>Why these are inferences</b>
          <br />
          Hidden expectations are reasoned from repeated language and role context. They
          are not presented as facts from the employer.
          {live?.roleFocusSummary ? ` ${live.roleFocusSummary}` : ''}
        </div>
        <div className="formactions">
          <span className="privacy">
            A résumé is not required for job analysis. Add career evidence only when you
            choose to assess your match.
          </span>
          <button type="button" className="btn primary" onClick={openSkillsMatch}>
            Assess my skills match →
          </button>
        </div>
      </section>
    </JobWorkspaceShell>
  );
};
