import React, { useEffect, useState } from 'react';
import { DashboardShell, type DashNav } from '../../components/DashboardShell';
import { FileDropZone } from '../../components/FileDropZone';
import { SelectField } from '../../components/forms';
import { SkillPicker } from '../../components/SkillPicker';
import {
  icon,
  INDUSTRY_OPTIONS,
  LOCATION_OPTIONS,
  ROLE_OPTIONS,
  selectOptions,
} from '../../consts';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { ProfileSource } from '../../types';
import { PIVOT_GOALS } from '../guest';

const STEP_LABELS = [
  'New Account Home',
  'Pivot Inputs',
  'Initial Pivot Result',
  'Add Career Evidence',
  'Review Profile',
  'Profile Complete',
  'Personalize Plan',
  'Full Pivot Plan',
];

const STEP_TITLES: Record<'home' | 'pivot' | 'profile', string> = {
  home: 'Home',
  pivot: 'Career Pivot',
  profile: 'Career Profile',
};

const CHALLENGES: Array<[string, string]> = [
  ['layoff', 'Recently laid off'],
  ['risk', 'Concerned about layoffs'],
  ['stuck', 'Feeling stuck'],
  ['career-change', 'Ready for a change'],
  ['disruption', 'Industry is changing'],
  ['growth', 'Seeking growth'],
];

const STEP_SENIORITY = [
  'Senior',
  'Mid-level',
  'Lead / Manager',
  'Director',
  'Executive',
];

const EVIDENCE_SOURCES: Array<[ProfileSource, string, string, string]> = [
  [
    'linkedin',
    'in',
    'LinkedIn profile',
    'Enter your public profile URL and retrieve available records.',
  ],
  ['resume', '⇧', 'Upload résumé', 'Upload PDF or DOCX and extract your experience.'],
  [
    'manual',
    '✎',
    'Enter details manually',
    'Add your role, experience, skills and outcomes yourself.',
  ],
];

interface StepShellProps {
  step: number;
  active: 'home' | 'pivot' | 'profile';
  profilePct: string;
  children: React.ReactNode;
}

const StepShell: React.FC<StepShellProps> = ({ step, active, profilePct, children }) => {
  const activeNav: DashNav = active;
  return (
    <DashboardShell
      title={STEP_TITLES[active]}
      subtitle={`Prototype New Account · Step ${step} of 8 · ${STEP_LABELS[step - 1]}`}
      subtitleClassName="flowStep"
      activeNav={activeNav}
      bodyClassName="homebody"
      profilePct={profilePct}
      headActions={<span className="prototypeFlag">Prototype New Account</span>}
    >
      {children}
    </DashboardShell>
  );
};

const StepLink: React.FC<{
  className: string;
  target: string;
  children: React.ReactNode;
  onSelect?: () => void;
}> = ({ className, target, children, onSelect }) => {
  const { navigate } = useClarity();
  return (
    <a
      className={className}
      href={`#${target}`}
      onClick={(event) => {
        event.preventDefault();
        if (onSelect) onSelect();
        navigate(target);
      }}
    >
      {children}
    </a>
  );
};

