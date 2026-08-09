import { JobAnalysis } from '../../db/models/jobAnalysis.js';
import type {
  JobAnalysisRecord,
  JobAnalysisResult,
  JobAnalysisRunMetadata,
  JobAnalysisSummary,
  JobIngestSource,
} from '../../types/jobAnalyzer.js';

export type PersistJobAnalysisInput = {
  analysisId: string;
  userId: string;
  title: string;
  company?: string;
  location?: string;
  workArrangement?: string;
  postingText: string;
  source: JobIngestSource;
  sourceUrl?: string;
  result: JobAnalysisResult;
  metadata: JobAnalysisRunMetadata;
};

const toRecord = (doc: {
  analysisId: string;
  userId: string;
  title: string;
  company?: string;
  location?: string;
  workArrangement?: string;
  postingText: string;
  source: JobIngestSource;
  sourceUrl?: string;
  result: JobAnalysisResult;
  metadata: JobAnalysisRunMetadata;
  createdAt?: Date;
}): JobAnalysisRecord => ({
  analysisId: doc.analysisId,
  userId: doc.userId,
  title: doc.title,
  company: doc.company || '',
  location: doc.location || '',
  workArrangement: doc.workArrangement,
  postingText: doc.postingText,
  source: doc.source,
  sourceUrl: doc.sourceUrl,
  result: doc.result,
  metadata: doc.metadata,
  createdAt: (doc.createdAt || new Date()).toISOString(),
});

/** Always insert — never overwrite prior analyses. */
export async function createJobAnalysis(
  input: PersistJobAnalysisInput,
): Promise<JobAnalysisRecord> {
  const existing = await JobAnalysis.findOne({ analysisId: input.analysisId });
  if (existing) {
    return toRecord(existing);
  }

  const doc = await JobAnalysis.create({
    analysisId: input.analysisId,
    userId: input.userId,
    title: input.title || 'Untitled role',
    company: input.company || '',
    location: input.location || '',
    workArrangement: input.workArrangement,
    postingText: input.postingText,
    source: input.source,
    sourceUrl: input.sourceUrl,
    result: input.result,
    metadata: input.metadata,
  });

  return toRecord(doc);
}

export async function listJobAnalyses(
  userId: string,
): Promise<JobAnalysisSummary[]> {
  const docs = await JobAnalysis.find({ userId })
    .sort({ createdAt: -1 })
    .select(
      'analysisId title company location createdAt result.hiddenExpectations',
    )
    .lean();

  return docs.map((doc) => ({
    analysisId: doc.analysisId,
    title: doc.title,
    company: doc.company || '',
    location: doc.location || '',
    createdAt: (doc.createdAt as Date).toISOString(),
    hiddenExpectationCount: Array.isArray(doc.result?.hiddenExpectations)
      ? doc.result.hiddenExpectations.length
      : 0,
  }));
}

export async function getJobAnalysis(
  userId: string,
  analysisId: string,
): Promise<JobAnalysisRecord | null> {
  const doc = await JobAnalysis.findOne({ userId, analysisId });
  return doc ? toRecord(doc) : null;
}
