export type Tool = 'pivot' | 'job' | 'market';
export type JobSource = 'paste' | 'url' | 'upload';
export type ThemePreference = 'light' | 'dark' | 'system';
export type WorkState = 'none' | 'unfinished' | 'completed';
export type ProfileOrigin = 'profile' | 'pivot' | 'skills';
export type ProfileSource = 'linkedin' | 'resume' | 'manual';
export type PendingGuest = Tool | null;
export type EntryPoint =
  | 'landing'
  | 'guest-pivot'
  | 'guest-job'
  | 'guest-market'
  | 'dashboard'
  | 'direct-signup'
  | 'signin'
  | 'result';

export type HomeMode =
  | 'new'
  | 'returning'
  | 'returning-none'
  | 'returning-complete';

export interface JobInfo {
  title: string;
  company: string;
  location: string;
}

export interface PivotInfo {
  title: string;
  industry: string;
  experience: string;
  location: string;
  goal: string;
  skills: string[];
}

export interface MarketInfo {
  role: string;
  location: string;
  level: string;
}

export interface ClarityState {
  tool: Tool;
  jobSource: JobSource;
  challenge: string;
  job: JobInfo;
  pivot: PivotInfo;
  market: MarketInfo;
  registered: boolean;
  profileModal: boolean;
  profilePageStep: number;
  profileOrigin: ProfileOrigin;
  profileSource: ProfileSource;
  profileComplete: boolean;
  manualEditor: boolean;
  manualExperienceSaved: boolean;
  entryPoint: EntryPoint;
  workState: WorkState;
  pendingGuest: PendingGuest;
  accountMenuOpen: boolean;
  signoutConfirm: boolean;
  theme: ThemePreference;
  demoPanelOpen: boolean;
  toastMessage: string | null;
}

export type ClarityRoute =
  | 'landing'
  | 'job-input'
  | 'job-review'
  | 'job-preview'
  | 'pivot-input'
  | 'pivot-preview'
  | 'market-input'
  | 'market-preview'
  | 'signin'
  | 'signup'
  | 'dashboard-home'
  | 'dashboard-returning'
  | 'dashboard-returning-none'
  | 'dashboard-returning-complete'
  | 'dashboard-new'
  | 'dashboard-job'
  | 'dashboard-pivot'
  | 'dashboard-market'
  | 'career-profile'
  | 'account-profile'
  | 'skills-match'
  | 'job-workspace-empty'
  | 'job-workspace-history'
  | 'job-workspace-new'
  | 'job-workspace-review'
  | 'job-workspace-result'
  | `signup-${string}`
  | `prototype-new-account-${number}`
  | 'how'
  | 'tools'
  | 'why'
  | 'pricing';

export type DemoStateKey =
  | 'landing'
  | 'signup'
  | 'new'
  | 'none'
  | 'unfinished'
  | 'complete'
  | 'guest-pivot'
  | 'saved-pivot'
  | 'pivot-profile'
  | 'guest-job'
  | 'saved-job'
  | 'guest-market'
  | 'saved-market'
  | 'profile'
  | 'skills-gated'
  | 'skills-ready'
  | 'job-empty'
  | 'job-history'
  | 'job-new'
  | 'job-review'
  | 'job-result';
