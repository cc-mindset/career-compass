import React, { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { SelectField } from '../../components/forms';
import { JourneyHeader, Progress } from '../../components/layout';
import { INDUSTRY_OPTIONS, LOCATION_OPTIONS, ROLE_OPTIONS } from '../../consts';
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
  const { state, patch, navigate, toast } = useClarity();
  const [progress, setProgress] = useState(8);
  const [statusMessage, setStatusMessage] = useState('Preparing your report');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const userId = state.registered ? getClarityUserId() : 'guest';
      const result = await runMarketReportGeneration(
        state.market,
        (update) => {
          if (cancelled) return;
          setProgress(Math.max(8, Math.min(100, Math.round(update.percent))));
          if (update.message) setStatusMessage(update.message);
        },
        { userId },
      );
      if (cancelled) return;

      if (result.ok && !result.fromFixtures) {
        if (state.registered) {
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
            const message =
              error instanceof Error ? error.message : 'Could not save report history';
            toast(message);
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
        });
      } else if (result.ok) {
        patch({
          marketHasReports: true,
          marketCreateMode: false,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketLiveError: null,
        });
      } else {
        toast(result.error);
        patch({
          marketHasReports: true,
          marketCreateMode: false,
          marketSnapshotDate: null,
          marketSnapshotId: null,
          marketLiveError: result.error,
        });
      }

      setProgress(100);
      setStatusMessage('Your report is ready');
      window.setTimeout(() => {
        if (!cancelled) navigate('market-workspace-result');
      }, 450);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, patch, state.market, state.registered, toast]);

  const complete = progress >= 100;

  return (
    <MarketWorkspaceShell label="Preparing report">
      <div className="mrWorkspace">
        <section className="mrLoader">
          <div className="mrLoaderInner">
            <div
              className="mrLoaderRing"
              role="progressbar"
              aria-label="Market Report generation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              style={{ '--progress': progress } as React.CSSProperties}
            >
              <strong>{progress}%</strong>
            </div>
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
          <span>Loading…</span>
        </div>
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
            <div>
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
  const insights = live
    ? live.shifts.map((shift, index) => ({
        title: shift.title,
        summary: shift.copy,
        category: 'Market shift',
        meaning: live.recommendation.copy,
        action: live.path.copy,
        source: live.sources[index]?.name || 'Live market insights',
      }))
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
  const live = useAdaptedMarketReport();
  const shifts = live?.shifts.length
    ? live.shifts.map((s) => [s.title, s.copy] as [string, string])
    : GUEST_SHIFTS;
  const signals = live?.signals.slice(0, 3) ?? [
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
      <section className="guestMarketVerdict">
        <div className="guestVerdictTop">
          <span>{live?.verdictLabel ?? 'Stable market'}</span>
          <small>{live?.outlookLabel ?? 'Positive 12-month outlook'}</small>
        </div>
        <h2>
          {live?.headline ??
            'Your experience remains relevant, but the strongest senior roles are changing.'}
        </h2>
        <p>
          {live?.summary ??
            'Toronto employers continue to hire experienced product leaders. The clearest shift is toward AI-enabled delivery, commercial ownership and confident execution in regulated environments.'}
        </p>
      </section>
      <section className="guestSignalStrip" aria-label="Market signals">
        {signals.map((signal) => (
          <div key={signal.label} className="guestSignal">
            <small>{signal.label}</small>
            <strong>{signal.value}</strong>
          </div>
        ))}
      </section>
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
        {shifts.map(([title, copy], index) => (
          <div key={title} className="guestInsight">
            <span className="shiftNumber">{index + 1}</span>
            <div>
              <b>{title}</b>
              <p>{copy}</p>
            </div>
          </div>
        ))}
      </section>
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
    </div>
  );
};

const ApprovedMarketReport: React.FC = () => {
  const { state, patch, navigate, openMarketAction, toast } = useClarity();
  const live = useAdaptedMarketReport();
  const viewingSnapshot = Boolean(state.marketSnapshotId);
  const date = state.marketSnapshotDate || 'today';
  const signals = live?.signals.slice(0, 3) ?? [
    { label: 'Role demand', value: 'Stable' },
    { label: 'Competition', value: 'High' },
    { label: '12-month outlook', value: 'Positive' },
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
      <section className="marketVerdict">
        <div>
          <div className="verdictFlag">
            <b>{live?.verdictLabel ?? 'Stable market'}</b>
            <span>{live?.outlookLabel ?? 'Positive outlook'}</span>
          </div>
          <h2>
            {live?.headline ??
              'Your experience remains relevant, but senior product roles are changing.'}
          </h2>
          <p>
            {live?.summary ??
              'Toronto employers continue to hire product leaders with financial-services experience. The clearest shift is toward AI-enabled delivery and stronger commercial ownership.'}
          </p>
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

  const liveItems =
    live &&
    (group === 'best'
      ? live.opportunities
      : group === 'emerging'
        ? live.emerging
        : live.risks);

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
      <section className="marketChartCard">
        <div className="marketChartHead">
          <div>
            <small className="fullReportKicker">Market direction</small>
            <h3>Toronto hiring remains above the national baseline</h3>
          </div>
          <span className="windowTag">Last 60 days</span>
        </div>
        <svg
          className="marketChart"
          viewBox="0 0 700 220"
          role="img"
          aria-label="Toronto product hiring trend compared with Canada"
        >
          <line className="chartGrid" x1="48" y1="40" x2="672" y2="40" />
          <line className="chartGrid" x1="48" y1="105" x2="672" y2="105" />
          <line className="chartGrid" x1="48" y1="170" x2="672" y2="170" />
          <text className="chartLabel" x="10" y="44">
            120
          </text>
          <text className="chartLabel" x="10" y="109">
            100
          </text>
          <text className="chartLabel" x="17" y="174">
            80
          </text>
          <polyline
            className="chartCanada"
            points="55,154 130,139 205,135 280,126 355,102 430,108 505,91 580,96 655,82"
          />
          <polyline
            className="chartToronto"
            points="55,143 130,118 205,124 280,87 355,99 430,67 505,80 580,47 655,57"
          />
        </svg>
        <div className="chartLegend">
          <span>
            <i />
            Toronto region
          </span>
          <span>
            <i />
            Canada
          </span>
        </div>
      </section>
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
  const capabilities =
    live?.skills.length
      ? live.skills.map((skill) => ({
          name: skill.name,
          demand: skill.demand,
          action: skill.action,
          width: skill.width,
        }))
      : CAPABILITIES;

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
          {FOCUS_WEEKS.map(([week, copy]) => (
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
