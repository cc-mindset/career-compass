import React from 'react';
import { DEMO_MARKET_START, DEMO_STATES } from '../consts';
import { useClarity } from '../state/contexts/ClarityContext';
import type { DemoStateKey } from '../types';

interface BrandProps {
  href?: string;
  light?: boolean;
}

export const Brand: React.FC<BrandProps> = ({ href = '#landing', light }) => {
  const { navigate } = useClarity();
  return (
    <a
      className="brand"
      href={href}
      style={light ? { color: '#fff' } : undefined}
      onClick={(e) => {
        e.preventDefault();
        navigate(href.replace(/^#/, ''));
      }}
    >
      <span className="mark">ϟ</span>
      <span>Clarity Coach</span>
    </a>
  );
};

export const TopNav: React.FC = () => {
  const { navigate, scrollTool } = useClarity();
  return (
    <header className="topbar">
      <nav className="nav">
        <Brand />
        <div className="navlinks">
          <a href="#how">How it works</a>
          <a href="#tools">Career tools</a>
          <a href="#why">Why Clarity Coach</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="actions">
          <a
            className="btn ghost"
            href="#signin"
            onClick={(e) => {
              e.preventDefault();
              navigate('signin');
            }}
          >
            Sign in
          </a>
          <a
            className="btn ghost"
            href="#signup"
            onClick={(e) => {
              e.preventDefault();
              navigate('signup');
            }}
          >
            Create account
          </a>
          <a
            className="btn primary"
            href="#landing"
            onClick={(e) => {
              e.preventDefault();
              navigate('landing');
              window.setTimeout(() => scrollTool(), 10);
            }}
          >
            Try it free
          </a>
        </div>
      </nav>
    </header>
  );
};

export const SiteFooter: React.FC = () => (
  <footer>
    <div className="foot">
      <div>
        <div className="brand">
          <span className="mark">ϟ</span>
          <span>Clarity Coach</span>
        </div>
        <p>
          Practical career intelligence for people navigating change, opportunity and
          uncertain markets.
        </p>
      </div>
      <div>
        <b>Resources</b>
        <div className="footlinks">
          <a>Economic reports</a>
          <a>Career transition guides</a>
          <a>Industry insights</a>
          <a>Resume guidance</a>
        </div>
      </div>
      <div>
        <b>Support</b>
        <div className="footlinks">
          <a>Help centre</a>
          <a>Privacy</a>
          <a>Terms of use</a>
          <a>Contact</a>
        </div>
      </div>
    </div>
  </footer>
);

export const JourneyHeader: React.FC = () => {
  const { navigate } = useClarity();
  return (
    <header className="journeytop">
      <div className="nav">
        <Brand />
        <div className="actions">
          <span className="guesttag">Guest workspace</span>
          <a
            className="btn ghost"
            href="#landing"
            onClick={(e) => {
              e.preventDefault();
              navigate('landing');
            }}
          >
            Exit
          </a>
        </div>
      </div>
    </header>
  );
};

interface ProgressProps {
  active: number;
  names?: string[];
}

export const Progress: React.FC<ProgressProps> = ({
  active,
  names = ['Your input', 'Review', 'Preview'],
}) => (
  <div className="progress">
    {names.map((n, i) => (
      <React.Fragment key={n}>
        {i > 0 ? <i /> : null}
        <span className={i < active ? 'done' : i === active ? 'active' : ''}>{n}</span>
      </React.Fragment>
    ))}
  </div>
);

export const Toast: React.FC = () => {
  const { state } = useClarity();
  if (!state.toastMessage) return null;
  return <div className="toast">{state.toastMessage}</div>;
};

const demoSlice = (start: number, end: number): Array<[DemoStateKey, string]> =>
  DEMO_STATES.slice(start, end);

export const DemoNavigator: React.FC = () => {
  const { state, toggleDemoPanel, demoGo, demoMove } = useClarity();

  const group = (title: string, start: number, end: number) => (
    <div className="demoGroup" key={title}>
      <small>{title}</small>
      <div className="demoLinks">
        {demoSlice(start, end).map(([key, label], i) => (
          <button key={key} type="button" onClick={() => demoGo(key)}>
            {start + i + 1}. {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        id="demo-launcher"
        type="button"
        className="demoLauncher"
        onClick={toggleDemoPanel}
      >
        Demo states
      </button>
      <section
        id="demo-panel"
        className={`demoPanel${state.demoPanelOpen ? '' : ' hidden'}`}
        aria-label="Prototype demo states"
      >
        <div className="demoPanelHead">
          <div>
            <h3>Clarity Coach demo</h3>
            <p>Jump to any state, or move through them in sequence.</p>
          </div>
          <button type="button" onClick={toggleDemoPanel} aria-label="Close">
            ×
          </button>
        </div>
        {group('Entry and account', 0, 3)}
        {group('Dashboard Home states', 3, 6)}
        {group('Guest-to-account journeys', 6, 13)}
        {group('Profile and match', 13, 16)}
        {group('Job Analyzer workspace', 16, DEMO_MARKET_START)}
        {group('Market Report workspace', DEMO_MARKET_START, DEMO_STATES.length)}
        <div className="demoStepNav">
          <button type="button" onClick={() => demoMove(-1)}>
            ← Previous state
          </button>
          <button type="button" onClick={() => demoMove(1)}>
            Next state →
          </button>
        </div>
      </section>
    </>
  );
};
