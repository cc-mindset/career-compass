import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEMO_STATES, INITIAL_STATE } from '../../consts';
import type {
  ClarityState,
  DemoStateKey,
  JobSource,
  ProfileOrigin,
  ProfileSource,
  ThemePreference,
  Tool,
} from '../../types';

interface ClarityContextValue {
  state: ClarityState;
  route: string;
  navigate: (hash: string) => void;
  patch: (partial: Partial<ClarityState>) => void;
  setTool: (tool: Tool) => void;
  setJobSource: (source: JobSource) => void;
  toast: (message: string) => void;
  clearToast: () => void;
  toggleDemoPanel: () => void;
  demoGo: (key: DemoStateKey) => void;
  demoMove: (direction: number) => void;
  demoIndex: number;
  setTheme: (theme: ThemePreference) => void;
  toggleAccountMenu: () => void;
  closeAccountMenu: () => void;
  requestSignOut: () => void;
  cancelSignOut: () => void;
  confirmSignOut: () => void;
  openAccountProfile: () => void;
  prepareCareerProfile: (origin: ProfileOrigin) => void;
  openCareerProfileModal: (origin?: ProfileOrigin) => void;
  closeCareerProfileModal: () => void;
  selectCareerProfileSource: (source: ProfileSource) => void;
  advanceCareerProfileModal: () => void;
  openManualExperience: () => void;
  closeManualExperience: () => void;
  saveManualExperience: () => void;
  startTool: () => void;
  scrollTool: () => void;
  scrollMvp: (direction: number) => void;
}

const ClarityContext = createContext<ClarityContextValue | null>(null);

