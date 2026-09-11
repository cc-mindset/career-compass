import React, { useEffect, useState } from 'react';
import { AnimatedLoader } from '../../components/AnimatedLoader';
import { MarketOverviewSkeleton } from '../../components/MarketOverviewSkeleton';
import { DashboardShell } from '../../components/DashboardShell';
import { SelectField } from '../../components/forms';
import { JourneyHeader, Progress } from '../../components/layout';
import { INDUSTRY_OPTIONS, LOCATION_OPTIONS, ROLE_OPTIONS } from '../../consts';
import { testIds } from '../../data-test-ids';
import { useClarity } from '../../state/contexts/ClarityContext';
import type { MarketOpportunityView, MarketReportTab } from '../../types';
import {
  CAPABILITIES,
  EVIDENCE_GROUPS,
  EVIDENCE_SOURCES,
  FOCUS_WEEKS,
  GUEST_SHIFTS,
  MARKET_INSIGHTS,
  MARKET_OPPORTUNITIES,
  MARKET_SIGNAL_ROWS,
  OPPORTUNITY_ACTION_LABELS,
  OPPORTUNITY_HEADINGS,
  OPPORTUNITY_VIEWS,
  SENIORITY_OPTIONS,
  type OpportunityGroup,
} from './data';
import { runMarketReportGeneration } from './runMarketReportGeneration';
import { useAdaptedMarketReport } from './useAdaptedMarketReport';
import type { AdaptedHiringTrendPoint, AdaptedMarketReport } from '../../services/marketInsights/types';
import { useMarketOverviewUiState } from './useMarketOverviewUiState';
import { getClarityUserId } from '../../lib/clarityUserId';
import {
  fetchLatestUserMarketReport,
  fetchUserMarketReportSnapshot,
  formatReportDate,
  listUserMarketReports,
  saveUserMarketReport,
  type MarketReportSummary,
} from '../../services/marketReports/historyApi';

/** Labels for in-flight steps, where offering "Create new report" would be confusing. */
const FLOW_LABELS = ['New report', 'Update report', 'Preparing report'];

const cityOnly = (location: string): string => location.replace(', Canada', '');

/** Avoids "Senior Senior Product Manager" when the role title already carries the level. */
const reportRoleTitle = (level: string, role: string): string =>
  `${level} ${role}`.replace('Senior Senior', 'Senior');

interface ShellProps {
  label: string;
  children: React.ReactNode;
}

const MarketWorkspaceShell: React.FC<ShellProps> = ({ label, children }) => {
  const { startNewMarketReport } = useClarity();

  return (
    <DashboardShell
      title="Market Report"
      subtitle={label}
      activeNav="market"
      headActions={
        FLOW_LABELS.includes(label) ? null : (
          <button type="button" className="btn primary" onClick={startNewMarketReport}>
            Create new report
          </button>
        )
      }
    >
      {children}
    </DashboardShell>
  );
};

/**
 * Registered users see the report inside the dashboard; guests see it inside the guest
 * journey with an unlock panel alongside.
 */
