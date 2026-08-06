import React, { useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { icon } from '../../consts';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { HomeMode, Tool } from '../../types';
import { JobWorkspaceHistoryView } from '../job-workspace';

const SWITCHER_MODES: Array<[HomeMode, string, string]> = [
  ['new', 'dashboard-new', 'New account'],
  ['returning-none', 'dashboard-returning-none', 'Returning · no work'],
  ['returning', 'dashboard-returning', 'Returning · unfinished'],
  ['returning-complete', 'dashboard-returning-complete', 'Returning · completed'],
];

const DashboardStateSwitcher: React.FC<{ mode: HomeMode }> = ({ mode }) => {
  const { navigate } = useClarity();
  return (
    <div className="sourceSwitch" style={{ marginBottom: 22 }}>
      {SWITCHER_MODES.map(([key, href, label]) => (
        <a
          key={key}
          className={mode === key ? 'active' : ''}
          href={`#${href}`}
          onClick={(event) => {
            event.preventDefault();
            navigate(href);
          }}
        >
          {label}
        </a>
      ))}
    </div>
  );
};

interface QuickCardProps {
  iconName: string;
  title: string;
  copy: string;
  action: string;
  target?: string;
  resetGuest?: boolean;
  onSelect?: () => void;
}

const QuickCard: React.FC<QuickCardProps> = ({
  iconName,
  title,
  copy,
  action,
  target,
  resetGuest,
  onSelect,
}) => {
  const { navigate, patch } = useClarity();
  return (
    <a
      className="quickCard"
      href={target ? `#${target}` : undefined}
      onClick={(event) => {
        event.preventDefault();
        if (resetGuest) patch({ pendingGuest: null, entryPoint: 'dashboard' });
        if (onSelect) onSelect();
        if (target) navigate(target);
      }}
    >
      <span>{icon(iconName)}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <b>{action}</b>
    </a>
  );
};

const ProfilePromptCard: React.FC<{ copy: string }> = ({ copy }) => {
  const { navigate, prepareCareerProfile } = useClarity();
  return (
    <section className="profilePrompt">
      <span className="profileRing">0%</span>
      <div>
        <h3>Your Career Profile</h3>
        <p>{copy}</p>
      </div>
      <a
        className="btn secondary"
        href="#career-profile"
        onClick={(event) => {
          event.preventDefault();
          prepareCareerProfile('profile');
          navigate('career-profile');
        }}
      >
        Start Career Profile →
      </a>
    </section>
  );
};

const ContinuePivotLink: React.FC<{
  className: string;
  children: React.ReactNode;
}> = ({ className, children }) => {
  const { navigate, prepareCareerProfile } = useClarity();
  return (
    <a
      className={className}
      href="#career-profile"
      onClick={(event) => {
        event.preventDefault();
        prepareCareerProfile('pivot');
        navigate('career-profile');
      }}
    >
      {children}
    </a>
  );
};

const NewAccountHome: React.FC = () => {
  const { navigate } = useClarity();
  return (
    <>
      <div className="welcomeRow">
        <div>
          <div className="eyebrow">Welcome to Clarity Coach</div>
          <h1>What would you like clarity on first?</h1>
          <p>
            Choose one starting point. You can build your profile when more detail will
            improve the result.
          </p>
        </div>
        <span className="welcomeDate">Your new workspace</span>
      </div>
      <section className="newStart">
        <div>
          <div className="eyebrow">A simple place to begin</div>
          <h2>Start with the question that matters today.</h2>
          <p>
            Try Career Pivot, Job Analyzer or Market Report. Your work will stay connected
            as your profile grows.
          </p>
        </div>
        <a
          className="btn primary"
          href="#prototype-new-account-2"
          onClick={(event) => {
            event.preventDefault();
            navigate('prototype-new-account-2');
          }}
        >
          Explore Career Pivot →
        </a>
      </section>
      <div className="homeSectionHead">
        <div>
          <h2>Choose a starting point</h2>
          <p>Each tool gives you a practical result and a clear next step.</p>
        </div>
      </div>
      <div className="quickGrid">
        <QuickCard
          iconName="pivot"
          title="Explore a Career Pivot"
          copy="Compare realistic paths that build on your transferable skills."
          action="Start Career Pivot →"
          target="prototype-new-account-2"
        />
        <QuickCard
          iconName="job"
          title="Analyze a Job"
          copy="Decode stated requirements and likely hidden expectations."
          action="Open Job Analyzer →"
          target="dashboard-job"
          resetGuest
        />
        <QuickCard
          iconName="market"
          title="Check My Market"
          copy="Understand demand, skill signals and location context."
          action="Open Market Report →"
          target="dashboard-market"
          resetGuest
        />
      </div>
      <ProfilePromptCard copy="Add your work history and skills now, or wait until a tool needs them." />
    </>
  );
};

const UnfinishedHome: React.FC = () => {
  const { navigate, toast } = useClarity();
  return (
    <>
      <div className="welcomeRow">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1>Let’s pick up where you stopped.</h1>
          <p>
            Your saved work is ready. Continue the most recent task or choose another tool.
          </p>
        </div>
        <span className="welcomeDate">Last active today</span>
      </div>
      <section className="resumeCard">
        <span className="resumeIcon">{icon('pivot')}</span>
        <div>
          <div className="eyebrow">Continue where you stopped</div>
          <h2>Complete your Career Pivot comparison</h2>
          <p>
            You already reviewed three initial paths. Add career evidence to validate the
            fit, identify priority gaps and build your personalized action plan.
          </p>
          <div className="resumeMeta">
            <span>Initial paths complete</span>
            <span className="resumeProgress">
              <i />
            </span>
            <span>Next: Career Profile</span>
          </div>
        </div>
        <ContinuePivotLink className="btn primary">
          Continue Career Pivot →
        </ContinuePivotLink>
      </section>
      <section className="progressPanel">
        <div className="progressPanelHead">
          <div>
            <div className="eyebrow">Your progress</div>
            <h2>Career Profile</h2>
            <p>
              Complete the missing evidence to strengthen your saved Career Pivot result.
            </p>
          </div>
          <div className="progressValue">
            <strong>35%</strong>
            <span>complete</span>
          </div>
        </div>
        <div className="profileTrack">
          <i />
        </div>
        <div className="profileChecklist">
          <div className="profileCheck done">
            <b>✓ Career direction added</b>Your pivot goal and situation are saved.
          </div>
          <div className="profileCheck">
            <b>Add career evidence</b>Use LinkedIn, résumé upload or manual entry.
          </div>
          <div className="profileCheck">
            <b>Confirm strengths and outcomes</b>Review the evidence before it powers your
            result.
          </div>
        </div>
      </section>
      <section className="recommendPanel">
        <div>
          <div className="eyebrow">Recommended next step</div>
          <h3>Add your career evidence</h3>
          <p>
            This unlocks evidence-based path scores, priority gaps and your personalized
            action plan.
          </p>
        </div>
        <ContinuePivotLink className="btn secondary">Continue profile →</ContinuePivotLink>
      </section>
      <div className="homeSectionHead">
        <div>
          <h2>Quick actions</h2>
          <p>Start another task without losing your current progress.</p>
        </div>
      </div>
      <div className="quickGrid">
        <QuickCard
          iconName="pivot"
          title="Career Pivot"
          copy="Start a new pivot exploration without changing your saved one."
          action="Explore another pivot →"
          target="prototype-new-account-2"
        />
        <QuickCard
          iconName="job"
          title="Job Analyzer"
          copy="Understand what a role is really asking for."
          action="Analyze a job →"
          target="dashboard-job"
          resetGuest
        />
        <QuickCard
          iconName="market"
          title="Market Report"
          copy="Review demand and rising skill signals."
          action="Check my market →"
          target="dashboard-market"
          resetGuest
        />
        <QuickCard
          iconName="skills"
          title="Skills Match"
          copy="Compare your evidence with a specific role."
          action="Assess my match →"
          onSelect={() => toast('Skills Match opens with your saved profile evidence')}
        />
      </div>
      <div className="homeSectionHead">
        <div>
          <h2>Recent work</h2>
          <p>Your latest saved career activity.</p>
        </div>
        <a className="textlink">View all</a>
      </div>
      <section className="recentPanel">
        <div className="recentRow">
          <div>
            <b>Career Pivot exploration</b>
            <p>Three initial paths saved · Updated today</p>
          </div>
          <span className="pill medium">Profile needed</span>
          <ContinuePivotLink className="">Continue →</ContinuePivotLink>
        </div>
        <div className="recentRow">
          <div>
            <b>Senior Product Manager analysis</b>
            <p>Hidden expectations identified · Updated yesterday</p>
          </div>
          <span className="pill high">Complete</span>
          <a
            href="#dashboard-job"
            onClick={(event) => {
              event.preventDefault();
              navigate('dashboard-job');
            }}
          >
            Open →
          </a>
        </div>
      </section>
    </>
  );
};

const CompletedHome: React.FC = () => {
  const { navigate } = useClarity();
  return (
    <>
      <div className="welcomeRow">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1>Your latest career work is ready.</h1>
          <p>Review a completed result or start a new question.</p>
        </div>
        <span className="welcomeDate">Updated today</span>
      </div>
      <section className="resumeCard">
        <span className="resumeIcon">{icon('pivot')}</span>
        <div>
          <div className="eyebrow">Latest completed work</div>
          <h2>Career Pivot action plan</h2>
          <p>
            Your three paths, evidence-based comparison and 30-day action plan are
            complete.
          </p>
        </div>
        <a
          className="btn primary"
          href="#prototype-new-account-8"
          onClick={(event) => {
            event.preventDefault();
            navigate('prototype-new-account-8');
          }}
        >
          Open action plan →
        </a>
      </section>
      <section className="progressPanel">
        <div className="progressPanelHead">
          <div>
            <div className="eyebrow">Career Profile</div>
            <h2>Your evidence is complete</h2>
            <p>
              Your confirmed experience and skills can be reused across every assessment.
            </p>
          </div>
          <div className="progressValue">
            <strong>100%</strong>
            <span>complete</span>
          </div>
        </div>
        <div className="profileTrack">
          <i style={{ width: '100%' }} />
        </div>
      </section>
      <div className="homeSectionHead">
        <div>
          <h2>Start something new</h2>
          <p>Your completed work remains saved.</p>
        </div>
      </div>
      <div className="quickGrid">
        <QuickCard
          iconName="pivot"
          title="Career Pivot"
          copy="Explore another direction using your completed profile."
          action="Start a new pivot →"
          target="prototype-new-account-2"
        />
        <QuickCard
          iconName="job"
          title="Job Analyzer"
          copy="Analyze a new posting."
          action="Analyze a job →"
          target="dashboard-job"
          resetGuest
        />
        <QuickCard
          iconName="skills"
          title="Skills Match"
          copy="Compare your completed profile with a role."
          action="Assess my match →"
          target="skills-match"
        />
        <QuickCard
          iconName="market"
          title="Market Report"
          copy="Check a role and location."
          action="Check my market →"
          target="dashboard-market"
          resetGuest
        />
      </div>
    </>
  );
};

const NoWorkHome: React.FC = () => (
  <>
    <div className="welcomeRow">
      <div>
        <div className="eyebrow">Welcome back</div>
        <h1>What would you like clarity on today?</h1>
        <p>
          You do not have saved work yet. Choose a tool or begin your Career Profile.
        </p>
      </div>
      <span className="welcomeDate">No saved activity</span>
    </div>
    <div className="quickGrid">
      <QuickCard
        iconName="pivot"
        title="Career Pivot"
        copy="Find three realistic paths without starting over."
        action="Explore career paths →"
        target="prototype-new-account-2"
      />
      <QuickCard
        iconName="job"
        title="Job Analyzer"
        copy="Decode a job description and hidden expectations."
        action="Analyze a job →"
        target="dashboard-job"
        resetGuest
      />
      <QuickCard
        iconName="market"
        title="Market Report"
        copy="Understand demand by role, level and location."
        action="Check my market →"
        target="dashboard-market"
        resetGuest
      />
    </div>
    <ProfilePromptCard copy="No evidence has been added. Start now or wait until a tool needs personalization." />
  </>
);

export const HomeView: React.FC<{ mode: HomeMode }> = ({ mode }) => {
  const { state, patch } = useClarity();

  useEffect(() => {
    if (mode === 'returning-complete') {
      patch({ workState: 'completed', profileComplete: true });
      return;
    }
    if (mode === 'returning-none') {
      patch({ workState: 'none' });
    }
  }, [mode, patch]);

  const isNew = mode === 'new';
  const subtitle =
    mode === 'returning-complete'
      ? 'Completed work and next actions'
      : mode === 'returning'
        ? 'Your progress at a glance'
        : 'Your career workspace';

  const profilePct =
    mode === 'returning-complete'
      ? '100'
      : mode === 'returning-none'
        ? '0'
        : state.profileComplete
          ? '100'
          : isNew
            ? '0'
            : '35';

  return (
    <DashboardShell
      title="Home"
      subtitle={subtitle}
      activeNav="home"
      bodyClassName="homebody"
      profilePct={profilePct}
    >
      <DashboardStateSwitcher mode={mode} />
      {mode === 'new' ? (
        <NewAccountHome />
      ) : mode === 'returning-complete' ? (
        <CompletedHome />
      ) : mode === 'returning-none' ? (
        <NoWorkHome />
      ) : (
        <UnfinishedHome />
      )}
    </DashboardShell>
  );
};

const PIVOT_RESULTS: Array<[string, string, string]> = [
  [
    'Payments Platform Product Lead',
    '86',
    'Use existing payment infrastructure and product leadership evidence.',
  ],
  [
    'Fintech Solutions Consultant',
    '79',
    'Reframe platform implementation and stakeholder work as advisory evidence.',
  ],
  ['Product Operations Lead', '68', 'Build clearer operating-model and portfolio evidence.'],
];

const RestoredPivotResult: React.FC = () => {
  const { navigate, prepareCareerProfile } = useClarity();
  return (
    <>
      <div className="context">
        <div>
          <b>Guest pivot preview restored</b>
          <p>Your three candidate paths are now saved.</p>
        </div>
        <span className="pill high">Saved to your account</span>
      </div>
      <section className="fullresult">
        <div className="eyebrow">Career Pivot Accelerator</div>
        <h2>Your strongest transition paths</h2>
        {PIVOT_RESULTS.map(([name, score, copy]) => (
          <div key={name} className="pivotrow">
            <span
              className="score"
              style={{ width: 48, height: 48, borderWidth: 5, fontSize: 14 }}
            >
              {score}
            </span>
            <div>
              <h3>{name}</h3>
              <p>{copy}</p>
            </div>
            <span className={`pill ${Number(score) > 75 ? 'high' : 'medium'}`}>
              Transferability
            </span>
          </div>
        ))}
        <div className="formactions">
          <span className="privacy">
            Add a résumé, LinkedIn profile or manual career evidence to generate the
            complete 30/60/90-day plan.
          </span>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              prepareCareerProfile('pivot');
              navigate('career-profile');
            }}
          >
            Strengthen profile and build my plan →
          </button>
        </div>
      </section>
    </>
  );
};

