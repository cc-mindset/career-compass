import React from 'react';
import { useClarity } from '../state/contexts/ClarityContext';
import type { ThemePreference } from '../types';

const THEME_OPTIONS: Array<[ThemePreference, string, string]> = [
  ['light', '☀', 'Light theme'],
  ['dark', '☾', 'Dark theme'],
  ['system', '◐', 'Use system theme'],
];

const AccountMenu: React.FC = () => {
  const {
    state,
    closeAccountMenu,
    openAccountProfile,
    requestSignOut,
    setTheme,
    toast,
  } = useClarity();

  return (
    <>
      <button
        type="button"
        className="accountScrim"
        aria-label="Close account menu"
        onClick={closeAccountMenu}
      />
      <section className="accountMenu" role="menu" aria-label="Account menu">
        <div className="accountMenuHead">
          <span className="profileAvatar">◎</span>
          <div>
            <b>Your account</b>
            <small>Clarity Coach workspace</small>
          </div>
        </div>
        <div className="accountMenuSection">
          <button type="button" className="accountMenuItem" onClick={openAccountProfile}>
            <span>◎ &nbsp; Profile</span>
            <span>→</span>
          </button>
          <button type="button" className="accountMenuItem" onClick={openAccountProfile}>
            <span>⚙ &nbsp; Account settings</span>
            <span>→</span>
          </button>
        </div>
        <div className="accountMenuDivider" />
        <div className="themeRow">
          <span>Theme</span>
          <div className="themeOptions" aria-label="Theme">
            {THEME_OPTIONS.map(([theme, glyph, label]) => (
              <button
                key={theme}
                type="button"
                className={state.theme === theme ? 'active' : ''}
                title={label}
                aria-label={label}
                onClick={() => setTheme(theme)}
              >
                {glyph}
              </button>
            ))}
          </div>
        </div>
        <div className="accountMenuDivider" />
        <div className="accountMenuSection">
          <button
            type="button"
            className="accountMenuItem"
            onClick={() => toast('Help Centre opened in prototype')}
          >
            <span>? &nbsp; Help Centre</span>
            <span>→</span>
          </button>
          <button
            type="button"
            className="accountMenuItem signOutItem"
            onClick={requestSignOut}
          >
            <span>↪ &nbsp; Sign out</span>
          </button>
        </div>
      </section>
    </>
  );
};

const SignOutDialog: React.FC = () => {
  const { cancelSignOut, confirmSignOut } = useClarity();
  return (
    <div
      className="signoutBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signout-title"
    >
      <section className="signoutDialog">
        <h2 id="signout-title">Sign out of Clarity Coach?</h2>
        <p>
          Your saved analyses and Career Profile will remain available when you sign in
          again.
        </p>
        <div className="signoutActions">
          <button type="button" className="btn secondary" onClick={cancelSignOut}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={confirmSignOut}>
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
};

export const AccountControls: React.FC = () => {
  const { state } = useClarity();
  if (!state.accountMenuOpen && !state.signoutConfirm) return null;
  return (
    <div id="account-controls">
      {state.accountMenuOpen ? <AccountMenu /> : null}
      {state.signoutConfirm ? <SignOutDialog /> : null}
    </div>
  );
};
