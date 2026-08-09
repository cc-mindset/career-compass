import express, { Request, Response } from 'express';
import multer from 'multer';
import {
  analyzeJobPosting,
  assertUsablePosting,
} from '../services/job-analyzer/jobAnalyzerService.js';
import {
  createJobAnalysis,
  getJobAnalysis,
  listJobAnalyses,
} from '../services/job-analyzer/jobAnalysisPersistence.js';
import {
  extractJobPostingText,
  fetchJobPostingFromUrl,
} from '../services/job-analyzer/jobPostingIngest.js';
import {
  enqueueJobAnalyzerJob,
  getJobAnalyzerQueueLength,
  getJobAnalyzerResult,
} from '../lib/jobAnalyzerQueue.js';
import type { JobIngestSource } from '../types/jobAnalyzer.js';

const jobAnalyzerRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
    ];
    const name = file.originalname.toLowerCase();
    if (
      allowed.includes(file.mimetype) ||
      name.endsWith('.pdf') ||
      name.endsWith('.docx') ||
      name.endsWith('.txt') ||
      name.endsWith('.md')
    ) {
      cb(null, true);
      return;
    }
    cb(new Error('Invalid file type. Only PDF, DOCX, or TXT are allowed.'));
  },
});

type AnalyzeBody = {
  postingText?: string;
  title?: string;
  company?: string;
  location?: string;
  workArrangement?: string;
  userId?: string;
  /** When true and userId is present (not guest), persist a new immutable record. */
  save?: boolean;
  source?: JobIngestSource;
  sourceUrl?: string;
};

async function runAnalyzeAndMaybeSave(params: {
  postingText: string;
  title?: string;
  company?: string;
  location?: string;
  workArrangement?: string;
  userId?: string;
  save?: boolean;
  source: JobIngestSource;
  sourceUrl?: string;
  jobId?: string;
}) {
  const analyzed = await analyzeJobPosting({
    postingText: params.postingText,
    title: params.title,
    company: params.company,
    location: params.location,
    source: params.source,
    sourceUrl: params.sourceUrl,
    jobId: params.jobId,
  });

  const shouldSave =
    Boolean(params.save) &&
    Boolean(params.userId) &&
    params.userId !== 'guest';

  let saved = null;
  if (shouldSave && params.userId) {
    saved = await createJobAnalysis({
      analysisId: analyzed.analysisId,
      userId: params.userId,
      title: params.title || 'Untitled role',
      company: params.company,
      location: params.location,
      workArrangement: params.workArrangement,
      postingText: params.postingText,
      source: params.source,
      sourceUrl: params.sourceUrl,
      result: analyzed.result,
      metadata: analyzed.metadata,
    });
  }

  return {
    success: true as const,
    analysisId: analyzed.analysisId,
    result: analyzed.result,
    metadata: analyzed.metadata,
    saved: Boolean(saved),
    record: saved,
    guestPreview: !shouldSave,
  };
}

/** Paste-based analyze (primary). */
jobAnalyzerRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const body = req.body as AnalyzeBody;
    let postingText: string;
    try {
      postingText = assertUsablePosting(body.postingText);
    } catch (error) {
      return res.status(400).json({
        error: error instanceof Error ? error.message : 'Invalid posting',
      });
    }

    const source: JobIngestSource = body.source || 'paste';
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const save = Boolean(body.save);

    const jobId = await enqueueJobAnalyzerJob({
      userId: userId || 'guest',
      postingText,
      title: body.title,
      company: body.company,
      location: body.location,
      source,
      sourceUrl: body.sourceUrl,
      save: save && userId !== '' && userId !== 'guest',
    });

    if (jobId) {
      const position = await getJobAnalyzerQueueLength();
      return res.json({
        success: true,
        queued: true,
        jobId,
        position,
        message: 'Job analysis queued for processing',
      });
    }

    const payload = await runAnalyzeAndMaybeSave({
      postingText,
      title: body.title,
      company: body.company,
      location: body.location,
      workArrangement: body.workArrangement,
      userId,
      save,
      source,
      sourceUrl: body.sourceUrl,
    });

    return res.json(payload);
  } catch (error) {
    const err = error as Error;
    console.error('Job analyzer analyze error:', err);
    return res.status(500).json({
      error: 'Failed to analyze job posting',
      message: err.message,
    });
  }
});

