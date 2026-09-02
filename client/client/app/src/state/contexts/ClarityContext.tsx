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
import type { MarketInsightsPayload } from '../../services/marketInsights/types';
import type {
  ClarityState,
  DemoStateKey,
  JobSource,
  MarketOpportunityView,
  MarketReportTab,
  ProfileOrigin,
  ProfileSource,
  Tool,
} from '../../types';

/**
 * Actions offered from the Market Report overview. Guests are sent to sign-up with the
 * matching tab remembered; registered users go straight to the destination.
 */
export type MarketAction =
  | 'skills'
  | 'insights'
  | 'path'
  | 'recommendations'
  | 'full';

interface ClarityContextValue {
  state: ClarityState;
  route: string;
  navigate: (hash: string) => void;
  /** Patch overview insights and route to result in one synchronous transition. */
  navigateToOverview: (insights: MarketInsightsPayload) => void;
  patch: (partial: Partial<ClarityState>) => void;
  setTool: (tool: Tool) => void;
  setJobSource: (source: JobSource) => void;
  toast: (message: string) => void;
  clearToast: () => void;
  toggleDemoPanel: () => void;
  demoGo: (key: DemoStateKey) => void;
  demoMove: (direction: number) => void;
  demoIndex: number;
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
  startNewMarketReport: () => void;
  refreshMarketReport: () => void;
  reviewMarketSnapshot: (reportId: string) => void;
  setMarketReportTab: (tab: MarketReportTab) => void;
  setMarketOpportunityView: (view: MarketOpportunityView) => void;
  toggleMarketOpportunityDetail: (key: string) => void;
  openMarketAction: (action: MarketAction) => void;
  openFullMarketReport: () => void;
  openSkillsFromMarket: () => void;
  /** Copies saved career direction into the market inputs so questions are not repeated. */
  syncProfileToMarket: () => void;
}

const ClarityContext = createContext<ClarityContextValue | null>(null);

