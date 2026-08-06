import React, { useEffect, useRef } from 'react';
import { useClarity } from '../state/contexts/ClarityContext';
import type { HomeMode, Tool, WorkState } from '../types';
import { SignInView, SignUpView } from './auth';
import { AccountProfileView, CareerProfileView } from './career-profile';
import { DashboardToolView, HomeView, SkillsMatchView } from './dashboard';
import {
  MarketWorkspaceEmptyView,
  MarketWorkspaceFullReportView,
  MarketWorkspaceGeneratingView,
  MarketWorkspaceHistoryView,
  MarketWorkspaceInsightsView,
  MarketWorkspaceNewView,
  MarketWorkspaceResultView,
} from './market-workspace';
import {
  JobInputView,
  JobPreviewView,
  JobReviewView,
  MarketInputView,
  PivotInputView,
  PivotPreviewView,
} from './guest';
import {
  JobWorkspaceEmptyView,
  JobWorkspaceHistoryView,
  JobWorkspaceNewView,
  JobWorkspaceResultView,
  JobWorkspaceReviewView,
} from './job-workspace';
import { LandingView } from './landing';
import { NewAccountStepView } from './new-account';

const LANDING_ANCHORS = ['how', 'tools', 'why', 'pricing'];

/** `dashboard-market` is handled by the Market Report workspace routes instead. */
type DashboardTool = Exclude<Tool, 'market'>;

const DASHBOARD_TOOLS: DashboardTool[] = ['pivot', 'job'];

const isDashboardTool = (value: string): value is DashboardTool =>
  DASHBOARD_TOOLS.includes(value as DashboardTool);

const homeModeFor = (workState: WorkState): HomeMode =>
  workState === 'completed'
    ? 'returning-complete'
    : workState === 'none'
      ? 'returning-none'
      : 'returning';

/** `#how`, `#tools`, `#why` and `#pricing` render the landing page scrolled to a section. */
const LandingSection: React.FC<{ anchor: string }> = ({ anchor }) => {
  useEffect(() => {
    const id = anchor === 'pricing' ? 'tools' : anchor;
    const timer = window.setTimeout(
      () => document.getElementById(id)?.scrollIntoView(),
      20,
    );
    return () => window.clearTimeout(timer);
  }, [anchor]);
  return <LandingView />;
};

const clampStep = (raw: string): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(8, Math.floor(parsed));
};

/** The guest overview is the only Market Report screen reachable without an account. */
const GUEST_MARKET_ROUTES = ['market-workspace-result'];

const isMarketRoute = (route: string): boolean =>
  route === 'dashboard-market' || route.startsWith('market-workspace-');

/**
 * Sends visitors to sign-in when they reach a gated Market Report screen, remembering the
 * guest overview so it reopens once they have an account.
 */
const MarketAuthGate: React.FC = () => {
  const { state, patch, toast } = useClarity();
  const announced = useRef(false);
  const { marketGuestReady } = state;

  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    patch({
      entryPoint: 'market-auth-required',
      pendingGuest: marketGuestReady ? 'market' : null,
      postAuthRoute: marketGuestReady ? 'market-workspace-result' : null,
    });
    toast('Sign in or create an account to access Market Report.');
  }, [marketGuestReady, patch, toast]);

  return <SignInView />;
};

const MarketRoute: React.FC<{ route: string }> = ({ route }) => {
  const { state } = useClarity();

  if (route === 'dashboard-market') {
    return state.marketHasReports ? (
      <MarketWorkspaceHistoryView />
    ) : (
      <MarketWorkspaceEmptyView />
    );
  }

  switch (route) {
    case 'market-workspace-empty':
      return <MarketWorkspaceEmptyView />;
    case 'market-workspace-new':
      return <MarketWorkspaceNewView />;
    case 'market-workspace-generating':
      return <MarketWorkspaceGeneratingView />;
    case 'market-workspace-insights':
      return <MarketWorkspaceInsightsView />;
    case 'market-workspace-full':
      return <MarketWorkspaceFullReportView />;
    case 'market-workspace-history':
      return <MarketWorkspaceHistoryView />;
    default:
      return <MarketWorkspaceResultView />;
  }
};

export const RouteRenderer: React.FC = () => {
  const { route, state } = useClarity();

  if (LANDING_ANCHORS.includes(route)) return <LandingSection anchor={route} />;

  if (route.startsWith('signup-')) {
    return <SignUpView mode={route.replace('signup-', '')} />;
  }

  if (route.startsWith('prototype-new-account-')) {
    return (
      <NewAccountStepView step={clampStep(route.replace('prototype-new-account-', ''))} />
    );
  }

  if (isMarketRoute(route)) {
    if (!state.registered && !GUEST_MARKET_ROUTES.includes(route)) {
      return <MarketAuthGate />;
    }
    return <MarketRoute route={route} />;
  }

  if (route.startsWith('dashboard-')) {
    const tool = route.replace('dashboard-', '');
    if (isDashboardTool(tool)) return <DashboardToolView tool={tool} />;
  }

  switch (route) {
    case 'job-input':
      return <JobInputView />;
    case 'job-review':
      return <JobReviewView />;
    case 'job-preview':
      return <JobPreviewView />;
    case 'pivot-input':
      return <PivotInputView />;
    case 'pivot-preview':
      return <PivotPreviewView />;
    case 'market-input':
      return <MarketInputView />;
    case 'signin':
      return <SignInView />;
    case 'signup':
      return <SignUpView mode="new" />;
    case 'dashboard-home':
      return <HomeView mode={homeModeFor(state.workState)} />;
    case 'dashboard-returning':
      return <HomeView mode="returning" />;
    case 'dashboard-returning-none':
      return <HomeView mode="returning-none" />;
    case 'dashboard-returning-complete':
      return <HomeView mode="returning-complete" />;
    case 'dashboard-new':
      return <HomeView mode="new" />;
    case 'career-profile':
      return <CareerProfileView />;
    case 'account-profile':
      return <AccountProfileView />;
    case 'skills-match':
      return <SkillsMatchView />;
    case 'job-workspace-empty':
      return <JobWorkspaceEmptyView />;
    case 'job-workspace-history':
      return <JobWorkspaceHistoryView />;
    case 'job-workspace-new':
      return <JobWorkspaceNewView />;
    case 'job-workspace-review':
      return <JobWorkspaceReviewView />;
    case 'job-workspace-result':
      return <JobWorkspaceResultView />;
    default:
      return <LandingView />;
  }
};
