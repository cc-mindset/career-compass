import React from 'react';
import { icon } from '../consts';
import { useClarity } from '../state/contexts/ClarityContext';
import type { ClarityState } from '../types';

export type DashNav = 'home' | 'job' | 'skills' | 'pivot' | 'market' | 'profile';

interface NavItem {
  key: DashNav;
  href: string;
  label: string;
  iconName: string;
  /** Job Analyzer and Market Report start a fresh dashboard flow rather than a restored guest result. */
  resetGuest?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', href: 'dashboard-home', label: 'Home', iconName: 'home' },
  {
    key: 'job',
    href: 'dashboard-job',
    label: 'Job Analyzer',
    iconName: 'job',
    resetGuest: true,
  },
  { key: 'skills', href: 'skills-match', label: 'Skills Match', iconName: 'skills' },
  {
    key: 'pivot',
    href: 'prototype-new-account-2',
    label: 'Career Pivot',
    iconName: 'pivot',
  },
  {
    key: 'market',
    href: 'dashboard-market',
    label: 'Market Report',
    iconName: 'market',
    resetGuest: true,
  },
  { key: 'profile', href: 'career-profile', label: 'Career Profile', iconName: 'profile' },
];

export const profilePercent = (state: ClarityState): string =>
  state.profileComplete ? '100' : state.manualExperienceSaved ? '35' : '0';

export const AccountAvatar: React.FC = () => {
  const { state, toggleAccountMenu } = useClarity();
  return (
    <span
      className="mark accountAvatar"
      role="button"
      tabIndex={0}
      aria-label="Open account menu"
      aria-expanded={state.accountMenuOpen}
      onClick={(event) => {
        event.stopPropagation();
        toggleAccountMenu();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleAccountMenu();
        }
      }}
    >
      ◎
    </span>
  );
};

const DashboardSidebar: React.FC<{ activeNav: DashNav }> = ({ activeNav }) => {
  const { navigate, patch } = useClarity();
  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#landing"
        onClick={(event) => {
          event.preventDefault();
          navigate('landing');
        }}
      >
        <span className="mark">ϟ</span>
        <span>Clarity Coach</span>
      </a>
      <nav className="menu">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            className={item.key === activeNav ? 'active' : ''}
            href={`#${item.href}`}
            onClick={(event) => {
              event.preventDefault();
              if (item.resetGuest) {
                patch({ pendingGuest: null, entryPoint: 'dashboard' });
              }
              navigate(item.href);
            }}
          >
            <span>{icon(item.iconName)}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
};

interface DashboardShellProps {
  title: string;
  subtitle: React.ReactNode;
  activeNav: DashNav;
  children: React.ReactNode;
  /** Overrides the value derived from profile state. */
  profilePct?: string;
  hideProfilePct?: boolean;
  /** `dashbody`, `homebody` or `careerPage` depending on the view. */
  bodyClassName?: string;
  subtitleClassName?: string;
  /** Rendered before the profile percentage in the header actions. */
  headActions?: React.ReactNode;
  /** Modals that must sit inside `.dash` alongside `.dashmain`. */
  overlay?: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  title,
  subtitle,
  activeNav,
  children,
  profilePct,
  hideProfilePct = false,
  bodyClassName = 'dashbody',
  subtitleClassName,
  headActions,
  overlay,
}) => {
  const { state } = useClarity();
  const pct = profilePct ?? profilePercent(state);

  return (
    <main className="dash">
      <DashboardSidebar activeNav={activeNav} />
      <section className="dashmain">
        <header className="dashhead">
          <div>
            <b>{title}</b>
            {subtitleClassName ? (
              <div className={subtitleClassName}>{subtitle}</div>
            ) : (
              <div style={{ fontSize: 11, color: '#64748b' }}>{subtitle}</div>
            )}
          </div>
          <div className="actions">
            {headActions}
            {hideProfilePct ? null : (
              <span style={{ fontSize: 12, color: '#6f7d90' }}>Profile {pct}%</span>
            )}
            <AccountAvatar />
          </div>
        </header>
        <div className={bodyClassName}>{children}</div>
      </section>
      {overlay}
    </main>
  );
};
