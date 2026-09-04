/**
 * Evidence tab's 3 thematic groups — a FIXED 9-tag taxonomy (see
 * marketInsightsService_multipart.ts buildNewsAndCareerIntelPrompt). The
 * model only flags which of the fixed tags are substantively covered per
 * group; it never invents new tag names. Replaces the client's previous
 * mechanism of showing raw market_news headlines mislabeled under these
 * headings.
 */
export interface EvidenceLensCoverage {
    'Technology & regulation': string[];
    'Economy & industry': string[];
    'People & place': string[];
}

export interface CareerIntelData {
    report_sources: string[];
    evidence_lens_coverage?: EvidenceLensCoverage;
}