/** Market Report is served by its own workspace routes, so only job and pivot arrive here. */
export const DashboardToolView: React.FC<{ tool: Exclude<Tool, 'market'> }> = ({
  tool,
}) => {
  if (tool === 'job') return <JobWorkspaceHistoryView />;

  return (
    <DashboardShell title="Career Pivot" subtitle="Your workspace" activeNav="pivot">
      <RestoredPivotResult />
    </DashboardShell>
  );
};

export const SkillsMatchView: React.FC = () => {
  const { state, navigate, prepareCareerProfile, toast } = useClarity();
  const ready = state.profileComplete;

  return (
    <DashboardShell
      title="Skills Match"
      subtitle="Match assessment"
      activeNav="skills"
      profilePct={ready ? '100' : state.manualExperienceSaved ? '35' : '0'}
    >
      {ready ? (
        <>
          <div className="flowHeader">
            <div>
              <div className="eyebrow">Skills Match</div>
              <h1>Compare your evidence with a target role.</h1>
              <p>Your completed Career Profile will be used for the assessment.</p>
            </div>
          </div>
          <section className="flowPanel">
            <div className="field">
              <label>
                Target job description or role <small>Required</small>
              </label>
              <textarea
                className="input"
                style={{ minHeight: 150 }}
                placeholder="Paste a job description or describe the target role…"
              />
            </div>
            <div className="flowActions">
              <span className="privacy">Career Profile 100% · ready to use</span>
              <button
                type="button"
                className="btn primary"
                onClick={() => toast('Skills Match assessment generated')}
              >
                Assess my match →
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="flowHeader">
            <div>
              <div className="eyebrow">Skills Match</div>
              <h1>Add career evidence before assessing your match.</h1>
              <p>
                Skills Match needs both a target role and confirmed evidence from your
                Career Profile.
              </p>
            </div>
          </div>
          <section className="flowPanel">
            <div className="profileMeter">
              <strong>{state.manualExperienceSaved ? '35' : '0'}%</strong>
              <div>
                <b>Career Profile required</b>
                <p>
                  Add LinkedIn, a résumé or manual work history. Your Skills Match will
                  remain open.
                </p>
              </div>
            </div>
            <div className="flowActions">
              <a
                className="btn secondary"
                href="#dashboard-home"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('dashboard-home');
                }}
              >
                Return Home
              </a>
              <a
                className="btn primary"
                href="#career-profile"
                onClick={(event) => {
                  event.preventDefault();
                  prepareCareerProfile('skills');
                  navigate('career-profile');
                }}
              >
                Build Career Profile →
              </a>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
};
