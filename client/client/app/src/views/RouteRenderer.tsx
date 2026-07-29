import React, { useEffect } from 'react';
import { useClarity } from '../state/contexts/ClarityContext';
import type { HomeMode, Tool, WorkState } from '../types';
import { SignInView, SignUpView } from './auth';
import { AccountProfileView, CareerProfileView } from './career-profile';
import { DashboardToolView, HomeView, SkillsMatchView } from './dashboard';
import {
  JobInputView,
  JobPreviewView,
  JobReviewView,
  MarketInputView,
  MarketPreviewView,
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
const TOOLS: Tool[] = ['pivot', 'job', 'market'];

const isTool = (value: string): value is Tool => TOOLS.includes(value as Tool);

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

  if (route.startsWith('dashboard-')) {
    const tool = route.replace('dashboard-', '');
    if (isTool(tool)) return <DashboardToolView tool={tool} />;
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
    case 'market-preview':
      return <MarketPreviewView />;
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
