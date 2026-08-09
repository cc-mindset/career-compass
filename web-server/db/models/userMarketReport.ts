import mongoose, { Document, Schema } from 'mongoose';

/** Shared fields for a user-owned Market Report payload. */
export interface IMarketReportInputs {
  role: string;
  level: string;
  location: string;
  industry: string;
}

export interface IUserMarketReportLatest extends Document {
  userId: string;
  reportId: string;
  role: string;
  level: string;
  location: string;
  industry: string;
  insights: Record<string, unknown>;
  generatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserMarketReportSnapshot extends Document {
  userId: string;
  reportId: string;
  role: string;
  level: string;
  location: string;
  industry: string;
  insights: Record<string, unknown>;
  /** Original generation time of the report that was snapshotted. */
  generatedAt: Date;
  snapshottedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const insightsSchema = {
  type: Schema.Types.Mixed,
  required: true,
};

const latestSchema = new Schema<IUserMarketReportLatest>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    reportId: { type: String, required: true },
    role: { type: String, required: true },
    level: { type: String, required: true },
    location: { type: String, required: true },
    industry: { type: String, required: true, default: '' },
    insights: insightsSchema,
    generatedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'user_market_report_latest',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const snapshotSchema = new Schema<IUserMarketReportSnapshot>(
  {
    userId: { type: String, required: true, index: true },
    reportId: { type: String, required: true, unique: true },
    role: { type: String, required: true },
    level: { type: String, required: true },
    location: { type: String, required: true },
    industry: { type: String, required: true, default: '' },
    insights: insightsSchema,
    generatedAt: { type: Date, required: true },
    snapshottedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'user_market_report_snapshots',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

snapshotSchema.index({ userId: 1, generatedAt: -1 });

export const UserMarketReportLatest = mongoose.model<IUserMarketReportLatest>(
  'UserMarketReportLatest',
  latestSchema,
);

export const UserMarketReportSnapshot = mongoose.model<IUserMarketReportSnapshot>(
  'UserMarketReportSnapshot',
  snapshotSchema,
);
