import mongoose, { Document, Schema } from 'mongoose';
import type {
  JobAnalysisResult,
  JobAnalysisRunMetadata,
  JobIngestSource,
} from '../../types/jobAnalyzer.js';

export interface IJobAnalysis extends Document {
  analysisId: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  workArrangement?: string;
  postingText: string;
  source: JobIngestSource;
  sourceUrl?: string;
  result: JobAnalysisResult;
  metadata: JobAnalysisRunMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

const evidenceSchema = new Schema(
  {
    quote: { type: String, required: true },
    start: Number,
    end: Number,
  },
  { _id: false },
);

const statedSchema = new Schema(
  {
    category: {
      type: String,
      enum: ['required', 'preferred', 'other'],
      required: true,
    },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    evidence: { type: [evidenceSchema], default: [] },
  },
  { _id: false },
);

const hiddenSchema = new Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, required: true },
    implication: { type: String, required: true },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
    evidence: { type: [evidenceSchema], default: [] },
  },
  { _id: false },
);

const resultSchema = new Schema(
  {
    roleFocus: { type: String, required: true },
    roleFocusSummary: { type: String, required: true },
    statedRequirements: { type: [statedSchema], default: [] },
    hiddenExpectations: { type: [hiddenSchema], default: [] },
    questionsWorthAsking: { type: [String], default: [] },
  },
  { _id: false },
);

const metadataSchema = new Schema(
  {
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    analyzedAt: { type: String, required: true },
    source: {
      type: String,
      enum: ['paste', 'url', 'upload'],
      required: true,
    },
  },
  { _id: false },
);

const jobAnalysisSchema = new Schema<IJobAnalysis>(
  {
    analysisId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, default: '' },
    location: { type: String, default: '' },
    workArrangement: { type: String },
    postingText: { type: String, required: true },
    source: {
      type: String,
      enum: ['paste', 'url', 'upload'],
      required: true,
    },
    sourceUrl: { type: String },
    result: { type: resultSchema, required: true },
    metadata: { type: metadataSchema, required: true },
  },
  {
    timestamps: true,
    collection: 'job_analyses',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

jobAnalysisSchema.index({ userId: 1, createdAt: -1 });

export const JobAnalysis = mongoose.model<IJobAnalysis>(
  'JobAnalysis',
  jobAnalysisSchema,
);
