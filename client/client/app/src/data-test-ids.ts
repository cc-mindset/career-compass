/** Stable selectors for Playwright — prefer these over marketing copy. */
export const testIds = {
  landingHero: 'landing-hero',
  toolsSection: 'tools-section',
  toolCard: (tool: 'pivot' | 'job' | 'market') => `tool-card-${tool}`,
  startToolCta: 'start-tool-cta',
  jobSource: (source: 'paste' | 'url' | 'upload') => `job-source-${source}`,
  jobPasteTextarea: 'job-paste-textarea',
  jobUploadDropzone: 'job-upload-dropzone',
  jobReviewContinue: 'job-review-continue',
  marketWorkspace: 'market-input-workspace',
  marketGenerateCta: 'market-generate-cta',
  jobWorkspace: 'job-input-workspace',
} as const;