const StepOneHome: React.FC = () => {
  const { navigate, prepareCareerProfile } = useClarity();
  return (
    <>
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Welcome to Clarity Coach</div>
          <h1>What would you like clarity on first?</h1>
          <p>
            Choose a starting point. Clarity Coach will ask for your career profile only
            when it is needed for a reliable result.
          </p>
        </div>
        <span className="welcomeDate">New workspace</span>
      </div>
      <section className="newStart">
        <div>
          <div className="eyebrow">Recommended start</div>
          <h2>Explore realistic career paths</h2>
          <p>
            See which roles build on your experience and what you would need to make the
            move.
          </p>
        </div>
        <StepLink className="btn primary" target="prototype-new-account-2">
          Start Career Pivot →
        </StepLink>
      </section>
      <div className="homeSectionHead">
        <div>
          <h2>Quick actions</h2>
          <p>Start with the question that matters today.</p>
        </div>
      </div>
      <div className="quickGrid">
        <a
          className="quickCard"
          href="#job-workspace-new"
          onClick={(event) => {
            event.preventDefault();
            navigate('job-workspace-new');
          }}
        >
          <span>{icon('job')}</span>
          <h3>Job Analyzer</h3>
          <p>Decode stated requirements and likely hidden expectations.</p>
          <b>Analyze a job →</b>
        </a>
        <a className="quickCard">
          <span>{icon('skills')}</span>
          <h3>Skills Match</h3>
          <p>Compare your evidence with a specific role.</p>
          <b>Assess my match →</b>
        </a>
        <a
          className="quickCard"
          href="#dashboard-market"
          onClick={(event) => {
            event.preventDefault();
            navigate('dashboard-market');
          }}
        >
          <span>{icon('market')}</span>
          <h3>Market Report</h3>
          <p>Understand demand, seniority and location signals.</p>
          <b>Check my market →</b>
        </a>
      </div>
      <section className="profilePrompt">
        <span className="profileRing">0%</span>
        <div>
          <h3>Your career profile</h3>
          <p>
            No career evidence added yet. Build it now or wait until a tool needs deeper
            personalization.
          </p>
        </div>
        <StepLink
          className="btn secondary"
          target="career-profile"
          onSelect={() => prepareCareerProfile('profile')}
        >
          Start Career Profile →
        </StepLink>
      </section>
    </>
  );
};

