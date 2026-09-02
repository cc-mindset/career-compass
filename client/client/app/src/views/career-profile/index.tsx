import React from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { FileDropZone } from '../../components/FileDropZone';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { ProfileSource } from '../../types';

const SOURCE_CARDS: Array<[ProfileSource, string, string, string]> = [
  ['linkedin', 'in', 'LinkedIn', 'Use a public profile URL.'],
  ['resume', '⇧', 'Upload résumé', 'Use a PDF or DOCX file.'],
  ['manual', '✎', 'Enter manually', 'Add roles and achievements yourself.'],
];

const ManualExperienceEditor: React.FC = () => {
  const { state, closeManualExperience, saveManualExperience } = useClarity();
  if (!state.manualEditor) return null;
  const saved = state.manualExperienceSaved;

  return (
    <div
      className="workModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-modal-title"
    >
      <section className="workModal">
        <header className="workModalHead">
          <h2 id="work-modal-title">{saved ? 'Edit' : 'Add'} work experience</h2>
          <button
            type="button"
            className="modalClose"
            aria-label="Close"
            onClick={closeManualExperience}
          >
            ×
          </button>
        </header>
        <div className="workModalBody">
          <div className="split">
            <div className="field">
              <label>
                Job title <small>Required</small>
              </label>
              <input
                className="input"
                defaultValue={saved ? 'Senior Product Manager' : ''}
                placeholder="e.g. Product Manager"
              />
            </div>
            <div className="field">
              <label>
                Company <small>Required</small>
              </label>
              <input
                className="input"
                defaultValue={saved ? 'Northstar Financial' : ''}
                placeholder="Enter company name"
              />
            </div>
          </div>
          <div className="split">
            <div className="field">
              <label>
                City <small>Optional</small>
              </label>
              <input
                className="input"
                defaultValue={saved ? 'Toronto' : ''}
                placeholder="e.g. Toronto"
              />
            </div>
            <div className="field">
              <label>
                Country <small>Optional</small>
              </label>
              <select className="input" defaultValue="Canada">
                <option>Canada</option>
                <option>United States</option>
                <option>United Kingdom</option>
                <option>Nigeria</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <label className="checkRow">
            <input type="checkbox" defaultChecked /> I currently work in this role
          </label>
          <div className="dateGrid">
            <div className="field">
              <label>
                Start date <small>Required</small>
              </label>
              <div className="datePair">
                <select className="input" defaultValue="May">
                  <option>May</option>
                  <option>April</option>
                  <option>March</option>
                </select>
                <select className="input" defaultValue="2023">
                  <option>2023</option>
                  <option>2022</option>
                  <option>2021</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>End date</label>
              <input className="input" value="Present" disabled />
            </div>
          </div>
          <div className="field">
            <label>
              What did you achieve in this role? <small>Recommended</small>
            </label>
            <textarea
              className="input"
              placeholder="Describe your responsibilities, decisions and measurable outcomes."
              defaultValue={
                saved
                  ? 'Led cross-functional product delivery and improved customer outcomes across a regulated payments platform.'
                  : ''
              }
            />
            <div className="helper">
              Focus on outcomes you influenced, not only tasks you completed.
            </div>
          </div>
        </div>
        <footer className="workModalFoot">
          <button type="button" className="btn secondary" onClick={closeManualExperience}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={saveManualExperience}>
            Save experience
          </button>
        </footer>
      </section>
    </div>
  );
};

