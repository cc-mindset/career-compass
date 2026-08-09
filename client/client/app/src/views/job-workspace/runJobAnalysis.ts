import { isApiConfigured } from '../../lib/apiBase';
import { getClarityUserId } from '../../lib/clarityUserId';
import { getJobUploadFile } from '../../lib/jobUploadFile';
import {
  analyzeJobFromUrl,
  analyzeJobPosting,
  analyzeJobUpload,
  type AnalyzeJobResponse,
  type JobAnalyzerApiError,
} from '../../services/jobAnalyzer/api';
import type { JobInfo, JobLiveAnalysis, JobSource } from '../../types';

export type RunJobAnalysisInput = {
  source: JobSource;
  postingText: string;
  url?: string;
  file?: File | null;
  job: JobInfo;
  registered: boolean;
};

export type RunJobAnalysisResult =
  | { ok: true; analysis: JobLiveAnalysis; fromFixtures: false }
  | { ok: true; analysis: null; fromFixtures: true }
  | { ok: false; error: string; pasteFallback?: boolean };

const toLive = (response: AnalyzeJobResponse): JobLiveAnalysis => {
  if (!response.analysisId || !response.result || !response.metadata) {
    throw new Error('Incomplete analysis response');
  }
  return {
    analysisId: response.analysisId,
    result: response.result,
    metadata: response.metadata,
    saved: Boolean(response.saved),
  };
};

export async function runJobAnalysis(
  input: RunJobAnalysisInput,
): Promise<RunJobAnalysisResult> {
  if (!isApiConfigured()) {
    return { ok: true, analysis: null, fromFixtures: true };
  }

  const userId = input.registered ? getClarityUserId() : 'guest';
  const save = input.registered;

  try {
    let response: AnalyzeJobResponse;

    if (input.source === 'url') {
      if (!input.url?.trim()) {
        return {
          ok: false,
          error: 'Enter a public job URL, or switch to paste.',
          pasteFallback: true,
        };
      }
      response = await analyzeJobFromUrl({
        url: input.url.trim(),
        postingText: input.postingText,
        title: input.job.title,
        company: input.job.company,
        location: input.job.location,
        userId,
        save,
      });
    } else if (input.source === 'upload') {
      const file = input.file || getJobUploadFile() || undefined;
      if (!file) {
        return { ok: false, error: 'Choose a PDF, DOCX, or TXT posting file.' };
      }
      response = await analyzeJobUpload({
        file,
        title: input.job.title,
        company: input.job.company,
        location: input.job.location,
        userId,
        save,
      });
    } else {
      response = await analyzeJobPosting({
        postingText: input.postingText,
        title: input.job.title,
        company: input.job.company,
        location: input.job.location,
        userId,
        save,
        source: 'paste',
      });
    }

    return { ok: true, analysis: toLive(response), fromFixtures: false };
  } catch (error) {
    const err = error as JobAnalyzerApiError;
    return {
      ok: false,
      error: err.message || 'Job analysis failed',
      pasteFallback: err.pasteFallback,
    };
  }
}