const MarketWorkspaceFrame: React.FC<ShellProps> = ({ label, children }) => {
  const { state, navigate } = useClarity();

  if (state.registered) {
    return <MarketWorkspaceShell label={label}>{children}</MarketWorkspaceShell>;
  }

  return (
    <>
      <JourneyHeader />
      <main className="view">
        <div className="shell">
          <Progress active={1} names={['Your market', 'Guest overview']} />
          <div className="previewbar">
            <div>
              <b>Your Market Report overview is ready</b>
              <br />
              <span>Explore your first result before creating an account.</span>
            </div>
            <span className="guesttag">Guest workspace</span>
          </div>
          <section className="workspace">
            <div className="body">
              <div className="resultlayout">
                <div className="resultmain">{children}</div>
                <aside className="sidepanel">
                  <div className="unlock">
                    <span className="label">Save and continue</span>
                    <h3>Unlock your complete Market Report</h3>
                    <p>
                      Your market inputs and this overview will carry into your dashboard
                      without asking the same questions again.
                    </p>
                    <ul>
                      <li>Full opportunities and role outlook</li>
                      <li>Prioritized skills and actions</li>
                      <li>Evidence, sources and confidence</li>
                      <li>Saved reports you can refresh later</li>
                    </ul>
                    <button
                      type="button"
                      className="btn primary full"
                      onClick={() => navigate('signup-market')}
                    >
                      Create free account →
                    </button>
                    <button
                      type="button"
                      className="btn ghost full"
                      onClick={() => navigate('signin')}
                    >
                      I already have an account
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
};

export const MarketWorkspaceNewView: React.FC = () => {
  const { state, patch, navigate, syncProfileToMarket } = useClarity();

  useEffect(() => {
    syncProfileToMarket();
  }, [syncProfileToMarket]);

  const creatingNew = !state.marketHasReports || state.marketCreateMode;
  const cancelTarget = state.marketHasReports ? 'market-workspace-history' : 'dashboard-home';

  return (
    <MarketWorkspaceShell label={creatingNew ? 'New report' : 'Update report'}>
      <div className="mrWorkspace">
        <div className="mrPageHead">
          <div>
            <h1>{creatingNew ? 'Create a new Market Report' : 'Refresh your market view'}</h1>
            <p>Choose a role, level and location.</p>
          </div>
          {state.marketHasReports ? (
            <a
              className="btn secondary"
              href="#market-workspace-history"
              onClick={(event) => {
                event.preventDefault();
                navigate('market-workspace-history');
              }}
            >
              Back to reports
            </a>
          ) : null}
        </div>
        <section className="mrSetup">
          <div className="mrSetupGrid">
            <SelectField
              label={
                <>
                  Role or career area <small>Required</small>
                </>
              }
              value={state.market.role}
              options={ROLE_OPTIONS}
              onChange={(role) => patch({ market: { ...state.market, role } })}
            />
            <SelectField
              label={
                <>
                  Industry or function <small>Required</small>
                </>
              }
              value={state.market.industry}
              options={INDUSTRY_OPTIONS}
              onChange={(industry) => patch({ market: { ...state.market, industry } })}
            />
            <SelectField
              label={
                <>
                  Seniority <small>Required</small>
                </>
              }
              value={state.market.level}
              options={SENIORITY_OPTIONS}
              onChange={(level) => patch({ market: { ...state.market, level } })}
            />
            <SelectField
              label={
                <>
                  City, region or country <small>Required</small>
                </>
              }
              value={state.market.location}
              options={LOCATION_OPTIONS}
              onChange={(location) => patch({ market: { ...state.market, location } })}
            />
          </div>
          <div className="mrSetupFoot">
            <a
              className="btn secondary"
              href={`#${cancelTarget}`}
              onClick={(event) => {
                event.preventDefault();
                navigate(cancelTarget);
              }}
            >
              Cancel
            </a>
            <a
              className="btn primary"
              href="#market-workspace-generating"
              onClick={(event) => {
                event.preventDefault();
                navigate('market-workspace-generating');
              }}
            >
              {creatingNew ? 'Generate report' : 'Refresh report'} →
            </a>
          </div>
        </section>
      </div>
    </MarketWorkspaceShell>
  );
};

/** No saved reports yet, so the workspace opens directly on the setup form. */
export const MarketWorkspaceEmptyView: React.FC = () => {
  const { state, patch } = useClarity();

  useEffect(() => {
    if (state.marketHasReports || state.marketSnapshotDate || state.marketSnapshotId) {
      patch({
        marketHasReports: false,
        marketSnapshotDate: null,
        marketSnapshotId: null,
      });
    }
  }, [
    patch,
    state.marketHasReports,
    state.marketSnapshotDate,
    state.marketSnapshotId,
  ]);

  return <MarketWorkspaceNewView />;
};

export const MarketWorkspaceGeneratingView: React.FC = () => {
  const { state, patch, navigate, navigateToOverview, toast } = useClarity();
  const [progress, setProgress] = useState(8);
  const [statusMessage, setStatusMessage] = useState('Preparing your report');

  useEffect(() => {
    let cancelled = false;
    const overviewShown = { current: false };

    const run = async () => {
      patch({ marketGenerationStatus: 'generating' });
      const userId = state.registered ? getClarityUserId() : 'guest';
      const result = await runMarketReportGeneration(
        state.market,
        {
          onProgress: (update) => {
            if (cancelled) return;
            setProgress(Math.max(8, Math.min(100, Math.round(update.percent))));
            if (update.message) setStatusMessage(update.message);
          },
          onOverviewReady: (insights) => {
            if (cancelled || overviewShown.current) return;
            overviewShown.current = true;
            navigateToOverview(insights);
          },
          onInsightsUpdate: (insights) => {
            if (cancelled) return;
            patch({ marketLiveInsights: insights });
          },
        },
        { userId },
      );

      if (cancelled) return;

      if (result.ok && !result.fromFixtures) {
        // Guard against React StrictMode's double effect-invocation in dev (and any
        // other stale-closure re-entry): only the still-current run should persist.
        // Previously this call was unguarded, so both invocations saved concurrently
        // and raced on the server's snapshot-insert (see createUserMarketReport).
        if (state.registered && !cancelled) {
          try {
            setStatusMessage('Saving to your history');
            await saveUserMarketReport({
              userId: getClarityUserId(),
              role: state.market.role,
              level: state.market.level,
              location: state.market.location,
              industry: state.market.industry,
              insights: result.insights,
            });
          } catch (error) {
            if (!cancelled) {
              const message =
                error instanceof Error ? error.message : 'Could not save report history';
              toast(message);
            }
          }
        }

        if (cancelled) return;

        patch({
          marketHasReports: true,
          marketCreateMode: false,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketLiveInsights: result.insights,
          marketLiveError: null,
          marketGenerationStatus: 'complete',
        });
      } else if (result.ok) {
        patch({
          marketHasReports: true,
          marketCreateMode: false,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketLiveError: null,
          marketGenerationStatus: 'idle',
        });
      } else {
        toast(result.error);
        patch({
          marketHasReports: true,
          marketCreateMode: false,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketLiveError: result.error,
          marketGenerationStatus: 'idle',
        });
      }

      if (!overviewShown.current) {
        setProgress(100);
        setStatusMessage('Your report is ready');
        window.setTimeout(() => {
          if (!cancelled) navigate('market-workspace-result');
        }, 450);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, navigateToOverview, patch, state.market, state.registered, toast]);

  const complete = progress >= 100;

  return (
    <MarketWorkspaceShell label="Preparing report">
      <div className="mrWorkspace">
        <section className="mrLoader">
          <div className="mrLoaderInner">
            <AnimatedLoader />
            <small
              role="progressbar"
              aria-label="Market Report generation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              {progress}%
            </small>
            <h1>{complete ? 'Your report is ready' : statusMessage}</h1>
            <p>
              {state.market.role} · {state.market.level} · {state.market.location}
            </p>
          </div>
        </section>
      </div>
    </MarketWorkspaceShell>
  );
};

const PreviousReports: React.FC<{
  snapshots: MarketReportSummary[];
  onReview: (reportId: string) => void;
  loading?: boolean;
}> = ({ snapshots, onReview, loading }) => {
  if (loading) {
    return (
      <section className="mrArchive" aria-label="Previous market reports">
        <div className="mrArchiveHead">
          <h2>Previous reports</h2>
        </div>
        <AnimatedLoader size="compact" />
        <span>Loading…</span>
      </section>
    );
  }

  if (snapshots.length === 0) {
    return null;
  }

  return (
    <section className="mrArchive" aria-label="Previous market reports">
      <div className="mrArchiveHead">
        <h2>Previous reports</h2>
        <span>Earlier snapshots</span>
      </div>
      <div className="mrArchiveList">
        {snapshots.map((report) => (
          <div key={report.reportId} className="mrArchiveRow">
            <div>
              <b>
                {report.role} · {cityOnly(report.location)}
              </b>
              <p>
                {report.industry || 'Any industry'} · {formatReportDate(report.generatedAt)}
              </p>
            </div>
            <button
              type="button"
              className="reviewAction"
              onClick={() => onReview(report.reportId)}
            >
              Review →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export const MarketWorkspaceHistoryView: React.FC = () => {
  const { state, patch, navigate, refreshMarketReport, toast } = useClarity();
  const live = useAdaptedMarketReport();
  const [latest, setLatest] = useState<MarketReportSummary | null>(null);
  const [snapshots, setSnapshots] = useState<MarketReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const list = await listUserMarketReports(getClarityUserId());
        if (cancelled) return;

        if (!list.latest) {
          patch({
            marketHasReports: false,
            marketSnapshotDate: null,
            marketSnapshotId: null,
          });
          navigate('market-workspace-empty');
          return;
        }

        setLatest(list.latest);
        setSnapshots(list.snapshots);
        patch({
          marketHasReports: true,
          marketSnapshotDate: null,
          marketSnapshotId: null,
        });

        // Hydrate current insights from latest if client state is empty
        if (!state.marketLiveInsights) {
          const detail = await fetchLatestUserMarketReport(getClarityUserId());
          if (cancelled || !detail) return;
          patch({
            marketLiveInsights: detail.insights,
            market: {
              ...state.market,
              role: detail.role,
              level: detail.level,
              location: detail.location,
              industry: detail.industry || state.market.industry,
            },
          });
        }
      } catch (error) {
        if (!cancelled) {
          toast(error instanceof Error ? error.message : 'Could not load report history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
    // Intentionally load once on mount / when entering history
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onReview = async (reportId: string) => {
    try {
      const snapshot = await fetchUserMarketReportSnapshot(getClarityUserId(), reportId);
      if (!snapshot) {
        toast('Snapshot not found');
        return;
      }
      patch({
        marketSnapshotId: snapshot.reportId,
        marketSnapshotDate: formatReportDate(snapshot.generatedAt),
        marketLiveInsights: snapshot.insights,
        market: {
          ...state.market,
          role: snapshot.role,
          level: snapshot.level,
          location: snapshot.location,
          industry: snapshot.industry || state.market.industry,
        },
      });
      navigate('market-workspace-result');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not open snapshot');
    }
  };

  const current = latest;
  const signals = live?.signals.slice(0, 3) ?? [];

  return (
    <MarketWorkspaceShell label="Reports">
      <div className="mrWorkspace">
        <div className="mrPageHead">
          <div>
            <h1>Market Report</h1>
            <p>Track how demand is changing for your role and location.</p>
          </div>
          <button type="button" className="btn secondary" onClick={refreshMarketReport}>
            Refresh current report
          </button>
        </div>
        {loading ? (
          <section className="mrCurrent">
            <div style={{ textAlign: 'center' }}>
              <AnimatedLoader size="compact" />
              <small>Loading your reports…</small>
            </div>
          </section>
        ) : current ? (
          <>
            <section className="mrCurrent">
              <div>
                <small>
                  Current report · {formatReportDate(current.generatedAt)}
                </small>
                <h2>
                  {current.role} in {current.location}
                </h2>
                <p>
                  {current.level} · {current.industry || 'Any industry'}
                </p>
                <div className="mrActions">
                  <a
                    className="btn"
                    href="#market-workspace-result"
                    onClick={async (event) => {
                      event.preventDefault();
                      try {
                        const detail = await fetchLatestUserMarketReport(getClarityUserId());
                        if (detail) {
                          patch({
                            marketSnapshotId: null,
                            marketSnapshotDate: null,
                            marketLiveInsights: detail.insights,
                            market: {
                              ...state.market,
                              role: detail.role,
                              level: detail.level,
                              location: detail.location,
                              industry: detail.industry || state.market.industry,
                            },
                          });
                        } else {
                          patch({ marketSnapshotId: null, marketSnapshotDate: null });
                        }
                      } catch {
                        patch({ marketSnapshotId: null, marketSnapshotDate: null });
                      }
                      navigate('market-workspace-result');
                    }}
                  >
                    Review report →
                  </a>
                </div>
              </div>
              <div className="mrCurrentStats">
                {(signals.length
                  ? signals
                  : [
                      { label: 'Demand', value: '—' },
                      { label: 'Outlook', value: '—' },
                      { label: 'Focus', value: '—' },
                    ]
                ).map((signal) => (
                  <div key={signal.label} className="mrCurrentStat">
                    <strong>{signal.value}</strong>
                    <span>{signal.label}</span>
                  </div>
                ))}
              </div>
            </section>
            <PreviousReports snapshots={snapshots} onReview={onReview} />
          </>
        ) : null}
      </div>
    </MarketWorkspaceShell>
  );
};

const MarketInsightList: React.FC = () => {
  const live = useAdaptedMarketReport();
  const { showShiftSkeleton, useFixtures } = useMarketOverviewUiState();

  if (showShiftSkeleton) {
    return (
      <MarketOverviewSkeleton variant="registered" hero={false} signals={false} shifts />
    );
  }

  // Was: mapped live.shifts (capped at 3) with the same meaning/action text
  // repeated across every item. live.insights (derived in adapter.ts from
  // shifts + growth_sectors + at_risk_sectors + priority_capabilities) now
  // provides up to 10 genuinely distinct items.
  const insights = useFixtures
    ? MARKET_INSIGHTS
    : live?.insights.length
      ? live.insights
      : MARKET_INSIGHTS;

  return (
    <div className="marketInsightList">
      {insights.map((insight, index) => (
        <details
          key={insight.title}
          className="marketInsightDetail"
          open={index === 0}
        >
          <summary>
            <span className="shiftNumber">{index + 1}</span>
            <span className="marketInsightTitle">
              <b>{insight.title}</b>
              <small>{insight.summary}</small>
            </span>
            <span className="insightCategory">{insight.category}</span>
            <span className="insightChevron">›</span>
          </summary>
          <div className="marketInsightBody">
            <div>
              <small>What this means for you</small>
              <p>{insight.meaning}</p>
            </div>
            <div>
              <small>Recommended action</small>
              <p>{insight.action}</p>
            </div>
            <div>
              <small>Source and data period</small>
              <p>{insight.source}</p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
};

const GuestMarketReport: React.FC = () => {
  const { state, openMarketAction } = useClarity();
  const {
    live,
    showVerdictSkeleton,
    showHeadlineSkeleton,
    showShiftSkeleton,
    useFixtures,
  } = useMarketOverviewUiState();

  const shifts = showShiftSkeleton
    ? []
    : useFixtures
      ? GUEST_SHIFTS
      : (live?.shifts.map((s) => [s.title, s.copy] as [string, string]) ?? []);

  const signals =
    live?.signals.slice(0, 3) ?? [
      { label: 'Role demand', value: 'Stable' },
      { label: 'Competition', value: 'High' },
      { label: 'Evidence quality', value: 'High' },
    ];

  return (
    <div className="guestMarketReport">
      <div className="guestMarketHead">
        <div>
          <h1>
            {reportRoleTitle(state.market.level, state.market.role)} in{' '}
            {cityOnly(state.market.location)}
          </h1>
          <p>{state.market.industry} · Canada</p>
        </div>
        <div className="guestMarketFresh">
          <i />
          <span>{live?.fromLive ? 'Live market data' : 'Updated today · 60-day view'}</span>
        </div>
      </div>
      {showVerdictSkeleton ? (
        <MarketOverviewSkeleton variant="guest" recommendation />
      ) : (
        <>
          <section className="guestMarketVerdict" data-testid={testIds.marketOverviewHero}>
            <div className="guestVerdictTop">
              <span>{live?.verdictLabel ?? 'Stable market'}</span>
              <small>{live?.outlookLabel ?? 'Positive 12-month outlook'}</small>
            </div>
            {showHeadlineSkeleton ? (
              <MarketOverviewSkeleton
                variant="guest"
                headlineBody
                hero={false}
                signals={false}
              />
            ) : (
              <>
                <h2>
                  {useFixtures
                    ? 'Your experience remains relevant, but the strongest senior roles are changing.'
                    : (live?.headline ??
                      'Your experience remains relevant, but the strongest senior roles are changing.')}
                </h2>
                <p>
                  {useFixtures
                    ? 'Toronto employers continue to hire experienced product leaders. The clearest shift is toward AI-enabled delivery, commercial ownership and confident execution in regulated environments.'
                    : (live?.summary ??
                      'Toronto employers continue to hire experienced product leaders. The clearest shift is toward AI-enabled delivery, commercial ownership and confident execution in regulated environments.')}
                </p>
              </>
            )}
          </section>
          <section className="guestSignalStrip" aria-label="Market signals">
            {signals.map((signal) => (
              <div key={signal.label} className="guestSignal">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
              </div>
            ))}
          </section>
        </>
      )}
      <section className="guestMarketPanel">
        <div className="guestPanelHead">
          <div>
            <small>What changed</small>
            <h2>Three shifts affecting you</h2>
          </div>
          <button type="button" onClick={() => openMarketAction('insights')}>
            See all insights →
          </button>
        </div>
        {showShiftSkeleton ? (
          <MarketOverviewSkeleton variant="guest" hero={false} signals={false} shifts />
        ) : (
          shifts.map(([title, copy], index) => (
            <div key={`${title}-${index}`} className="guestInsight">
              <span className="shiftNumber">{index + 1}</span>
              <div>
                <b>{title}</b>
                <p>{copy}</p>
              </div>
            </div>
          ))
        )}
      </section>
      {showHeadlineSkeleton || showVerdictSkeleton ? null : (
        <section className="guestNextMove">
          <div>
            <small>Recommended next step</small>
            <h3>{live?.recommendation.title ?? 'Strengthen your AI product evidence'}</h3>
            <p>
              {live?.recommendation.copy ??
                'Compare your current skills with the capabilities employers now expect from senior product leaders.'}
            </p>
          </div>
          <button
            type="button"
            className="btn secondary"
            onClick={() => openMarketAction('skills')}
          >
            Assess my skills →
          </button>
        </section>
      )}
    </div>
  );
};

const ApprovedMarketReport: React.FC = () => {
  const { state, patch, navigate, openMarketAction, toast } = useClarity();
  const { live, showVerdictSkeleton, showHeadlineSkeleton, useFixtures } = useMarketOverviewUiState();
  const viewingSnapshot = Boolean(state.marketSnapshotId);
  const date = state.marketSnapshotDate || 'today';
  const signals = live?.signals.slice(0, 3) ?? [
    { label: 'Role demand', value: 'Stable' },
    { label: 'Competition', value: 'High' },
    { label: 'Evidence quality', value: 'High' },
  ];

  const returnToCurrent = async () => {
    try {
      const detail = await fetchLatestUserMarketReport(getClarityUserId());
      if (detail) {
        patch({
          marketSnapshotId: null,
          marketSnapshotDate: null,
          marketLiveInsights: detail.insights,
          market: {
            ...state.market,
            role: detail.role,
            level: detail.level,
            location: detail.location,
            industry: detail.industry || state.market.industry,
          },
        });
      } else {
        patch({ marketSnapshotId: null, marketSnapshotDate: null });
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not load current report');
      patch({ marketSnapshotId: null, marketSnapshotDate: null });
    }
    navigate('market-workspace-result');
  };

  return (
    <div className="approvedReport">
      {viewingSnapshot ? (
        <div className="snapshotBanner">
          <div>
            <small>SAVED SNAPSHOT</small>
            <strong>{state.marketSnapshotDate}</strong>
          </div>
          <a
            className="reviewAction"
            href="#market-workspace-result"
            onClick={(event) => {
              event.preventDefault();
              void returnToCurrent();
            }}
          >
            View current report →
          </a>
        </div>
      ) : null}
      <div className="approvedReportHead">
        <div>
          <h1>
            {reportRoleTitle(state.market.level, state.market.role)} in{' '}
            {cityOnly(state.market.location)}
          </h1>
          <p>{state.market.industry} · Canada</p>
        </div>
        <div className="reportFreshness">
          <i />
          <div>
            <b>Updated {date}</b>
            <small>
              {live?.fromLive
                ? `${Math.max(live.sources.length, 1)} sources · live data`
                : '19 sources · 60-day data window'}
            </small>
          </div>
        </div>
      </div>
      {showVerdictSkeleton ? (
        <MarketOverviewSkeleton variant="registered" />
      ) : (
        <section className="marketVerdict" data-testid={testIds.marketOverviewHero}>
          <div>
            <div className="verdictFlag">
              <b>{live?.verdictLabel ?? 'Stable market'}</b>
              <span>{live?.outlookLabel ?? 'Positive outlook'}</span>
            </div>
            {showHeadlineSkeleton ? (
              <MarketOverviewSkeleton
                variant="registered"
                headlineBody
                hero={false}
                signals={false}
              />
            ) : (
              <>
                <h2>
                  {useFixtures
                    ? 'Your experience remains relevant, but senior product roles are changing.'
                    : (live?.headline ??
                      'Your experience remains relevant, but senior product roles are changing.')}
                </h2>
                <p>
                  {useFixtures
                    ? 'Toronto employers continue to hire product leaders with financial-services experience. The clearest shift is toward AI-enabled delivery and stronger commercial ownership.'
                    : (live?.summary ??
                      'Toronto employers continue to hire product leaders with financial-services experience. The clearest shift is toward AI-enabled delivery and stronger commercial ownership.')}
                </p>
              </>
            )}
          </div>
          <div className="verdictStats">
            {signals.map((signal) => (
              <div key={signal.label} className="verdictStat">
                <span>{signal.label}</span>
                <b>{signal.value}</b>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="approvedOverviewGrid">
        <article className="reportCard" id="market-insights">
          <div className="reportCardTitle">
            <div>
              <small>What to know</small>
              <h2>Market insights affecting you</h2>
              <p className="insightOverviewNote">
                Prioritized for your role, seniority and location. Open an insight to
                review its implication, action and supporting evidence.
              </p>
            </div>
          </div>
          <MarketInsightList />
        </article>
        {showHeadlineSkeleton || showVerdictSkeleton ? (
          <MarketOverviewSkeleton variant="registered" hero={false} signals={false} recommendation />
        ) : (
          <aside className="reportCard recommendCard">
            <small>Recommended next step</small>
            <span className="recommendIcon">↗</span>
            <h2>{live?.recommendation.title ?? 'Strengthen your AI product evidence'}</h2>
            <p>
              {live?.recommendation.copy ??
                'Compare your current skills with what employers expect from AI-enabled product leaders.'}
            </p>
            <button
              type="button"
              className="btn primary"
              onClick={() => openMarketAction('skills')}
            >
              Assess my skills
            </button>
            <a onClick={() => openMarketAction('recommendations')}>
              See all recommendations
            </a>
          </aside>
        )}
      </section>
      <section className="approvedPath">
        <div>
          <small>One path worth exploring</small>
          <h2>{live?.path.title ?? 'AI Product Lead'}</h2>
          <p>
            {live?.path.copy ??
              'Your product strategy, regulated-market and stakeholder-leadership experience provide a strong foundation.'}
          </p>
        </div>
        <div>
          <small>Why it fits</small>
          <div className="fitTags">
            {(live?.path.tags ?? ['Product strategy', 'Payments', 'Leadership']).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => openMarketAction('path')}
        >
          Explore this path →
        </button>
      </section>
      <div className="mrActions">
        <button
          type="button"
          className="btn primary"
          onClick={() => openMarketAction('full')}
        >
          View full report →
        </button>
        <a
          className="btn secondary"
          href="#market-workspace-history"
          onClick={(event) => {
            event.preventDefault();
            navigate('market-workspace-history');
          }}
        >
          All reports
        </a>
      </div>
    </div>
  );
};

export const MarketWorkspaceResultView: React.FC = () => {
  const { state } = useClarity();

  if (!state.registered) {
    return (
      <MarketWorkspaceFrame label="Report overview">
        <GuestMarketReport />
      </MarketWorkspaceFrame>
    );
  }

  return (
    <MarketWorkspaceFrame
      label={state.marketSnapshotDate ? 'Saved report' : 'Report overview'}
    >
      <ApprovedMarketReport />
    </MarketWorkspaceFrame>
  );
};

/** `#market-workspace-insights` opens the overview scrolled to the insight list. */
export const MarketWorkspaceInsightsView: React.FC = () => {
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        document
          .getElementById('market-insights')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    );
    return () => window.clearTimeout(timer);
  }, []);

  return <MarketWorkspaceResultView />;
};

interface OpportunityRowsProps {
  group: OpportunityGroup;
}

const OpportunityRows: React.FC<OpportunityRowsProps> = ({ group }) => {
  const { state, toggleMarketOpportunityDetail } = useClarity();
  const live = useAdaptedMarketReport();

  // Was: every group other than 'best'/'emerging' fell through to live.risks —
  // meaning "Hiring sectors" and "Locations" both silently showed risk data
  // whenever live insights were present. Each group now maps to its own field.
  const LIVE_GROUP_FIELDS = {
    best: 'opportunities',
    emerging: 'emerging',
    sectors: 'sectors',
    locations: 'locations',
    risks: 'risks',
  } as const;
  const liveItems = live && live[LIVE_GROUP_FIELDS[group]];

  const items =
    liveItems && liveItems.length > 0
      ? liveItems.map((item) => ({
          name: item.name,
          summary: item.summary,
          signal: item.signal,
          marketDetail: item.summary,
          meaningDetail: item.summary,
        }))
      : MARKET_OPPORTUNITIES[group];

  return (
    <section className="opportunityList">
      {items.map((item, index) => {
        const key = `${group}-${index}`;
        const open = state.marketOpportunityDetail === key;
        return (
          <div key={`${item.name}-${index}`} className="opportunityItem">
            <div className="opportunityRow">
              <span className="capNumber">{index + 1}</span>
              <div>
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
                <span className="fitSignal">{item.signal}</span>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => toggleMarketOpportunityDetail(key)}
              >
                {open ? 'Hide details' : OPPORTUNITY_ACTION_LABELS[group]}
              </button>
            </div>
            {open ? (
              <div className="opportunityDetail">
                <div>
                  <small>What the market shows</small>
                  <p>{item.marketDetail}</p>
                </div>
                <div>
                  <small>What this means for you</small>
                  <p>{item.meaningDetail}</p>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};

const OpportunityContent: React.FC<{ view: MarketOpportunityView }> = ({ view }) => {
  if (view === 'roles') {
    return (
      <>
        <section className="opportunityBlock">
          <div className="opportunityBlockHead">
            <h3>Best matches for you</h3>
            <p>Roles aligned with your confirmed experience and transferable strengths.</p>
          </div>
          <OpportunityRows group="best" />
        </section>
        <section className="opportunityBlock">
          <div className="opportunityBlockHead">
            <h3>Emerging roles to watch</h3>
            <p>Growing roles that may become relevant as their requirements develop.</p>
          </div>
          <OpportunityRows group="emerging" />
        </section>
      </>
    );
  }
  return <OpportunityRows group={view} />;
};

/** Scales real AdaptedHiringTrendPoint values into the 700x220 chart viewBox.
 * No fixed axis (unlike the old static illustration) — real unemployment
 * rates don't sit in a known 80-120 index range, so min/max come from the
 * data itself, padded 10% so lines don't touch the edges. */
const buildHiringTrendChart = (points: AdaptedHiringTrendPoint[]) => {
  const xStart = 55;
  const xEnd = 655;
  const yTop = 35;
  const yBottom = 185;

  const allValues = points.flatMap((p) => [p.localValue, p.nationalValue]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = max - min || 1;
  const paddedMin = min - span * 0.1;
  const paddedMax = max + span * 0.1;
  const paddedSpan = paddedMax - paddedMin || 1;

  const xFor = (index: number) =>
    points.length > 1 ? xStart + (index / (points.length - 1)) * (xEnd - xStart) : (xStart + xEnd) / 2;
  const yFor = (value: number) => yBottom - ((value - paddedMin) / paddedSpan) * (yBottom - yTop);

  const toPolyline = (key: 'localValue' | 'nationalValue') =>
    points.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p[key]).toFixed(1)}`).join(' ');

  const tickCount = 3;
  const ticks = Array.from({ length: tickCount }, (_, i) => ({
    y: yTop + (i / (tickCount - 1)) * (yBottom - yTop),
    label: `${(paddedMax - (i / (tickCount - 1)) * paddedSpan).toFixed(1)}%`,
  }));

  return {
    localPolyline: toPolyline('localValue'),
    nationalPolyline: toPolyline('nationalValue'),
    ticks,
    xStart,
    xEnd,
  };
};

/** Headline for the chart card — compares the most recent local vs national
 * point. Lower unemployment rate = stronger local hiring. */
const hiringTrendHeadline = (trend: AdaptedMarketReport['hiringTrend']): string => {
  if (!trend.available) return 'Local hiring trend data is not available for this location yet.';
  const cityName = trend.localLabel.split(' (')[0];
  const latest = trend.points[trend.points.length - 1];
  const diff = latest.localValue - latest.nationalValue;
  if (diff <= -0.3) return `${cityName} hiring is outpacing the national baseline`;
  if (diff >= 0.3) return `${cityName} hiring is trailing the national baseline`;
  return `${cityName} is tracking close to the national baseline`;
};

/** Overview "Market direction" chart. Renders real local-vs-national
 * unemployment-rate data (see web-server hiringTrendService.ts) when
 * available, or an honest "not covered yet" message instead of a fake line —
 * this location may be outside the ~25 US/Canada metro/CMA areas ingested so
 * far (see constants/geoHiringTrendLocations.ts server-side), or `live` may
 * not have loaded yet. Never falls back to fabricated/static data. */
const HiringTrendChart: React.FC<{ trend: AdaptedMarketReport['hiringTrend'] | undefined }> = ({
  trend,
}) => {
  if (!trend?.available) {
    return (
      <section className="marketChartCard">
        <div className="marketChartHead">
          <div>
            <small className="fullReportKicker">Market direction</small>
            <h3>Local hiring trend not available yet</h3>
          </div>
        </div>
        <p className="chartUnavailable">
          We don't have verified month-over-month labor data for this location yet — the rest of
          this report is unaffected.
        </p>
      </section>
    );
  }

  const chart = buildHiringTrendChart(trend.points);

  return (
    <section className="marketChartCard">
      <div className="marketChartHead">
        <div>
          <small className="fullReportKicker">Market direction</small>
          <h3>{hiringTrendHeadline(trend)}</h3>
        </div>
        <span className="windowTag">{trend.windowLabel}</span>
      </div>
      <svg
        className="marketChart"
        viewBox="0 0 700 220"
        role="img"
        aria-label={`${trend.localLabel} compared with ${trend.nationalLabel}`}
      >
        {chart.ticks.map((tick) => (
          <React.Fragment key={tick.label}>
            <line className="chartGrid" x1={chart.xStart - 7} y1={tick.y} x2={chart.xEnd + 17} y2={tick.y} />
            <text className="chartLabel" x="10" y={tick.y + 4}>
              {tick.label}
            </text>
          </React.Fragment>
        ))}
        <polyline className="chartCanada" points={chart.nationalPolyline} />
        <polyline className="chartToronto" points={chart.localPolyline} />
      </svg>
      <div className="chartLegend">
        <span>
          <i />
          {trend.localLabel}
        </span>
        <span>
          <i />
          {trend.nationalLabel}
        </span>
      </div>
    </section>
  );
};

const OverviewTab: React.FC = () => {
  const live = useAdaptedMarketReport();
  const signals = live?.signals.slice(0, 3) ?? [
    { label: 'Role demand', value: 'Stable' },
    { label: 'Competition', value: 'High' },
    { label: 'Evidence quality', value: 'High' },
  ];
  const rows = live?.shifts.length
    ? live.shifts.map((shift, index) => ({
        index: String(index + 1).padStart(2, '0'),
        title: shift.title,
        copy: shift.copy,
      }))
    : MARKET_SIGNAL_ROWS;

  return (
    <>
      <section className="reportSummary">
        <div>
          <div className="verdictFlag">
            <b>{live?.verdictLabel ?? 'Stable market'}</b>
            <span>{live?.outlookLabel ?? 'Positive 12-month outlook'}</span>
          </div>
          <h2>
            {live?.headline ??
              'Your background is relevant. The opportunity is to make your AI and commercial impact easier to see.'}
          </h2>
          <p>
            {live?.summary ??
              'Toronto demand remains above the Canadian baseline for senior product talent, especially in regulated platforms, AI-enabled products and financial infrastructure.'}
          </p>
        </div>
        <div className="reportSummaryStats">
          {signals.map((signal) => (
            <div key={signal.label} className="reportSummaryStat">
              <span>{signal.label}</span>
              <b>{signal.value}</b>
            </div>
          ))}
        </div>
      </section>
      <HiringTrendChart trend={live?.hiringTrend} />
      <section className="signalCard">
        <small className="fullReportKicker">What changed</small>
        <h3>The signals that matter most to you</h3>
        {rows.map((signal) => (
          <div key={signal.index} className="signalRow">
            <span>{signal.index}</span>
            <div>
              <b>{signal.title}</b>
              <p>{signal.copy}</p>
            </div>
          </div>
        ))}
      </section>
    </>
  );
};

const OpportunitiesTab: React.FC = () => {
  const { state, setMarketOpportunityView } = useClarity();
  const view = state.marketOpportunityView;
  const [heading, description] = OPPORTUNITY_HEADINGS[view];

  return (
    <>
      <div className="fullReportContentHead">
        <small className="fullReportKicker">Opportunities</small>
        <h2>{heading}</h2>
        <p>{description}</p>
      </div>
      <div className="opportunityFilters">
        {OPPORTUNITY_VIEWS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={view === key ? 'active' : ''}
            onClick={() => setMarketOpportunityView(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <OpportunityContent view={view} />
    </>
  );
};

const SkillsTab: React.FC = () => {
  const { openSkillsFromMarket } = useClarity();
  const live = useAdaptedMarketReport();
  // Was: read live.skills directly (up to 8 raw entries from top_skills_demand).
  // Now reads live.capabilities — an intentional top-3 pick from
  // priority_capabilities (NEW field), matching the prototype's "3 capabilities" design.
  const capabilities =
    live?.capabilities.length
      ? live.capabilities.map((skill) => ({
          name: skill.name,
          demand: skill.demand,
          action: skill.action,
          width: skill.width,
        }))
      : CAPABILITIES;
  const weeks: Array<[string, string]> = live?.focusWeeks.length
    ? live.focusWeeks.map((w) => [w.label, w.action])
    : FOCUS_WEEKS;

  return (
    <>
      <div className="fullReportContentHead">
        <small className="fullReportKicker">Skills &amp; actions</small>
        <h2>Three capabilities will improve your position fastest</h2>
        <p>This is a priority list, not a full learning catalogue.</p>
      </div>
      <section className="capabilityCard">
        {capabilities.map((capability, index) => (
          <div key={`${capability.name}-${index}`} className="capabilityRow">
            <div className="capabilityTop">
              <span className="capNumber">{index + 1}</span>
              <h3>{capability.name}</h3>
              <span className="demandTag">{capability.demand}</span>
            </div>
            <div className="capabilityBar">
              <i style={{ width: capability.width }} />
            </div>
            <p>{capability.action}</p>
          </div>
        ))}
      </section>
      <section className="focusCard">
        <div>
          <small className="fullReportKicker">30-day focus</small>
          <h2>Turn evidence into a stronger market story</h2>
        </div>
        <div className="focusWeeks">
          {weeks.map(([week, copy]) => (
            <div key={week} className="focusWeek">
              <b>{week}</b>
              <span>{copy}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={openSkillsFromMarket}>
          Open Skills Match →
        </button>
      </section>
    </>
  );
};

const EvidenceTab: React.FC = () => {
  const live = useAdaptedMarketReport();
  const groups =
    live && live.evidenceTags.some((row) => row.length)
      ? EVIDENCE_GROUPS.map((group, index) => ({
          ...group,
          tags: live.evidenceTags[index] ?? group.tags,
        }))
      : EVIDENCE_GROUPS;
  const sources =
    live?.sources.length
      ? live.sources.map((source) => ({
          name: source.name,
          role: source.role,
          date: source.date,
        }))
      : EVIDENCE_SOURCES;

  return (
    <>
      <div className="fullReportContentHead">
        <small className="fullReportKicker">Evidence</small>
        <h2>See the evidence behind your report</h2>
        <p>
          Review the market data, hiring signals and trusted sources supporting your outlook,
          opportunities and recommended actions.
        </p>
      </div>
      <section className="evidenceGroups">
        {groups.map((group) => (
          <div key={group.index} className="evidenceGroup">
            <span>{group.index}</span>
            <div>
              <h3>{group.title}</h3>
              <div className="evidenceTags">
                {group.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>
      <section className="sourceQuality">
        <div className="sourceQualityHead">
          <div>
            <small className="fullReportKicker">Source quality</small>
            <h3>Current, local and traceable</h3>
          </div>
          <span className="windowTag">{live?.fromLive ? 'Live data' : 'High confidence'}</span>
        </div>
        <div className="sourceList">
          {sources.map((source) => (
            <div key={source.name} className="sourceRow">
              <span className="sourceIcon">↗</span>
              <div>
                <b>{source.name}</b>
                <small>
                  {source.role} · {source.date}
                </small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

const FULL_REPORT_TABS: Array<[MarketReportTab, string, string, string]> = [
  ['overview', '1', 'Overview', 'Your market at a glance'],
  ['opportunities', '2', 'Opportunities', 'Where demand is strongest'],
  ['skills', '3', 'Skills & actions', 'What to build next'],
  ['evidence', '4', 'Evidence', 'Sources and confidence'],
];

const TAB_CONTENT: Record<MarketReportTab, React.FC> = {
  overview: OverviewTab,
  opportunities: OpportunitiesTab,
  skills: SkillsTab,
  evidence: EvidenceTab,
};

export const MarketWorkspaceFullReportView: React.FC = () => {
  const { state, navigate, setMarketReportTab } = useClarity();
  const tab = state.marketReportTab;
  const TabContent = TAB_CONTENT[tab];
  const date = state.marketSnapshotDate || 'today';

  return (
    <MarketWorkspaceShell
      label={state.marketSnapshotDate ? 'Saved full report' : 'Full report'}
    >
      <div className="approvedReport">
        <a
          className="fullReportBack"
          href="#market-workspace-result"
          onClick={(event) => {
            event.preventDefault();
            navigate('market-workspace-result');
          }}
        >
          ← Back to report overview
        </a>
        <div className="fullReportHead">
          <div>
            <small className="fullReportKicker">Full market report</small>
            <h1>
              {state.market.role} · {cityOnly(state.market.location)}
            </h1>
            <p>
              {state.market.industry} · {state.market.level} · Updated {date}
            </p>
          </div>
        </div>
        <section className="fullReportLayout">
          <nav className="fullReportTabs" aria-label="Full report sections">
            {FULL_REPORT_TABS.map(([key, number, title, hint]) => (
              <button
                key={key}
                type="button"
                className={`fullReportTab ${tab === key ? 'active' : ''}`}
                onClick={() => setMarketReportTab(key)}
              >
                <span className="fullTabNumber">{number}</span>
                <span>
                  <b>{title}</b>
                  <small>{hint}</small>
                </span>
              </button>
            ))}
          </nav>
          <div>
            <TabContent />
          </div>
        </section>
      </div>
    </MarketWorkspaceShell>
  );
};
