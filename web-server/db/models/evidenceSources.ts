import mongoose, { Document, Schema } from "mongoose";
import { EvidenceSource } from "../../types/evidence";
import { LlmCacheStatus } from "../../constants/db";

/**
 * Cache of deterministic, retrieval-derived evidence sources for a Market
 * Report generation, keyed by the same vars_id used for the LLM section
 * caches (see dbCacheService). Persisted separately from those sections
 * because retrieval happens once per generation while sections can each be
 * cached/expire independently — and because it must survive on the fast
 * "all sections cached" path where no fresh retrieval happens at all.
 */
export interface IEvidenceSources extends Document {
  vars_id: string;
  data: EvidenceSource[];
  status: LlmCacheStatus;
  location: string;
  region: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const evidenceSourceSchema = new Schema<EvidenceSource>(
  {
    id: { type: String, required: true },
    namespace: { type: String, required: true },
    lens: { type: String, required: true },
    label: { type: String, required: true },
    sourceCode: { type: String, required: true },
    title: { type: String, required: false },
    publishedAt: { type: String, required: false },
  },
  { _id: false },
);

const evidenceSourcesSchema = new Schema<IEvidenceSources>(
  {
    location: { type: String, required: true },
    region: { type: String, required: true },
    data: { type: [evidenceSourceSchema], required: true, default: [] },
    vars_id: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: LlmCacheStatus,
      required: true,
      default: LlmCacheStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const LlmEvidenceSources = mongoose.model<IEvidenceSources>(
  "llm_evidence_sources",
  evidenceSourcesSchema,
);
export default LlmEvidenceSources;
