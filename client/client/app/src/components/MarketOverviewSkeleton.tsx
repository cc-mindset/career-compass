import React from 'react';
import { testIds } from '../data-test-ids';
import './MarketOverviewSkeleton.css';

export type MarketOverviewSkeletonProps = {
  variant?: 'guest' | 'registered';
  hero?: boolean;
  /** Skeleton only the headline + body lines (badge/signals shown live). */
  headlineBody?: boolean;
  signals?: boolean;
  shifts?: boolean;
  recommendation?: boolean;
};

export const MarketOverviewSkeleton: React.FC<MarketOverviewSkeletonProps> = ({
  variant = 'guest',
  hero = true,
  headlineBody = false,
  signals = true,
  shifts = false,
  recommendation = false,
}) => (
  <div
    className={`marketOverviewSkeleton marketOverviewSkeleton--${variant}${headlineBody ? ' marketOverviewSkeleton--headlineBody' : ''}`}
    data-testid={testIds.marketOverviewSkeleton}
    aria-busy="true"
    aria-label="Loading market overview"
  >
    {headlineBody ? (
      <div className="marketOverviewSkeleton__heroInner">
        <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--lg" />
        <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--md" />
        <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--md" />
      </div>
    ) : null}

    {hero && !headlineBody ? (
      <section
        className={
          variant === 'guest' ? 'guestMarketVerdict marketOverviewSkeleton__hero' : 'marketVerdict marketOverviewSkeleton__hero'
        }
      >
        <div className="marketOverviewSkeleton__heroInner">
          <div className="marketOverviewSkeleton__badges">
            <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--sm" />
            <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--xs" />
          </div>
          <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--lg" />
          <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--md" />
          <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--md" />
        </div>
        {variant === 'registered' && signals ? (
          <div className="verdictStats marketOverviewSkeleton__stats">
            {[0, 1, 2].map((index) => (
              <div key={index} className="verdictStat">
                <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--xs" />
                <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--sm" />
              </div>
            ))}
          </div>
        ) : null}
      </section>
    ) : null}

    {variant === 'guest' && signals ? (
      <section className="guestSignalStrip marketOverviewSkeleton__signals" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="guestSignal">
            <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--xs" />
            <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--sm" />
          </div>
        ))}
      </section>
    ) : null}

    {shifts ? (
      <section
        className={
          variant === 'guest' ? 'guestMarketPanel marketOverviewSkeleton__shifts' : 'reportCard marketOverviewSkeleton__shifts'
        }
      >
        {[0, 1, 2].map((index) => (
          <div key={index} className="marketOverviewSkeleton__shiftRow">
            <span className="marketOverviewSkeleton__circle" />
            <div className="marketOverviewSkeleton__shiftCopy">
              <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--sm" />
              <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--md" />
            </div>
          </div>
        ))}
      </section>
    ) : null}

    {recommendation ? (
      <section
        className={
          variant === 'guest' ? 'guestNextMove marketOverviewSkeleton__recommend' : 'reportCard recommendCard marketOverviewSkeleton__recommend'
        }
      >
        <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--xs" />
        <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--md" />
        <span className="marketOverviewSkeleton__bar marketOverviewSkeleton__bar--lg" />
      </section>
    ) : null}
  </div>
);
