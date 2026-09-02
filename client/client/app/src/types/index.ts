export type Tool = 'pivot' | 'job' | 'market';
export type JobSource = 'paste' | 'url' | 'upload';
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
  | 'result'
  | 'market-auth-required'
  | 'market-report';

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

/** Live Job Analyzer payload stored after generate (guest preview or saved). */
export interface JobLiveAnalysis {
  analysisId: string;
  result: {
    roleFocus: string;
    roleFocusSummary: string;
    statedRequirements: Array<{
      category: 'required' | 'preferred' | 'other';
      title: string;
      summary: string;
      evidence: Array<{ quote: string }>;
    }>;
    hiddenExpectations: Array<{
      title: string;
      summary: string;
      implication: string;
      confidence: 'high' | 'medium' | 'low';
      evidence: Array<{ quote: string }>;
    }>;
    questionsWorthAsking: string[];
  };
  metadata: {
    model: string;
    promptVersion: string;
    analyzedAt: string;
    source: JobSource;
  };
  saved: boolean;
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
  industry: string;
  location: string;
  level: string;
  workPreference: string;
}

export type MarketReportTab = 'overview' | 'opportunities' | 'skills' | 'evidence';

export type MarketOpportunityView = 'roles' | 'sectors' | 'locations' | 'risks';

export type MarketGenerationStatus = 'idle' | 'generating' | 'streaming' | 'complete';

export interface ClarityState {
  tool: Tool;
  jobSource: JobSource;
  challenge: string;
  job: JobInfo;
  /** Full posting text supplied by the user (required for analysis). */
  jobPostingText: string;
  jobUrl: string;
  /** Display name of the selected upload file (actual File held in lib/jobUploadFile). */
  jobUploadFileName: string | null;
  /** Live analysis from /api/job-analyzer; null until generate succeeds. */
  jobLiveAnalysis: JobLiveAnalysis | null;
  jobLiveError: string | null;
  jobHasAnalyses: boolean;
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
  demoPanelOpen: boolean;
  toastMessage: string | null;
  /** Route to resume once the visitor signs in or creates an account. */
  postAuthRoute: ClarityRoute | null;
  marketHasReports: boolean;
  /** Set once a guest has generated an overview worth carrying into an account. */
  marketGuestReady: boolean;
  marketGuestSaved: boolean;
  /** Distinguishes creating a new report from refreshing the current one. */
  marketCreateMode: boolean;
  /** Non-null when viewing an archived snapshot rather than the current report. */
  marketSnapshotDate: string | null;
  marketReportTab: MarketReportTab;
  marketOpportunityView: MarketOpportunityView;
  /** `<view>-<index>` key of the expanded opportunity row, or null when all are collapsed. */
  marketOpportunityDetail: string | null;
  /** Live insights from POST /api/market-insights/generate; null until a live run succeeds. */
  marketLiveInsights: Record<string, unknown> | null;
  marketLiveError: string | null;
  /** Tracks in-flight market report generation for skeleton/streaming UI. */
  marketGenerationStatus: MarketGenerationStatus;
  /** When reviewing a prior snapshot, the snapshot report id (null = current latest). */
  marketSnapshotId: string | null;
}

export type ClarityRoute =
  | 'landing'
  | 'job-input'
  | 'job-review'
  | 'job-preview'
  | 'pivot-input'
  | 'pivot-preview'
  | 'market-input'
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
  | 'market-workspace-empty'
  | 'market-workspace-new'
  | 'market-workspace-generating'
  | 'market-workspace-result'
  | 'market-workspace-insights'
  | 'market-workspace-full'
  | 'market-workspace-snapshot'
  | 'market-workspace-history'
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
  | 'job-result'
  | 'market-empty'
  | 'market-profile'
  | 'market-generating'
  | 'market-result'
  | 'market-insights'
  | 'market-full'
  | 'market-history';