/** Upload job description document (distinct from résumé upload). */
jobAnalyzerRouter.post(
  '/analyze/upload',
  upload.single('posting'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No posting file uploaded' });
      }

      const postingText = await extractJobPostingText(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname,
      );

      try {
        assertUsablePosting(postingText);
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : 'Could not extract a usable job description from the file',
        });
      }

      const userId =
        typeof req.body.userId === 'string' ? req.body.userId : '';
      const save = req.body.save === 'true' || req.body.save === true;

      const payload = await runAnalyzeAndMaybeSave({
        postingText,
        title: req.body.title,
        company: req.body.company,
        location: req.body.location,
        workArrangement: req.body.workArrangement,
        userId,
        save,
        source: 'upload',
      });

      return res.json(payload);
    } catch (error) {
      const err = error as Error;
      console.error('Job analyzer upload error:', err);
      return res.status(500).json({
        error: 'Failed to analyze uploaded posting',
        message: err.message,
      });
    }
  },
);

/** Optional URL fetch with clear paste-fallback messaging. */
jobAnalyzerRouter.post('/analyze/url', async (req: Request, res: Response) => {
  try {
    const { url, title, company, location, workArrangement, userId, save } =
      req.body as AnalyzeBody & { url?: string };

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'url is required. Paste the job description instead if unavailable.',
      });
    }

    const fetched = await fetchJobPostingFromUrl(url);
    if (!fetched.ok) {
      return res.status(422).json({
        error: fetched.error,
        pasteFallback: true,
      });
    }

    try {
      assertUsablePosting(fetched.text);
    } catch (error) {
      return res.status(422).json({
        error:
          error instanceof Error
            ? error.message
            : 'Could not extract a usable posting. Paste the job description instead.',
        pasteFallback: true,
      });
    }

    const uid = typeof userId === 'string' ? userId : '';
    const payload = await runAnalyzeAndMaybeSave({
      postingText: fetched.text,
      title,
      company,
      location,
      workArrangement,
      userId: uid,
      save: Boolean(save),
      source: 'url',
      sourceUrl: url,
    });

    return res.json(payload);
  } catch (error) {
    const err = error as Error;
    console.error('Job analyzer URL error:', err);
    return res.status(500).json({
      error: 'Failed to analyze job URL',
      message: err.message,
      pasteFallback: true,
    });
  }
});

jobAnalyzerRouter.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const result = await getJobAnalyzerResult(req.params.jobId);
    if (result) {
      return res.json({ success: true, status: 'completed', ...result });
    }
    return res.json({
      success: true,
      status: 'processing',
      message: 'Job analysis is still processing',
    });
  } catch (error) {
    console.error('Job analyzer status error:', error);
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

/** List saved analyses for a user (no fabricated rows). */
jobAnalyzerRouter.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId || userId === 'guest') {
      return res.json({ success: true, analyses: [] });
    }
    const analyses = await listJobAnalyses(userId);
    return res.json({ success: true, analyses });
  } catch (error) {
    console.error('Job analyzer list error:', error);
    return res.status(500).json({ error: 'Failed to list analyses' });
  }
});

jobAnalyzerRouter.get(
  '/:userId/:analysisId',
  async (req: Request, res: Response) => {
    try {
      const { userId, analysisId } = req.params;
      const record = await getJobAnalysis(userId, analysisId);
      if (!record) {
        return res.status(404).json({ error: 'Analysis not found' });
      }
      return res.json({ success: true, record });
    } catch (error) {
      console.error('Job analyzer get error:', error);
      return res.status(500).json({ error: 'Failed to fetch analysis' });
    }
  },
);

/** Persist a preview analysis after account creation (immutable insert). */
jobAnalyzerRouter.post('/save', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      analysisId,
      title,
      company,
      location,
      workArrangement,
      postingText,
      source,
      sourceUrl,
      result,
      metadata,
    } = req.body;

    if (!userId || userId === 'guest') {
      return res.status(401).json({
        error: 'Account required to save a full job analysis',
      });
    }
    if (!analysisId || !result || !metadata || !postingText) {
      return res.status(400).json({
        error: 'analysisId, postingText, result, and metadata are required',
      });
    }

    const record = await createJobAnalysis({
      analysisId,
      userId,
      title: title || 'Untitled role',
      company,
      location,
      workArrangement,
      postingText,
      source: source || 'paste',
      sourceUrl,
      result,
      metadata,
    });

    return res.json({ success: true, record });
  } catch (error) {
    const err = error as Error;
    console.error('Job analyzer save error:', err);
    return res.status(500).json({
      error: 'Failed to save analysis',
      message: err.message,
    });
  }
});

export default jobAnalyzerRouter;