const readHash = (): string =>
  (typeof window !== 'undefined' ? window.location.hash : '#landing').replace(/^#/, '') ||
  'landing';

const resolvedTheme = (theme: ThemePreference): 'light' | 'dark' => {
  if (theme === 'system') {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
};

export const ClarityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ClarityState>(() => {
    let theme: ThemePreference = 'system';
    try {
      theme = (localStorage.getItem('clarity-theme') as ThemePreference) || 'system';
    } catch {
      /* ignore */
    }
    return { ...INITIAL_STATE, theme };
  });
  const [route, setRoute] = useState(readHash);
  const [demoIndex, setDemoIndex] = useState(0);

  const patch = useCallback((partial: Partial<ClarityState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const navigate = useCallback((hash: string) => {
    const clean = hash.replace(/^#/, '');
    if (window.location.hash === `#${clean}`) {
      setRoute(clean);
      window.scrollTo(0, 0);
      return;
    }
    window.location.hash = clean;
  }, []);

  useEffect(() => {
    const onHash = () => {
      setRoute(readHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) {
      window.location.hash = 'landing';
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    document.body.dataset.theme = resolvedTheme(state.theme);
  }, [state.theme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (state.theme === 'system') {
        document.body.dataset.theme = resolvedTheme('system');
      }
    };
    media?.addEventListener?.('change', onChange);
    return () => media?.removeEventListener?.('change', onChange);
  }, [state.theme]);

  // Tracked by generation rather than message text so that repeating the same
  // message does not let an older timer dismiss the newer toast.
  const toastGeneration = useRef(0);

  const toast = useCallback((message: string) => {
    toastGeneration.current += 1;
    const generation = toastGeneration.current;
    setState((prev) => ({ ...prev, toastMessage: message }));
    window.setTimeout(() => {
      if (toastGeneration.current !== generation) return;
      setState((prev) => ({ ...prev, toastMessage: null }));
    }, 2400);
  }, []);

  const clearToast = useCallback(() => {
    patch({ toastMessage: null });
  }, [patch]);

  const setTheme = useCallback((theme: ThemePreference) => {
    try {
      localStorage.setItem('clarity-theme', theme);
    } catch {
      /* ignore */
    }
    patch({ theme });
  }, [patch]);

  const demoJump = useCallback(
    (hash: string) => {
      navigate(hash);
    },
    [navigate],
  );

  const demoGo = useCallback(
    (key: DemoStateKey) => {
      const found = DEMO_STATES.findIndex((x) => x[0] === key);
      if (found >= 0) setDemoIndex(found);

      const guestKeys: DemoStateKey[] = [
        'landing',
        'signup',
        'guest-pivot',
        'guest-job',
        'guest-market',
      ];
      const base: Partial<ClarityState> = {
        registered: !guestKeys.includes(key),
        profileModal: false,
        profilePageStep: 0,
        manualEditor: false,
      };

      switch (key) {
        case 'landing':
          patch(base);
          return demoJump('landing');
        case 'signup':
          patch({ ...base, tool: 'pivot', pendingGuest: null });
          return demoJump('signup');
        case 'new':
          patch({
            ...base,
            workState: 'none',
            profileComplete: false,
            manualExperienceSaved: false,
          });
          return demoJump('dashboard-new');
        case 'none':
          patch({
            ...base,
            workState: 'none',
            profileComplete: false,
            manualExperienceSaved: false,
          });
          return demoJump('dashboard-returning-none');
        case 'unfinished':
          patch({
            ...base,
            workState: 'unfinished',
            profileComplete: false,
            manualExperienceSaved: true,
          });
          return demoJump('dashboard-returning');
        case 'complete':
          patch({
            ...base,
            workState: 'completed',
            profileComplete: true,
            manualExperienceSaved: true,
          });
          return demoJump('dashboard-returning-complete');
        case 'guest-pivot':
          patch({
            ...base,
            tool: 'pivot',
            pendingGuest: 'pivot',
            entryPoint: 'guest-pivot',
          });
          return demoJump('pivot-preview');
        case 'saved-pivot':
          patch({
            ...base,
            tool: 'pivot',
            pendingGuest: 'pivot',
            entryPoint: 'guest-pivot',
          });
          return demoJump('dashboard-pivot');
        case 'pivot-profile':
          patch({
            ...base,
            profileOrigin: 'pivot',
            profileComplete: false,
            profilePageStep: 1,
            pendingGuest: 'pivot',
          });
          return demoJump('career-profile');
        case 'guest-job':
          patch({
            ...base,
            tool: 'job',
            pendingGuest: 'job',
            entryPoint: 'guest-job',
          });
          return demoJump('job-preview');
        case 'saved-job':
          patch({
            ...base,
            tool: 'job',
            pendingGuest: 'job',
            entryPoint: 'guest-job',
          });
          return demoJump('job-workspace-result');
        case 'guest-market':
          patch({
            ...base,
            tool: 'market',
            pendingGuest: 'market',
            entryPoint: 'guest-market',
          });
          return demoJump('market-preview');
        case 'saved-market':
          patch({
            ...base,
            tool: 'market',
            pendingGuest: 'market',
            entryPoint: 'guest-market',
          });
          return demoJump('dashboard-market');
        case 'profile':
          patch({
            ...base,
            profileOrigin: 'profile',
            profileComplete: false,
            manualExperienceSaved: false,
          });
          return demoJump('career-profile');
        case 'skills-gated':
          patch({
            ...base,
            profileOrigin: 'skills',
            profileComplete: false,
            manualExperienceSaved: false,
          });
          return demoJump('skills-match');
        case 'skills-ready':
          patch({
            ...base,
            profileOrigin: 'skills',
            profileComplete: true,
            manualExperienceSaved: true,
          });
          return demoJump('skills-match');
        case 'job-empty':
          patch({ ...base, pendingGuest: null, entryPoint: 'dashboard' });
          return demoJump('job-workspace-empty');
        case 'job-history':
          patch({ ...base, pendingGuest: null, entryPoint: 'dashboard' });
          return demoJump('job-workspace-history');
        case 'job-new':
          patch({ ...base, pendingGuest: null, entryPoint: 'dashboard' });
          return demoJump('job-workspace-new');
        case 'job-review':
          patch({ ...base, pendingGuest: null, entryPoint: 'dashboard' });
          return demoJump('job-workspace-review');
        case 'job-result':
          patch({ ...base, pendingGuest: null, entryPoint: 'dashboard' });
          return demoJump('job-workspace-result');
        default:
          return demoJump('landing');
      }
    },
    [demoJump, patch],
  );

  const demoMove = useCallback(
    (direction: number) => {
      setDemoIndex((prev) => {
        const next = (prev + direction + DEMO_STATES.length) % DEMO_STATES.length;
        demoGo(DEMO_STATES[next][0]);
        return next;
      });
    },
    [demoGo],
  );

  const value = useMemo<ClarityContextValue>(
    () => ({
      state,
      route,
      navigate,
      patch,
      setTool: (tool) => patch({ tool }),
      setJobSource: (jobSource) => patch({ jobSource }),
      toast,
      clearToast,
      toggleDemoPanel: () =>
        setState((prev) => ({ ...prev, demoPanelOpen: !prev.demoPanelOpen })),
      demoGo,
      demoMove,
      demoIndex,
      setTheme,
      toggleAccountMenu: () =>
        setState((prev) => ({
          ...prev,
          accountMenuOpen: !prev.accountMenuOpen,
          signoutConfirm: false,
        })),
      closeAccountMenu: () => patch({ accountMenuOpen: false }),
      requestSignOut: () =>
        patch({ accountMenuOpen: false, signoutConfirm: true }),
      cancelSignOut: () => patch({ signoutConfirm: false }),
      confirmSignOut: () => {
        patch({
          registered: false,
          pendingGuest: null,
          accountMenuOpen: false,
          signoutConfirm: false,
        });
        navigate('landing');
        window.setTimeout(() => toast('You have signed out.'), 30);
      },
      openAccountProfile: () => {
        patch({ accountMenuOpen: false });
        navigate('account-profile');
      },
      prepareCareerProfile: (origin) =>
        patch({ profileOrigin: origin, profileModal: false, profilePageStep: 1 }),
      openCareerProfileModal: (origin) =>
        patch({
          profileModal: false,
          profilePageStep: 1,
          profileOrigin: origin || state.profileOrigin || 'profile',
        }),
      closeCareerProfileModal: () =>
        patch({ profileModal: false, profilePageStep: 0 }),
      selectCareerProfileSource: (profileSource) => patch({ profileSource }),
      advanceCareerProfileModal: () => {
        if (state.profilePageStep === 1) {
          patch({ profilePageStep: 2 });
          return;
        }
        patch({
          profileComplete: true,
          profilePageStep: 0,
          profileModal: true,
          ...(state.profileOrigin === 'pivot' ? { workState: 'unfinished' as const } : {}),
        });
      },
      openManualExperience: () => patch({ manualEditor: true }),
      closeManualExperience: () => patch({ manualEditor: false }),
      saveManualExperience: () =>
        patch({ manualEditor: false, manualExperienceSaved: true }),
      startTool: () => navigate(`${state.tool}-input`),
      scrollTool: () => {
        window.setTimeout(
          () =>
            document
              .querySelector('.trybox')
              ?.scrollIntoView({ behavior: 'smooth' }),
          30,
        );
      },
      scrollMvp: (direction) => {
        document
          .getElementById('mvpRail')
          ?.scrollBy({ left: direction * 370, behavior: 'smooth' });
      },
    }),
    [
      state,
      route,
      navigate,
      patch,
      toast,
      clearToast,
      demoGo,
      demoMove,
      demoIndex,
      setTheme,
    ],
  );

  return (
    <ClarityContext.Provider value={value}>{children}</ClarityContext.Provider>
  );
};

export const useClarity = (): ClarityContextValue => {
  const ctx = useContext(ClarityContext);
  if (!ctx) {
    throw new Error('useClarity must be used within ClarityProvider');
  }
  return ctx;
};
