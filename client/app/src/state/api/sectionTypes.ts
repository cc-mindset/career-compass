export type SectionName = 'marketReport' | 'industryTrends' | 'newsAndCareerIntel';

export type SectionStatus = 'idle' | 'loading' | 'success' | 'error';

export interface SectionState<T = any> {
  status: SectionStatus;
  data?: T;
  error?: string;
}

export type SectionsState = Record<SectionName, SectionState>;

export interface WSProgressEvent {
  type: 'job_start' | 'section_success' | 'section_error' | 'job_complete' | 'job_error';
  jobId: string;
  section?: SectionName;
  data?: any;
  error?: string;
  stage?: string;
  completedSections?: string[];
  failedSections?: string[];
  insights?: any;
}
