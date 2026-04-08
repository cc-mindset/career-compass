import { logger } from './logger.js';

// MockDbCache — temp in-memory cache (location key + timestamp only, no insight data)
// SWAP GUIDE when DB is ready:
//   check()           → db.marketInsights.findOne({ location }) + TTL check
//   set()             → db.marketInsights.upsert({ location }, { generatedAt, insights })
//   invalidate()      → db.marketInsights.deleteOne({ location })
//   getMockInsights() → return real insights from DB
//   getMockFallback() → return last stored insights (stale-ok)

const CACHE_TTL_MS =
  parseInt(process.env.INSIGHTS_CACHE_TTL_HOURS || '24') * 60 * 60 * 1000;

interface CacheEntry {
  generatedAt: number;
}

export interface CacheStatus {
  hit: boolean;
  isLTS: boolean; // true = within TTL, safe to serve
}

class MockDbCache {
  private store: Map<string, CacheEntry>; // SWAP: DB collection reference

  constructor() {
    this.store = new Map();
  }

  private normalize(location: string): string {
    return location.toLowerCase().trim();
  }

  check(location: string): CacheStatus {
    const key = this.normalize(location);
    // SWAP: const doc = await db.marketInsights.findOne({ location: key });
    const entry = this.store.get(key);

    if (!entry) {
      logger.info(`📦 MockDbCache MISS: "${key}"`);
      return { hit: false, isLTS: false };
    }

    const isLTS = Date.now() - entry.generatedAt < CACHE_TTL_MS;
    logger.info(`📦 MockDbCache HIT: "${key}" — LTS=${isLTS}`);
    return { hit: true, isLTS };
  }

  set(location: string): void {
    const key = this.normalize(location);
    // SWAP: db.marketInsights.updateOne({ location: key }, { $set: { generatedAt, insights } }, { upsert: true })
    this.store.set(key, { generatedAt: Date.now() });
    logger.info(`📦 MockDbCache SET: "${key}"`);
  }

  invalidate(location: string): void {
    const key = this.normalize(location);
    this.store.delete(key);
    logger.info(`📦 MockDbCache INVALIDATED: "${key}"`);
  }

  // SWAP: return real insights object from DB
  getMockInsights(location: string): Record<string, unknown> {
    const loc = location.trim();
    return {
      // ── Metadata flags — FE can use these to show a "cached" badge ──
      _isMockCache: true,
      _cacheSource: 'mock_db_cache',
      _notice: `[MOCK CACHE] Showing cached data for "${loc}". Real DB integration pending — this will return stored insights once live.`,

      // ── Shape mirrors the real combined insights object ──
      market_report_summary_brief:
        `[MOCK CACHE — ${loc}] This is placeholder cached content. ` +
        `Once the database integration is complete, real previously-generated ` +
        `market insights for ${loc} will appear here.`,
      market_report_summary: {
        overview: `[MOCK CACHE — ${loc}] Real cached overview pending DB integration.`,
        summary_key_stats: {
          strongest_opportunity: 'Pending DB integration',
          highest_risk_sector: 'Pending DB integration',
          top_skill_demand: 'Pending DB integration',
          pivot_necessity: 'Moderate',
        },
      },
      labour_market_snapshot: {
        overview: `[MOCK CACHE — ${loc}] Snapshot data pending DB integration.`,
        local_vs_national: 'Pending DB integration.',
        major_drivers: [],
        market_health: {
          employment_rate: 'N/A (mock cache)',
          job_growth_rate: 'N/A (mock cache)',
          trend: 'Stable',
        },
      },
      city_vs_region_comparison: {
        title: `${loc} vs Broader Region (MOCK CACHE)`,
        data: [],
      },
      growth_sectors: [],
      at_risk_sectors: [],
      top_skills_demand: { title: `Top Skills — ${loc} (MOCK CACHE)`, categories: [] },
      market_risks: [],
      market_news: [],
      strategies_by_experience: {
        new_graduates: [`[MOCK CACHE — ${loc}] Real strategies pending DB integration.`],
        mid_career_pivoting: [`[MOCK CACHE — ${loc}] Real strategies pending DB integration.`],
        newcomers_international: [`[MOCK CACHE — ${loc}] Real strategies pending DB integration.`],
      },
      key_findings: [],
      report_sources: ['Mock cache — DB integration pending'],
    };
  }

  // SWAP: return last stored insights from DB (stale-ok)
  getMockFallback(location: string): Record<string, unknown> {
    const loc = location.trim();
    return {
      // ── Metadata flags — FE can use these to show a "degraded" banner ──
      _isFallback: true,
      _cacheSource: 'mock_db_fallback',
      _notice:
        `[FALLBACK] OpenAI is temporarily unavailable. Showing fallback data for "${loc}". ` +
        `Once DB integration is live, this will return the last known good insights instead.`,

      market_report_summary_brief:
        `[FALLBACK — ${loc}] Our AI service is currently at capacity or temporarily unavailable. ` +
        `Please try again in a few minutes. ` +
        `Once the database integration is complete, this will show the last known insights for ${loc}.`,
      market_report_summary: {
        overview: `[FALLBACK — ${loc}] Service temporarily unavailable. Please try again shortly.`,
        summary_key_stats: {
          strongest_opportunity: 'Service temporarily unavailable',
          highest_risk_sector: 'Service temporarily unavailable',
          top_skill_demand: 'Service temporarily unavailable',
          pivot_necessity: 'Unknown',
        },
      },
      labour_market_snapshot: {
        overview: `[FALLBACK — ${loc}] Service temporarily unavailable.`,
        local_vs_national: 'Service temporarily unavailable.',
        major_drivers: [],
        market_health: {
          employment_rate: 'N/A (fallback)',
          job_growth_rate: 'N/A (fallback)',
          trend: 'Unknown',
        },
      },
      city_vs_region_comparison: {
        title: `${loc} vs Broader Region (FALLBACK)`,
        data: [],
      },
      growth_sectors: [],
      at_risk_sectors: [],
      top_skills_demand: { title: `Top Skills — ${loc} (FALLBACK)`, categories: [] },
      market_risks: [],
      market_news: [],
      strategies_by_experience: {
        new_graduates: [`[FALLBACK — ${loc}] Service temporarily unavailable. Please try again later.`],
        mid_career_pivoting: [`[FALLBACK — ${loc}] Service temporarily unavailable. Please try again later.`],
        newcomers_international: [`[FALLBACK — ${loc}] Service temporarily unavailable. Please try again later.`],
      },
      key_findings: [],
      report_sources: ['Fallback content — service temporarily unavailable'],
    };
  }

  // SWAP: db.marketInsights.find({})
  listAll(): Array<{ location: string; generatedAt: Date; ageHours: number; isLTS: boolean }> {
    const now = Date.now();
    return Array.from(this.store.entries()).map(([location, entry]) => ({
      location,
      generatedAt: new Date(entry.generatedAt),
      ageHours: parseFloat(((now - entry.generatedAt) / (1000 * 60 * 60)).toFixed(2)),
      isLTS: now - entry.generatedAt < CACHE_TTL_MS,
    }));
  }
}

// Singleton
export const mockDbCache = new MockDbCache();
