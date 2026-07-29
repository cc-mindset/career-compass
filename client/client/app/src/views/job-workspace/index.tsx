import React from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { Progress } from '../../components/layout';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { JobSource } from '../../types';

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
  const { navigate } = useClarity();
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

interface HistoryRow {
  title: string;
  meta: string;
  pill: string;
  pillTone: 'high' | 'medium';
  action: string;
  target: string;
}

const HISTORY_ROWS: HistoryRow[] = [
  {
    title: 'Senior Product Manager',
    meta: 'Northstar Financial · Toronto, Canada · Updated today',
    pill: 'Analysis complete',
    pillTone: 'high',
    action: 'Open →',
    target: 'job-workspace-result',
  },
  {
    title: 'Product Lead',
    meta: 'FintechCo · Remote — Canada · Updated July 20',
    pill: '82% Skills Match',
    pillTone: 'high',
    action: 'Open →',
    target: 'job-workspace-result',
  },
  {
    title: 'Platform Product Manager',
    meta: 'Acme Platforms · Toronto, Canada · Updated July 18',
    pill: 'Draft',
    pillTone: 'medium',
    action: 'Continue →',
    target: 'job-workspace-review',
  },
];

export const JobWorkspaceHistoryView: React.FC = () => {
  const { navigate } = useClarity();

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
        <div
          className="split"
          style={{ gridTemplateColumns: '1fr 220px', marginBottom: 18 }}
        >
          <input className="input" placeholder="Search by job title or company" />
          <select className="input" defaultValue="All statuses">
            <option>All statuses</option>
            <option>Complete</option>
            <option>Match assessed</option>
            <option>Draft</option>
          </select>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {HISTORY_ROWS.map((row) => (
            <div key={row.title} className="recentRow">
              <div>
                <b>{row.title}</b>
                <p>{row.meta}</p>
              </div>
              <span className={`pill ${row.pillTone}`}>{row.pill}</span>
              <a
                href={`#${row.target}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(row.target);
                }}
              >
                {row.action}
              </a>
            </div>
          ))}
        </div>
      </section>
    </JobWorkspaceShell>
  );
};

export const JobWorkspaceNewView: React.FC = () => {
  const { state, setJobSource, navigate, toast } = useClarity();

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
              defaultValue="https://example.com/jobs/senior-product-manager"
            />
          </div>
        ) : state.jobSource === 'upload' ? (
          <div className="field">
            <label>
              Job description file <small>Required</small>
            </label>
            <div
              className="input"
              style={{
                minHeight: 135,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
              }}
            >
              <div>
                <b>Drop a file here or browse</b>
                <br />
                <small>PDF, DOCX or TXT · maximum 10 MB</small>
                <br />
                <button
                  type="button"
                  className="btn secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => toast('File selected for prototype')}
                >
                  Choose file
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="field">
            <label>
              Complete job description <small>Required</small>
            </label>
            <textarea
              className="input"
              style={{ minHeight: 190 }}
              defaultValue="We are seeking a Senior Product Manager to own product strategy, align cross-functional teams, improve delivery cadence and deliver measurable customer and commercial outcomes in a regulated financial environment."
            />
          </div>
        )}
        <div className="flowActions">
          <a
            className="btn secondary"
            href="#job-workspace-history"
            onClick={(event) => {
              event.preventDefault();
              navigate('job-workspace-history');
            }}
          >
            Cancel
          </a>
          <a
            className="btn primary"
            href="#job-workspace-review"
            onClick={(event) => {
              event.preventDefault();
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
  const { state, navigate } = useClarity();

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
            <input className="input" defaultValue={state.job.title} />
          </div>
          <div className="field">
            <label>
              Company <small>Optional</small>
            </label>
            <input className="input" defaultValue={state.job.company} />
          </div>
          <div className="field">
            <label>
              Location <small>Optional</small>
            </label>
            <input className="input" defaultValue={state.job.location} />
          </div>
          <div className="field">
            <label>
              Work arrangement <small>Optional</small>
            </label>
            <select className="input" defaultValue="Hybrid">
              <option>Hybrid</option>
              <option>Remote</option>
              <option>On-site</option>
            </select>
          </div>
        </div>
        <div className="evidence">
          <b>Posting quality: Good</b>
          <br />
          The description contains enough responsibility, outcome and context language for
          a useful analysis. Clarity Coach will distinguish explicit requirements from
          inferred expectations.
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
          <a
            className="btn primary"
            href="#job-workspace-result"
            onClick={(event) => {
              event.preventDefault();
              navigate('job-workspace-result');
            }}
          >
            Analyze this job →
          </a>
        </div>
      </section>
    </JobWorkspaceShell>
  );
};

export const JobWorkspaceResultView: React.FC = () => {
  const { navigate } = useClarity();

  return (
    <JobWorkspaceShell label="Analysis result">
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Complete job analysis</div>
          <h1>What this role is really asking for</h1>
          <p>Senior Product Manager · Northstar Financial</p>
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
            <div className="plainsection">
              <span className="label">Required</span>
              <h3>Strategy, delivery and measurable outcomes</h3>
              <p>
                Own the roadmap, align multiple functions and connect decisions to
                performance.
              </p>
            </div>
            <div className="plainsection">
              <span className="label">Preferred</span>
              <h3>Regulated financial product experience</h3>
              <p>
                Domain language suggests a preference even where it is not written as
                mandatory.
              </p>
            </div>
          </div>
          <div>
            <div className="plainsection">
              <span className="label">Hidden expectations</span>
              <h3>1. Stabilize delivery</h3>
              <p>High confidence · repeated cadence and dependency language.</p>
              <h3>2. Influence senior stakeholders</h3>
              <p>High confidence · decision and alignment language.</p>
              <h3>3. Improve measurement discipline</h3>
              <p>Medium confidence · recurring outcome language.</p>
            </div>
          </div>
        </div>
        <div className="evidence">
          <b>Why these are inferences</b>
          <br />
          Hidden expectations are reasoned from repeated language and role context. They
          are not presented as facts from the employer.
        </div>
        <div className="formactions">
          <span className="privacy">
            A résumé is not required for job analysis. Add career evidence only when you
            choose to assess your match.
          </span>
          <a
            className="btn primary"
            href="#skills-match"
            onClick={(event) => {
              event.preventDefault();
              navigate('skills-match');
            }}
          >
            Assess my skills match →
          </a>
        </div>
      </section>
    </JobWorkspaceShell>
  );
};
