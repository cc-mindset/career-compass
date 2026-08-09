import React from 'react';
import { FileDropZone } from '../../components/FileDropZone';
import { SiteFooter, TopNav } from '../../components/layout';
import {
  INDUSTRY_OPTIONS,
  LOCATION_OPTIONS,
  ROLE_OPTIONS,
  selectOptions,
} from '../../consts';
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

const JOB_SOURCES: Array<[JobSource, string]> = [
  ['paste', 'Paste description'],
  ['url', 'Job URL'],
  ['upload', 'Upload file'],
];

const TASK_CARDS: Array<[Tool, string, string, string]> = [
  ['pivot', '↗', '01 · Explore a career pivot', 'Find three realistic career options.'],
  ['job', '⌕', '02 · Analyze a job', 'Reveal stated and hidden expectations.'],
  ['market', '⌁', '03 · Understand my market', 'See demand and rising skills nearby.'],
];

const options = (items: readonly string[], current: string) =>
  selectOptions(items, current).map((value) => (
    <option key={value} value={value}>
      {value}
    </option>
  ));

const QuickFields: React.FC = () => {
  const { state, patch, setJobSource, toast } = useClarity();

  const chooseSource = (source: JobSource) => {
    setJobSource(source);
    window.setTimeout(
      () => document.getElementById('tools')?.scrollIntoView(),
      20,
    );
  };

  if (state.tool === 'job') {
    return (
      <>
        <div className="quickTitle">
          <b>How would you like to add the job?</b>
          <span>Use the complete posting for a more reliable result.</span>
        </div>
        <div className="sourceSwitch">
          {JOB_SOURCES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-testid={testIds.jobSource(value)}
              className={state.jobSource === value ? 'active' : ''}
              onClick={() => chooseSource(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {state.jobSource === 'url' ? (
          <div className="field">
            <label>Public job URL</label>
            <input
              className="input"
              placeholder="https://company.com/jobs/role"
              value={state.jobUrl}
              onChange={(event) => patch({ jobUrl: event.target.value })}
            />
          </div>
        ) : state.jobSource === 'upload' ? (
          <div className="field">
            <label>Job description file</label>
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
            <label>Job description</label>
            <textarea
              className="input"
              data-testid={testIds.jobPasteTextarea}
              placeholder="Paste the complete job description here…"
              value={state.jobPostingText}
              onChange={(event) => patch({ jobPostingText: event.target.value })}
            />
          </div>
        )}
      </>
    );
  }

  if (state.tool === 'pivot') {
    return (
      <div className="split">
        <div className="field">
          <label>Current or recent role</label>
          <select
            className="input"
            value={state.pivot.title}
            onChange={(event) =>
              patch({ pivot: { ...state.pivot, title: event.target.value } })
            }
          >
            {options(ROLE_OPTIONS, state.pivot.title)}
          </select>
        </div>
        <div className="field">
          <label>Industry or function</label>
          <select
            className="input"
            value={state.pivot.industry}
            onChange={(event) =>
              patch({ pivot: { ...state.pivot, industry: event.target.value } })
            }
          >
            {options(INDUSTRY_OPTIONS, state.pivot.industry)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="split">
      <div className="field">
        <label>Role or career area</label>
        <select
          className="input"
          value={state.market.role}
          onChange={(event) =>
            patch({ market: { ...state.market, role: event.target.value } })
          }
        >
          {options(ROLE_OPTIONS, state.market.role)}
        </select>
      </div>
      <div className="field">
        <label>Seniority</label>
        <select
          className="input"
          value={state.market.level}
          onChange={(event) =>
            patch({ market: { ...state.market, level: event.target.value } })
          }
        >
          {options(SENIORITY_OPTIONS, state.market.level)}
        </select>
      </div>
      <div className="field">
        <label>Location</label>
        <select
          className="input"
          value={state.market.location}
          onChange={(event) =>
            patch({ market: { ...state.market, location: event.target.value } })
          }
        >
          {options(LOCATION_OPTIONS, state.market.location)}
        </select>
      </div>
    </div>
  );
};

const quickCta = (tool: Tool) =>
  tool === 'job'
    ? 'Analyze this job →'
    : tool === 'pivot'
      ? 'Find my career options →'
      : 'Show my market snapshot →';

const quickTrust = (tool: Tool) =>
  tool === 'pivot'
    ? 'No account required to see your first three options.'
    : 'No account required.';

export const LandingView: React.FC = () => {
  const { state, setTool, navigate, scrollTool, scrollMvp, startTool } = useClarity();

  const openTool = (tool: Tool) => {
    setTool(tool);
    scrollTool();
  };

  return (
    <>
      <TopNav />
      <main>
        <section className="hero" data-testid={testIds.landingHero}>
          <div className="heroCopy">
            <div className="eyebrow">Career intelligence for your next move</div>
            <h1>Make clearer career decisions in uncertain times.</h1>
            <p className="lead">
              Analyze a job, discover realistic career pivots, or understand what is
              happening in your local market. Try Clarity Coach before creating an
              account.
            </p>
            <div className="heroActions">
              <a className="btn primary" onClick={scrollTool}>
                Try Clarity Coach free →
              </a>
              <a
                className="btn secondary"
                href="#how"
                onClick={(event) => {
                  event.preventDefault();
                  navigate('how');
                }}
              >
                See how it works
              </a>
            </div>
            <div className="proof">
              <span>
                <b className="check">✓</b>No account to start
              </span>
              <span>
                <b className="check">✓</b>No résumé required
              </span>
              <span>
                <b className="check">✓</b>Useful result in minutes
              </span>
            </div>
          </div>
        </section>

        <section className="productStage" id="tools" data-testid={testIds.toolsSection}>
          <div className="trybox">
            <div className="tryhead">
              <strong>What would you like help with?</strong>
              <p>
                Choose a question. We will only ask for the information needed to answer
                it.
              </p>
            </div>
            <div className="taskChooser">
              {TASK_CARDS.map(([tool, glyph, title, copy]) => (
                <button
                  key={tool}
                  type="button"
                  data-testid={testIds.toolCard(tool)}
                  className={`taskCard ${state.tool === tool ? 'active' : ''}`}
                  onClick={() => setTool(tool)}
                >
                  <span className="taskIcon">{glyph}</span>
                  <span>
                    <b>{title}</b>
                    <small>{copy}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="quickform">
              <div id="quickfields">
                <QuickFields />
              </div>
              <div className="quickAction">
                <span className="helper">{quickTrust(state.tool)}</span>
                <button
                  type="button"
                  className="btn primary"
                  data-testid={testIds.startToolCta}
                  onClick={startTool}
                >
                  {quickCta(state.tool)}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="why">
          <div className="inner">
            <div className="railHead">
              <div className="sectionintro">
                <div className="eyebrow">The Clarity Coach MVP</div>
                <h2>One platform for the questions shaping your career.</h2>
                <p className="lead">
                  Scroll through the connected tools available in the MVP.
                </p>
              </div>
              <div className="railControls">
                <button aria-label="Previous feature" onClick={() => scrollMvp(-1)}>
                  ←
                </button>
                <button aria-label="Next feature" onClick={() => scrollMvp(1)}>
                  →
                </button>
              </div>
            </div>
            <div className="featureRail" id="mvpRail">
              <article className="mvpFeature">
                <span className="featureIcon">◎</span>
                <span className="number">01 / CAREER PROFILE</span>
                <h3>Build your career evidence</h3>
                <p>
                  Create a trusted profile from your résumé, LinkedIn or manual details.
                </p>
                <ul>
                  <li>Review imported information</li>
                  <li>Profile strength progress</li>
                  <li>Evidence-backed strengths</li>
                </ul>
                <a
                  className="textlink"
                  href="#signin"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate('signin');
                  }}
                >
                  Build my profile →
                </a>
              </article>
              <article className="mvpFeature">
                <span className="featureIcon">⌕</span>
                <span className="number">02 / JOB ANALYZER</span>
                <h3>Decode the job behind the posting</h3>
                <p>See stated requirements and three likely hidden expectations.</p>
                <ul>
                  <li>Evidence from the posting</li>
                  <li>Confidence explanation</li>
                  <li>Application questions</li>
                </ul>
                <a className="textlink" onClick={() => openTool('job')}>
                  Analyze a job →
                </a>
              </article>
              <article className="mvpFeature">
                <span className="featureIcon">≋</span>
                <span className="number">03 / SKILLS MATCH</span>
                <h3>Understand where you match</h3>
                <p>Compare confirmed career evidence with a job or target role.</p>
                <ul>
                  <li>Transferable strengths</li>
                  <li>Important evidence gaps</li>
                  <li>Prioritized next move</li>
                </ul>
                <a
                  className="textlink"
                  href="#signin"
                  onClick={(event) => {
                    event.preventDefault();
                    navigate('signin');
                  }}
                >
                  Assess my skills →
                </a>
              </article>
              <article className="mvpFeature">
                <span className="featureIcon">↗</span>
                <span className="number">04 / CAREER PIVOT + ACTION PLAN</span>
                <h3>Find a credible way forward</h3>
                <p>Rank three realistic pivot paths and turn your choice into action.</p>
                <ul>
                  <li>Transferability score</li>
                  <li>Market-informed comparison</li>
                  <li>30/60/90-day roadmap</li>
                </ul>
                <a className="textlink" onClick={() => openTool('pivot')}>
                  Explore my pivot paths →
                </a>
              </article>
              <article className="mvpFeature">
                <span className="featureIcon">⌁</span>
                <span className="number">05 / MARKET REPORT</span>
                <h3>Read your local career market</h3>
                <p>Understand demand, rising skills and adjacent opportunities.</p>
                <ul>
                  <li>Location-specific findings</li>
                  <li>Source and retrieval date</li>
                  <li>Practical implications</li>
                </ul>
                <a className="textlink" onClick={() => openTool('market')}>
                  Check my market →
                </a>
              </article>
            </div>
          </div>
        </section>

        <section className="productProof">
          <div className="inner">
            <div>
              <div className="eyebrow">Career Pivot Accelerator</div>
              <h2>See which careers you can move into without starting over.</h2>
              <p>
                Tell us your current role, skills and career goal. Clarity Coach will show
                you three suitable career options, explain why each one fits your
                experience, identify the skills you still need and create a step-by-step
                plan for making the move.
              </p>
              <a className="btn primary" onClick={() => openTool('pivot')}>
                Find my career options →
              </a>
            </div>
            <div className="screenStack">
              <div className="mockScreen">
                <div className="mockTop">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="mockBody">
                  <small>Your transferable foundation</small>
                  <h3>Product strategy · Payments · Analytics</h3>
                  <div className="mockLine" />
                  <div className="mockLine short" />
                  <div className="mockResult">
                    <b>Strongest evidence</b>
                    <br />
                    Regulated product delivery, API platforms and cross-functional
                    leadership.
                  </div>
                </div>
              </div>
              <div className="mockScreen">
                <div className="mockTop">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="mockBody">
                  <small>Top 3 pivot paths</small>
                  <h3>Where your experience can take you</h3>
                  <div className="mockResult">
                    <b>01 · Payments Platform Product Lead</b>
                    <br />
                    High transferability · strongest immediate option
                  </div>
                  <div className="mockResult">
                    <b>02 · Fintech Solutions Consultant</b>
                    <br />
                    Strong adjacent fit · reposition implementation evidence
                  </div>
                  <div className="mockResult">
                    <b>03 · Product Operations Lead</b>
                    <br />
                    Moderate upskilling · strengthen operating-model evidence
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="inner">
            <div className="sectionintro">
              <div className="eyebrow">How it works</div>
              <h2>
                Try it free and see your first result. Create an account to unlock the full
                analysis and save your progress.
              </h2>
            </div>
            <div className="steps">
              <div className="step">
                <b>1</b>
                <h3>Choose your question</h3>
                <p>
                  Begin with a job, a pivot decision or a location-based market question.
                </p>
              </div>
              <div className="step">
                <b>2</b>
                <h3>See your first result</h3>
                <p>We generate a focused preview in a temporary guest workspace.</p>
              </div>
              <div className="step">
                <b>3</b>
                <h3>Save and continue</h3>
                <p>
                  Create an account to retain your work and open the complete dashboard
                  experience.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
};