const readHash = (): string =>
  (typeof window !== 'undefined' ? window.location.hash : '#landing').replace(/^#/, '') ||
  'landing';

export const ClarityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ClarityState>(INITIAL_STATE);
  const [route, setRoute] = useState(readHash);
  const [demoIndex, setDemoIndex] = useState(0);

  const patch = useCallback((partial: Partial<ClarityState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const navigate = useCallback((hash: string) => {
    const clean = hash.replace(/^#/, '');
    setRoute(clean);
    window.scrollTo(0, 0);
    if (window.location.hash !== `#${clean}`) {
      window.location.hash = clean;
    }
  }, []);

  const navigateToOverview = useCallback((insights: MarketInsightsPayload) => {
    setState((prev) => ({
      ...prev,
      marketLiveInsights: insights,
      marketLiveError: null,
      marketHasReports: true,
      marketGuestReady: prev.registered ? prev.marketGuestReady : true,
      marketCreateMode: false,
      marketSnapshotDate: null,
      marketSnapshotId: null,
      marketGenerationStatus: 'streaming',
    }));
    const clean = 'market-workspace-result';
    setRoute(clean);
    window.scrollTo(0, 0);
    if (window.location.hash !== `#${clean}`) {
      window.location.hash = clean;
    }
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
    document.body.dataset.theme = 'light';
  }, []);

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
            marketHasReports: true,
            marketGuestReady: true,
          });
          return demoJump('market-workspace-result');
        case 'saved-market':
          patch({
            ...base,
            tool: 'market',
            pendingGuest: 'market',
            entryPoint: 'guest-market',
            marketHasReports: true,
            marketGuestReady: true,
            marketGuestSaved: true,
          });
          return demoJump('market-workspace-result');
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
        case 'market-empty':
          patch({
            ...base,
            marketHasReports: false,
            marketSnapshotDate: null,
            profileComplete: false,
          });
          return demoJump('market-workspace-empty');
        case 'market-profile':
          patch({
            ...base,
            marketHasReports: false,
            marketSnapshotDate: null,
            profileComplete: true,
          });
          return demoJump('market-workspace-new');
        case 'market-generating':
          patch({ ...base, marketHasReports: false, marketSnapshotDate: null });
          return demoJump('market-workspace-generating');
        case 'market-result':
        case 'market-insights':
          patch({ ...base, marketHasReports: true, marketSnapshotDate: null });
          return demoJump('market-workspace-result');
        case 'market-full':
          patch({
            ...base,
            marketHasReports: true,
            marketSnapshotDate: null,
            marketReportTab: 'overview',
          });
          return demoJump('market-workspace-full');
        case 'market-history':
          patch({ ...base, marketHasReports: true, marketSnapshotDate: null });
          return demoJump('market-workspace-history');
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

  // Idempotent and identity-stable so views can call it from an effect without looping.
  const syncProfileToMarket = useCallback(() => {
    setState((prev) => {
      if (!prev.profileComplete) return prev;
      const market = {
        ...prev.market,
        role: prev.pivot.title,
        industry: prev.pivot.industry,
        level: prev.pivot.experience,
        location: prev.pivot.location,
      };
      const unchanged = (Object.keys(market) as Array<keyof typeof market>).every(
        (key) => market[key] === prev.market[key],
      );
      return unchanged ? prev : { ...prev, market };
    });
  }, []);

  const openSkillsFromMarket = useCallback(() => {
    patch({ profileOrigin: 'skills', entryPoint: 'market-report' });
    if (state.profileComplete) {
      navigate('skills-match');
      return;
    }
    patch({ profileModal: false, profilePageStep: 1 });
    navigate('career-profile');
  }, [navigate, patch, state.profileComplete]);

  const focusMarketInsights = useCallback(() => {
    navigate('market-workspace-result');
    window.setTimeout(
      () =>
        document
          .getElementById('market-insights')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    );
  }, [navigate]);

  const openFullMarketReport = useCallback(() => {
    if (state.registered) {
      patch({ marketReportTab: 'overview' });
      navigate('market-workspace-full');
      return;
    }
    patch({
      pendingGuest: 'market',
      tool: 'market',
      entryPoint: 'guest-market',
      marketGuestReady: true,
      postAuthRoute: 'market-workspace-full',
    });
    navigate('signup-market');
  }, [navigate, patch, state.registered]);

  const value = useMemo<ClarityContextValue>(
    () => ({
      state,
      route,
      navigate,
      navigateToOverview,
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
      startNewMarketReport: () => {
        patch({
          marketCreateMode: true,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketGenerationStatus: 'idle',
        });
        navigate('market-workspace-new');
      },
      refreshMarketReport: () => {
        patch({
          marketCreateMode: false,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketGenerationStatus: 'idle',
        });
        navigate('market-workspace-new');
      },
      reviewMarketSnapshot: (reportId) => {
        // History view loads the snapshot payload before calling this with a resolved id.
        patch({ marketSnapshotId: reportId });
        navigate('market-workspace-result');
      },
      setMarketReportTab: (marketReportTab) => patch({ marketReportTab }),
      setMarketOpportunityView: (marketOpportunityView) =>
        patch({ marketOpportunityView, marketOpportunityDetail: null }),
      toggleMarketOpportunityDetail: (key) =>
        setState((prev) => ({
          ...prev,
          marketOpportunityDetail: prev.marketOpportunityDetail === key ? null : key,
        })),
      openMarketAction: (action) => {
        if (state.registered) {
          if (action === 'skills') {
            openSkillsFromMarket();
            return;
          }
          if (action === 'insights') {
            focusMarketInsights();
            return;
          }
          if (action === 'path') {
            navigate('prototype-new-account-2');
            return;
          }
          patch({ marketReportTab: action === 'recommendations' ? 'skills' : 'overview' });
          navigate('market-workspace-full');
          return;
        }
        patch({
          pendingGuest: 'market',
          tool: 'market',
          entryPoint: 'guest-market',
          marketGuestReady: true,
          marketReportTab:
            action === 'recommendations'
              ? 'skills'
              : action === 'path'
                ? 'opportunities'
                : 'overview',
          postAuthRoute:
            action === 'full' ? 'market-workspace-full' : 'market-workspace-result',
        });
        navigate('signup-market');
      },
      openFullMarketReport,
      openSkillsFromMarket,
      syncProfileToMarket,
    }),
    [
      state,
      route,
      navigate,
      navigateToOverview,
      patch,
      toast,
      clearToast,
      demoGo,
      demoMove,
      demoIndex,
      openSkillsFromMarket,
      focusMarketInsights,
      openFullMarketReport,
      syncProfileToMarket,
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
