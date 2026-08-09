import {
  dequeueJobAnalyzerJob,
  storeJobAnalyzerResult,
} from '../lib/jobAnalyzerQueue.js';
import { analyzeJobPosting } from '../services/job-analyzer/jobAnalyzerService.js';
import { createJobAnalysis } from '../services/job-analyzer/jobAnalysisPersistence.js';
import { emitToJob } from '../lib/websocket.js';

export async function processJobAnalyzerQueue(): Promise<void> {
  console.log('📋 Job analyzer queue processor started');

  while (true) {
    try {
      const job = await dequeueJobAnalyzerJob();
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      console.log(`🔄 Job analyzer processing ${job.id}`);
      try {
        const analyzed = await analyzeJobPosting({
          postingText: job.postingText,
          title: job.title,
          company: job.company,
          location: job.location,
          source: job.source,
          sourceUrl: job.sourceUrl,
          jobId: job.id,
        });

        let saved = false;
        let record = null;
        if (job.save && job.userId && job.userId !== 'guest') {
          record = await createJobAnalysis({
            analysisId: analyzed.analysisId,
            userId: job.userId,
            title: job.title || 'Untitled role',
            company: job.company,
            location: job.location,
            postingText: job.postingText,
            source: job.source,
            sourceUrl: job.sourceUrl,
            result: analyzed.result,
            metadata: analyzed.metadata,
          });
          saved = true;
        }

        const payload = {
          success: true,
          analysisId: analyzed.analysisId,
          result: analyzed.result,
          metadata: analyzed.metadata,
          saved,
          record,
          guestPreview: !saved,
        };

        await storeJobAnalyzerResult(job.id, payload);
        emitToJob(job.id, 'progress', {
          type: 'job_complete',
          jobId: job.id,
          ...payload,
        });
        console.log(`✅ Job analyzer ${job.id} completed`);
      } catch (error) {
        const err = error as Error;
        console.error(`❌ Job analyzer ${job.id} failed:`, err.message);
        emitToJob(job.id, 'progress', {
          type: 'job_error',
          jobId: job.id,
          error: err.message,
        });
        await storeJobAnalyzerResult(job.id, {
          success: false,
          error: err.message,
        });
      }
    } catch (error) {
      console.error('Job analyzer queue loop error:', error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