const StepTwoPivotInput: React.FC = () => {
  const { state, patch } = useClarity();
  return (
    <>
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Career Pivot Accelerator</div>
          <h1>See which careers you can move into without starting over.</h1>
          <p>
            Start with the same short questions used in the free demo. No career profile is
            required for your first three options.
          </p>
        </div>
      </div>
      <section className="flowPanel">
        <div className="field">
          <label>
            Which best describes your situation? <small>Required</small>
          </label>
          <div className="chips">
            {CHALLENGES.map(([key, label]) => (
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
            options={STEP_SENIORITY}
            onChange={(experience) => patch({ pivot: { ...state.pivot, experience } })}
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
        <div className="flowActions">
          <span className="privacy">No résumé required.</span>
          <StepLink className="btn primary" target="prototype-new-account-3">
            Show my career options →
          </StepLink>
        </div>
      </section>
    </>
  );
};

interface PathCard {
  label: string;
  score: string;
  name: string;
  copy: string;
  top?: boolean;
}

const INITIAL_PATHS: PathCard[] = [
  {
    top: true,
    label: 'Strongest initial fit',
    score: 'High',
    name: 'Payments Platform Product Lead',
    copy: 'Builds on product strategy, payments knowledge and cross-functional delivery.',
  },
  {
    label: 'Strong adjacency',
    score: 'Good',
    name: 'Fintech Solutions Consultant',
    copy: 'Uses implementation, stakeholder and regulated-product experience.',
  },
  {
    label: 'Explore further',
    score: 'Fair',
    name: 'Product Operations Lead',
    copy: 'Transfers delivery coordination, analytics and operating-rhythm strengths.',
  },
];

const PathCardList: React.FC<{ paths: PathCard[] }> = ({ paths }) => (
  <div className="pathGrid">
    {paths.map((path) => (
      <div key={path.name} className={path.top ? 'pathCard top' : 'pathCard'}>
        <span className="label">{path.label}</span>
        <strong>{path.score}</strong>
        <h3>{path.name}</h3>
        <p>{path.copy}</p>
      </div>
    ))}
  </div>
);

const StepThreeInitialResult: React.FC = () => {
  const { prepareCareerProfile } = useClarity();
  return (
    <>
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Your first Career Pivot analysis</div>
          <h1>Three adjacent paths worth investigating.</h1>
          <p>
            This first result uses the information you just provided. You can review the
            paths before deciding whether to build a deeper personalized plan.
          </p>
        </div>
        <span className="pill medium">Profile not yet added</span>
      </div>
      <section className="flowPanel">
        <PathCardList paths={INITIAL_PATHS} />
      </section>
      <section className="flowPanel">
        <div className="eyebrow">What this preview can tell you</div>
        <div className="reviewList">
          <div className="reviewItem">
            <span>Included now</span>
            <b>Three initial paths and why each may fit</b>
            <span />
          </div>
          <div className="reviewItem">
            <span>Unlocked with profile</span>
            <b>
              Evidence-based match scores, priority gaps and personalized action plan
            </b>
            <span />
          </div>
        </div>
        <div className="flowActions">
          <StepLink className="btn secondary" target="prototype-new-account-2">
            Adjust my answers
          </StepLink>
          <StepLink
            className="btn primary"
            target="career-profile"
            onSelect={() => prepareCareerProfile('pivot')}
          >
            Strengthen my profile and build a plan →
          </StepLink>
        </div>
      </section>
    </>
  );
};

const StepFourEvidence: React.FC = () => {
  const { state, patch, toast } = useClarity();
  const source = state.profileSource;
  const [resumeName, setResumeName] = useState<string | null>(null);

  const inlineInput =
    source === 'resume' ? (
      <div className="field">
        <label>
          Upload your résumé <small>PDF or DOCX · Required</small>
        </label>
        <FileDropZone
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          emptyLabel="Drop your résumé here"
          hint="or click to choose a file · Maximum 10 MB · PDF or DOCX"
          selectedName={resumeName}
          onInvalid={(message) => toast(message)}
          onFile={(file) => {
            setResumeName(file.name);
            patch({ profileSource: 'resume' });
            toast(`Selected ${file.name}`);
          }}
        />
      </div>
    ) : source === 'manual' ? (
      <>
        <div className="split">
          <div className="field">
            <label>
              Current or recent role <small>Required</small>
            </label>
            <select className="input" defaultValue="Senior Product Manager">
              {selectOptions(ROLE_OPTIONS, 'Senior Product Manager').map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              Industry <small>Required</small>
            </label>
            <select className="input" defaultValue="Financial Services">
              {selectOptions(INDUSTRY_OPTIONS, 'Financial Services').map((industry) => (
                <option key={industry}>{industry}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>
              Years of experience <small>Required</small>
            </label>
            <select className="input" defaultValue="10–15 years">
              <option>10–15 years</option>
              <option>5–9 years</option>
              <option>15+ years</option>
            </select>
          </div>
          <div className="field">
            <label>
              Most recent employer <small>Optional</small>
            </label>
            <input className="input" placeholder="Enter employer name" />
          </div>
        </div>
        <div className="field">
          <label>
            Key skills and strengths <small>Required</small>
          </label>
          <input className="input" placeholder="Start typing your skills" />
        </div>
        <div className="field">
          <label>
            One measurable achievement <small>Required</small>
          </label>
          <textarea className="input" placeholder="Describe an outcome you helped achieve" />
        </div>
      </>
    ) : (
      <>
        <div className="field">
          <label>
            LinkedIn profile URL <small>Required</small>
          </label>
          <input
            className="input"
            type="url"
            placeholder="https://www.linkedin.com/in/your-profile"
          />
        </div>
        <div className="evidence">
          <b>What happens next</b>
          <br />
          Clarity Coach attempts to retrieve your available professional records and then
          shows them for review. If the profile cannot be accessed, you can select résumé
          upload or manual entry above.
        </div>
      </>
    );

  return (
    <>
      <div className="flowHeader">
        <div>
          <div className="eyebrow">Career Profile</div>
          <h1>How would you like to add your career evidence?</h1>
          <p>
            Select a source and provide the information here. You will review everything
            before it is saved or used for Career Pivot.
          </p>
        </div>
      </div>
      <section className="flowPanel">
        <div className="sourceCards">
          {EVIDENCE_SOURCES.map(([key, glyph, title, copy]) => (
            <button
              key={key}
              type="button"
              className={`sourceCard ${source === key ? 'selected' : ''}`}
              onClick={() => patch({ profileSource: key })}
            >
              <span>{glyph}</span>
              <b>{title}</b>
              <small>{copy}</small>
            </button>
          ))}
        </div>
        <div
          style={{ marginTop: 24, paddingTop: 22, borderTop: '1px solid var(--line)' }}
        >
          {inlineInput}
        </div>
        <div className="flowActions">
          <StepLink className="btn secondary" target="prototype-new-account-3">
            Back to initial paths
          </StepLink>
          <StepLink className="btn primary" target="prototype-new-account-5">
            {source === 'resume'
              ? 'Upload and review'
              : source === 'manual'
                ? 'Save details and review'
                : 'Retrieve and review records'}{' '}
            →
          </StepLink>
        </div>
      </section>
    </>
  );
};

const EXTRACTED_ITEMS: Array<[string, string]> = [
  ['Current role', 'Senior Product Manager · Financial Services'],
  ['Career history', '3 roles · 12 years of experience'],
  ['Core strengths', 'Product strategy · Payments · Analytics · Stakeholder leadership'],
  [
    'Outcome evidence',
    'Payments modernization · approval-rate improvement · incident reduction',
  ],
];

const StepFiveReview: React.FC = () => (
  <>
    <div className="flowHeader">
      <div>
        <div className="eyebrow">Review before saving</div>
        <h1>Confirm your career profile.</h1>
        <p>
          Correct anything that is incomplete or inaccurate. Only confirmed information
          will power your results.
        </p>
      </div>
    </div>
    <section className="flowPanel">
      <div className="profileMeter">
        <strong>85%</strong>
        <div>
          <b>Career evidence extracted</b>
          <p>Four sections are ready for confirmation.</p>
        </div>
      </div>
      <div className="reviewList">
        {EXTRACTED_ITEMS.map(([label, value]) => (
          <div key={label} className="reviewItem">
            <span>{label}</span>
            <b>{value}</b>
            <button type="button">Edit</button>
          </div>
        ))}
      </div>
      <div className="flowActions">
        <StepLink className="btn secondary" target="prototype-new-account-4">
          Back
        </StepLink>
        <StepLink className="btn primary" target="prototype-new-account-6">
          Confirm and save profile →
        </StepLink>
      </div>
    </section>
  </>
);

const StepSixComplete: React.FC = () => (
  <>
    <div className="flowHeader">
      <div>
        <div className="eyebrow">Profile complete</div>
        <h1>Your career evidence is ready.</h1>
        <p>
          Your saved return destination is Career Pivot, so you can continue without
          choosing the tool again.
        </p>
      </div>
    </div>
    <section className="flowPanel">
      <div className="completeBanner">
        <span className="completeIcon">✓</span>
        <div>
          <h2>Career Profile 100%</h2>
          <p>
            Roles, strengths, skills and evidence of outcomes have been confirmed.
          </p>
        </div>
      </div>
      <div className="reviewList">
        <div className="reviewItem">
          <span>Next destination</span>
          <b>Career Pivot Accelerator</b>
          <span />
        </div>
        <div className="reviewItem">
          <span>Information carried forward</span>
          <b>Current role, industry, transferable strengths and experience</b>
          <span />
        </div>
      </div>
      <div className="flowActions">
        <StepLink className="btn secondary" target="prototype-new-account-1">
          Return Home
        </StepLink>
        <StepLink className="btn primary" target="prototype-new-account-7">
          Continue Career Pivot →
        </StepLink>
      </div>
    </section>
  </>
);

interface EnrichedPath {
  label: string;
  score: string;
  name: string;
  transfers: string;
  gap: string;
  top?: boolean;
}

const ENRICHED_PATHS: EnrichedPath[] = [
  {
    top: true,
    label: 'Recommended path',
    score: '86%',
    name: 'Payments Platform Product Lead',
    transfers: 'payments, product strategy and regulated delivery.',
    gap: 'platform economics and commercial ownership.',
  },
  {
    label: 'Strong adjacency',
    score: '79%',
    name: 'Fintech Solutions Consultant',
    transfers: 'implementation and stakeholder leadership.',
    gap: 'advisory discovery and solution selling.',
  },
  {
    label: 'Build-and-move path',
    score: '68%',
    name: 'Product Operations Lead',
    transfers: 'analytics and delivery coordination.',
    gap: 'portfolio operations and enablement.',
  },
];

const StepSevenComparison: React.FC = () => (
  <>
    <div className="flowHeader">
      <div>
        <div className="eyebrow">Profile-enriched comparison</div>
        <h1>Your initial paths, now validated against your career evidence.</h1>
        <p>
          The same three paths have been rescored using your confirmed roles, outcomes and
          transferable strengths.
        </p>
      </div>
    </div>
    <section className="flowPanel">
      <div className="evidence">
        <b>Career profile applied</b>
        <br />
        Senior Product Manager · Financial Services · 12 years · Product strategy,
        payments, analytics and stakeholder leadership.
      </div>
      <div className="pathGrid">
        {ENRICHED_PATHS.map((path) => (
          <div key={path.name} className={path.top ? 'pathCard top' : 'pathCard'}>
            <span className="label">{path.label}</span>
            <strong>{path.score}</strong>
            <h3>{path.name}</h3>
            <p>
              <b>What transfers:</b> {path.transfers}
            </p>
            <p>
              <b>Priority gap:</b> {path.gap}
            </p>
          </div>
        ))}
      </div>
      <div className="flowActions">
        <StepLink className="btn secondary" target="prototype-new-account-6">
          Back to profile
        </StepLink>
        <StepLink className="btn primary" target="prototype-new-account-8">
          Build plan for recommended path →
        </StepLink>
      </div>
    </section>
  </>
);

const FINAL_PATHS: PathCard[] = [
  {
    top: true,
    label: 'Best immediate fit',
    score: '86%',
    name: 'Payments Platform Product Lead',
    copy: 'Strongest overlap with product leadership, payments and regulated delivery.',
  },
  {
    label: 'Strong adjacency',
    score: '79%',
    name: 'Fintech Solutions Consultant',
    copy: 'Reframe implementation and stakeholder work as advisory evidence.',
  },
  {
    label: 'Build-and-move path',
    score: '68%',
    name: 'Product Operations Lead',
    copy: 'Strengthen operating-model, portfolio and enablement evidence.',
  },
];

const PLAN_WEEKS: Array<[string, string]> = [
  [
    'Week 1',
    'Rewrite two achievements around platform scale, reliability and payment outcomes.',
  ],
  ['Week 2', 'Compare 15 relevant postings and validate recurring requirements.'],
  [
    'Week 3',
    'Close the highest-priority gap: platform economics and commercial ownership.',
  ],
  ['Week 4', 'Run five targeted conversations and refine your positioning.'],
];

const StepEightPlan: React.FC = () => (
  <>
    <div className="flowHeader">
      <div>
        <div className="eyebrow">Career Pivot result</div>
        <h1>Three realistic paths built from your evidence.</h1>
        <p>Each path explains what transfers, what is missing and what to do next.</p>
      </div>
      <span className="pill high">Saved</span>
    </div>
    <section className="flowPanel">
      <PathCardList paths={FINAL_PATHS} />
    </section>
    <section className="flowPanel">
      <div className="eyebrow">30-day action plan · top path</div>
      <div className="planList">
        {PLAN_WEEKS.map(([week, copy]) => (
          <div key={week} className="planItem">
            <b>{week}</b>
            <span>{copy}</span>
          </div>
        ))}
      </div>
      <div className="flowActions">
        <StepLink className="btn secondary" target="prototype-new-account-7">
          Adjust preferences
        </StepLink>
        <StepLink className="btn primary" target="prototype-new-account-1">
          Return to Home →
        </StepLink>
      </div>
    </section>
  </>
);

const STEP_NAV: Record<number, 'home' | 'pivot' | 'profile'> = {
  1: 'home',
  2: 'pivot',
  3: 'pivot',
  4: 'profile',
  5: 'profile',
  6: 'profile',
  7: 'pivot',
  8: 'pivot',
};

const stepProfilePct = (step: number): string =>
  step >= 6 ? '100' : step === 5 ? '85' : '0';

export const NewAccountStepView: React.FC<{ step: number }> = ({ step }) => {
  const { patch } = useClarity();

  useEffect(() => {
    if (step === 8) {
      patch({ profileComplete: true, workState: 'completed' });
      return;
    }
    if (step >= 6) {
      patch({ profileComplete: true });
    }
  }, [step, patch]);

  return (
    <StepShell step={step} active={STEP_NAV[step] ?? 'home'} profilePct={stepProfilePct(step)}>
      {step === 1 ? (
        <StepOneHome />
      ) : step === 2 ? (
        <StepTwoPivotInput />
      ) : step === 3 ? (
        <StepThreeInitialResult />
      ) : step === 4 ? (
        <StepFourEvidence />
      ) : step === 5 ? (
        <StepFiveReview />
      ) : step === 6 ? (
        <StepSixComplete />
      ) : step === 7 ? (
        <StepSevenComparison />
      ) : (
        <StepEightPlan />
      )}
    </StepShell>
  );
};