const CareerProfileCompleteModal: React.FC = () => {
  const { state, patch, navigate, closeCareerProfileModal } = useClarity();
  if (!state.profileModal) return null;

  const returningToPivot = state.profileOrigin === 'pivot';
  const returningToSkills = state.profileOrigin === 'skills';
  const target = returningToPivot
    ? 'prototype-new-account-7'
    : returningToSkills
      ? 'skills-match'
      : 'dashboard-home';
  const action = returningToPivot
    ? 'Continue Career Pivot →'
    : returningToSkills
      ? 'Continue Skills Match →'
      : 'Return Home →';

  return (
    <div
      className="profileModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <section className="profileModal">
        <div className="profileModalHead">
          <div>
            <div className="eyebrow">Profile updated</div>
            <h2 id="profile-modal-title">Your Career Profile is complete.</h2>
            <p>Your work history and skills have been saved.</p>
          </div>
          <button
            type="button"
            className="modalClose"
            aria-label="Close"
            onClick={closeCareerProfileModal}
          >
            ×
          </button>
        </div>
        <div className="profileModalBody">
          <div className="modalComplete">
            <span className="completeIcon">✓</span>
            <h2>Career Profile 100%</h2>
            <p>
              {returningToPivot
                ? 'Your Career Pivot is still open. Continue to see the updated path comparison and next steps.'
                : returningToSkills
                  ? 'Your Skills Match is still open. Continue with your confirmed evidence.'
                  : 'Your completed profile can now be used across Clarity Coach.'}
            </p>
            <div className="flowActions">
              <button
                type="button"
                className="btn secondary"
                onClick={closeCareerProfileModal}
              >
                View Career Profile
              </button>
              <a
                className="btn primary"
                href={`#${target}`}
                onClick={(event) => {
                  event.preventDefault();
                  patch({ profileModal: false });
                  navigate(target);
                }}
              >
                {action}
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const ProfileSourceInput: React.FC = () => {
  const { state, openManualExperience, toast, patch } = useClarity();
  const source = state.profileSource;
  const [resumeName, setResumeName] = React.useState<string | null>(null);

  if (source === 'resume') {
    return (
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
            // Keep prototype flow moving; full résumé parse API wiring is separate.
            patch({ profileSource: 'resume' });
            toast(`Selected ${file.name}`);
          }}
        />
      </div>
    );
  }

  if (source === 'manual') {
    return (
      <div className="manualExperience">
        <div>
          <h3 style={{ marginBottom: 5 }}>Work experience</h3>
          <p style={{ margin: 0, color: '#697a90', fontSize: 12 }}>
            Add each role separately so you can review and update it later.
          </p>
        </div>
        {state.manualExperienceSaved ? (
          <>
            <article className="manualRole">
              <div>
                <h3>Senior Product Manager</h3>
                <p>Northstar Financial · Toronto, Canada</p>
                <p>May 2023 – Present</p>
                <p>
                  Led cross-functional product delivery and improved customer outcomes
                  across a regulated payments platform.
                </p>
              </div>
              <div className="manualRoleActions">
                <button type="button" onClick={openManualExperience}>
                  Edit
                </button>
              </div>
            </article>
            <button type="button" className="manualAdd" onClick={openManualExperience}>
              ＋ Add another work experience
            </button>
          </>
        ) : (
          <div className="manualEmpty">
            <h3>No work experience added yet</h3>
            <p>
              Add your current or most recent role first. You can include earlier roles
              afterward.
            </p>
            <button type="button" className="btn primary" onClick={openManualExperience}>
              ＋ Add work experience
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
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
        <b>Before you continue</b>
        <br />
        We will show the imported details for review before saving them to your profile.
      </div>
    </>
  );
};

const REVIEW_ITEMS: Array<[string, string]> = [
  ['Current role', 'Senior Product Manager · Financial Services'],
  ['Work history', '3 roles · 12 years of experience'],
  ['Skills', 'Product strategy · Payments · Analytics · Stakeholder leadership'],
  [
    'Achievements',
    'Payments modernization · approval-rate improvement · incident reduction',
  ],
];

const CareerProfileFlowPage: React.FC<{ step: 1 | 2 }> = ({ step }) => {
  const { state, patch, selectCareerProfileSource, advanceCareerProfileModal } =
    useClarity();
  const source = state.profileSource;

  return (
    <DashboardShell
      title="Career Profile"
      subtitle={step === 2 ? 'Review details' : 'Add work experience'}
      activeNav="profile"
      bodyClassName="careerPage"
      profilePct={step === 2 ? '85' : state.manualExperienceSaved ? '35' : '0'}
      overlay={<ManualExperienceEditor />}
    >
      {step === 2 ? (
        <>
          <div className="flowHeader">
            <div>
              <div className="eyebrow">Career Profile · Review</div>
              <h1>Check the details before saving.</h1>
              <p>Edit anything that is missing or incorrect.</p>
            </div>
          </div>
          <section className="flowPanel">
            <div className="reviewList">
              {REVIEW_ITEMS.map(([label, value]) => (
                <div key={label} className="reviewItem">
                  <span>{label}</span>
                  <b>{value}</b>
                  <button type="button">Edit</button>
                </div>
              ))}
            </div>
            <div className="flowActions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => patch({ profilePageStep: 1 })}
              >
                Back
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={advanceCareerProfileModal}
              >
                Save to Career Profile →
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="flowHeader">
            <div>
              <div className="eyebrow">
                {state.profileOrigin === 'pivot'
                  ? 'Career Pivot · Profile required'
                  : 'Career Profile'}
              </div>
              <h1>Add your work experience</h1>
              <p>
                {state.profileOrigin === 'pivot'
                  ? 'Your Career Pivot will stay open while you update your profile.'
                  : 'Choose how you would like to add your experience.'}
              </p>
            </div>
          </div>
          <section className="flowPanel">
            <div className="modalSourceGrid">
              {SOURCE_CARDS.map(([key, glyph, title, copy]) => (
                <button
                  key={key}
                  type="button"
                  className={`modalSource ${source === key ? 'selected' : ''}`}
                  onClick={() => selectCareerProfileSource(key)}
                >
                  <span>{glyph}</span>
                  <b>{title}</b>
                  <small>{copy}</small>
                </button>
              ))}
            </div>
            <div className="modalInline">
              <ProfileSourceInput />
            </div>
            <div className="flowActions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => patch({ profilePageStep: 0 })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={advanceCareerProfileModal}
              >
                {source === 'resume'
                  ? 'Upload and review'
                  : source === 'manual'
                    ? 'Review details'
                    : 'Import and review'}{' '}
                →
              </button>
            </div>
          </section>
        </>
      )}
    </DashboardShell>
  );
};

export const CareerProfileView: React.FC = () => {
  const { state, toast, openCareerProfileModal } = useClarity();

  if (state.profilePageStep === 1 || state.profilePageStep === 2) {
    return <CareerProfileFlowPage step={state.profilePageStep} />;
  }

  const pct = state.profileComplete ? '100' : state.manualExperienceSaved ? '35' : '0';

  return (
    <DashboardShell
      title="Career Profile"
      subtitle="Profile and preferences"
      activeNav="profile"
      bodyClassName="careerPage"
      overlay={<CareerProfileCompleteModal />}
    >
      <div className="careerHero">
        <div>
          <h1>Career Profile</h1>
          <p>Keep your work history, skills and career preferences in one place.</p>
        </div>
        <div className="profileSummary">
          <span className="profileRing">{pct}%</span>
          <div>
            <b>
              {state.profileComplete
                ? 'Profile complete'
                : state.manualExperienceSaved
                  ? 'Profile in progress'
                  : 'Profile not started'}
            </b>
            <small>
              {state.profileComplete ? 'Last updated today' : 'Add work history next'}
            </small>
          </div>
        </div>
      </div>
      <nav className="careerTabs" aria-label="Career Profile sections">
        <button type="button" className="careerTab active">
          Overview
        </button>
        <button
          type="button"
          className="careerTab"
          onClick={() => toast('Work experience selected')}
        >
          Work experience
        </button>
        <button type="button" className="careerTab" onClick={() => toast('Skills selected')}>
          Skills
        </button>
        <button
          type="button"
          className="careerTab"
          onClick={() => toast('Preferences selected')}
        >
          Preferences
        </button>
      </nav>
      <div className="careerLayout">
        <div className="careerMain">
          <section className="careerSection">
            <div className="careerSectionHead">
              <div>
                <h2>Career preferences</h2>
                <p>What you do now and what you want from your next move.</p>
              </div>
              <button
                type="button"
                className="editLink"
                onClick={() => toast('Career preferences ready to edit')}
              >
                Edit
              </button>
            </div>
            <div className="careerFacts">
              {state.profileComplete ? (
                <>
                  <div className="careerFact">
                    <small>Current role</small>
                    <b>{state.pivot.title}</b>
                  </div>
                  <div className="careerFact">
                    <small>Industry</small>
                    <b>{state.pivot.industry}</b>
                  </div>
                  <div className="careerFact">
                    <small>Experience level</small>
                    <b>{state.pivot.experience}</b>
                  </div>
                  <div className="careerFact">
                    <small>Location</small>
                    <b>{state.pivot.location}</b>
                  </div>
                  <div className="careerFact">
                    <small>Priority</small>
                    <b>{state.pivot.goal}</b>
                  </div>
                  <div className="careerFact">
                    <small>Status</small>
                    <b>Ready for a change</b>
                  </div>
                </>
              ) : (
                ['Current role', 'Industry', 'Experience level', 'Location'].map(
                  (label) => (
                    <div key={label} className="careerFact">
                      <small>{label}</small>
                      <b>Not added</b>
                    </div>
                  ),
                )
              )}
            </div>
          </section>
          <section className="careerSection">
            <div className="careerSectionHead">
              <div>
                <h2>Skills</h2>
                <p>Skills you want to carry into your next role.</p>
              </div>
              <button
                type="button"
                className="editLink"
                onClick={() => toast('Skills ready to edit')}
              >
                Edit
              </button>
            </div>
            <div className="chips">
              {state.profileComplete ? (
                state.pivot.skills.map((skill) => (
                  <span key={skill} className="chip selected">
                    {skill}
                  </span>
                ))
              ) : (
                <span style={{ color: '#64748b' }}>No skills added yet.</span>
              )}
            </div>
          </section>
          <section className="careerSection">
            <div className="careerSectionHead">
              <div>
                <h2>Work experience</h2>
                <p>
                  {state.profileComplete
                    ? 'Roles and achievements saved to your profile.'
                    : 'Add your role history and key achievements.'}
                </p>
              </div>
              <button
                type="button"
                className="editLink"
                onClick={() => openCareerProfileModal('profile')}
              >
                {state.profileComplete ? 'Edit' : 'Add experience'}
              </button>
            </div>
            {state.profileComplete ? (
              <>
                <div className="experienceItem">
                  <span className="experienceMark">SP</span>
                  <div>
                    <h3>Senior Product Manager</h3>
                    <p>
                      Financial Services · Product strategy, payments and platform delivery
                    </p>
                    <button
                      type="button"
                      className="editLink"
                      onClick={() => openCareerProfileModal('profile')}
                    >
                      View details →
                    </button>
                  </div>
                  <time>Current role</time>
                </div>
                <div className="experienceItem">
                  <span className="experienceMark">PM</span>
                  <div>
                    <h3>Product Manager</h3>
                    <p>Digital products · Customer research, analytics and delivery</p>
                  </div>
                  <time>Previous role</time>
                </div>
              </>
            ) : (
              <div className="experienceItem">
                <span className="experienceMark">+</span>
                <div>
                  <h3>No work experience added</h3>
                  <p>Use LinkedIn, upload a résumé or enter your details manually.</p>
                  <button
                    type="button"
                    className="editLink"
                    onClick={() => openCareerProfileModal('profile')}
                  >
                    Choose how to add it →
                  </button>
                </div>
                <time>Required</time>
              </div>
            )}
          </section>
        </div>
        <aside className="careerAside">
          <section className="asideCard">
            <h3>{state.profileComplete ? 'Profile complete' : 'Finish your profile'}</h3>
            <p>
              {state.profileComplete
                ? 'Review your information whenever your role, skills or goals change.'
                : 'Add your work experience to complete this profile.'}
            </p>
            <button
              type="button"
              className="btn primary"
              onClick={() => openCareerProfileModal(state.profileOrigin)}
            >
              {state.profileComplete ? 'Update work experience' : 'Add work experience'} →
            </button>
          </section>
          <section className="asideCard">
            <h3>Documents and links</h3>
            <p>Add or replace a source at any time.</p>
            <div className="sourceRow">
              <b>LinkedIn</b>
              <span>
                {state.profileComplete && state.profileSource === 'linkedin'
                  ? 'Connected'
                  : 'Not connected'}
              </span>
            </div>
            <div className="sourceRow">
              <b>Résumé</b>
              <span>
                {state.profileComplete && state.profileSource === 'resume'
                  ? 'Uploaded'
                  : 'Not uploaded'}
              </span>
            </div>
            <div className="sourceRow">
              <b>Manual entry</b>
              <span>
                {state.profileComplete && state.profileSource === 'manual'
                  ? 'Added'
                  : 'Not added'}
              </span>
            </div>
          </section>
          <section className="asideCard">
            <h3>Profile use</h3>
            <p>
              Career Pivot and Skills Match use the information saved here. You can review
              it before running either tool.
            </p>
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
};

export const AccountProfileView: React.FC = () => {
  const { navigate, toast, requestSignOut } = useClarity();

  return (
    <DashboardShell
      title="Profile"
      subtitle="Account and personal settings"
      activeNav="profile"
      bodyClassName="careerPage"
      hideProfilePct
    >
      <div className="careerHero">
        <div>
          <div className="eyebrow">Your account</div>
          <h1>Profile</h1>
          <p>
            Manage your personal information, sign-in details and communication
            preferences.
          </p>
        </div>
      </div>
      <div className="careerLayout">
        <div className="careerMain">
          <section className="careerSection">
            <div className="careerSectionHead">
              <div>
                <h2>Personal information</h2>
                <p>
                  This information belongs to your Clarity Coach account. It is separate
                  from your Career Profile.
                </p>
              </div>
            </div>
            <div className="split">
              <div className="field">
                <label>
                  Display name <small>Optional</small>
                </label>
                <input className="input" placeholder="Add your name" />
              </div>
              <div className="field">
                <label>
                  Email address <small>Required</small>
                </label>
                <input className="input" type="email" defaultValue="alex@example.com" />
              </div>
            </div>
            <div className="flowActions">
              <span className="privacy">
                Your display name is used only after you add or approve it.
              </span>
              <button
                type="button"
                className="btn primary"
                onClick={() => toast('Account profile saved')}
              >
                Save changes
              </button>
            </div>
          </section>
          <section className="careerSection">
            <div className="careerSectionHead">
              <div>
                <h2>Sign-in and security</h2>
                <p>Review how you access this account.</p>
              </div>
            </div>
            <div className="reviewList">
              <div className="reviewItem">
                <span>Sign-in method</span>
                <b>Email and password</b>
                <button
                  type="button"
                  onClick={() => toast('Sign-in method management opened')}
                >
                  Manage
                </button>
              </div>
              <div className="reviewItem">
                <span>Password</span>
                <b>Last updated recently</b>
                <button type="button" onClick={() => toast('Password reset email sent')}>
                  Change
                </button>
              </div>
            </div>
          </section>
          <section className="careerSection">
            <div className="careerSectionHead">
              <div>
                <h2>Email preferences</h2>
                <p>Choose which optional messages you want to receive.</p>
              </div>
            </div>
            <label className="checkRow">
              <input type="checkbox" defaultChecked /> Product updates and career guidance
            </label>
            <label className="checkRow">
              <input type="checkbox" /> Research invitations and occasional offers
            </label>
            <p className="privacy">
              Essential account, security and service emails cannot be disabled.
            </p>
          </section>
        </div>
        <aside className="careerAside">
          <section className="asideCard">
            <h3>Career Profile</h3>
            <p>
              Your work history, skills, achievements and career preferences are managed
              separately.
            </p>
            <a
              className="btn secondary full"
              href="#career-profile"
              onClick={(event) => {
                event.preventDefault();
                navigate('career-profile');
              }}
            >
              Open Career Profile →
            </a>
          </section>
          <section className="asideCard">
            <h3>Sign out</h3>
            <p>
              Signing out does not delete saved analyses or Career Profile information.
            </p>
            <button
              type="button"
              className="btn secondary full"
              onClick={requestSignOut}
            >
              Sign out
            </button>
          </section>
        </aside>
      </div>
    </DashboardShell>
  );
};