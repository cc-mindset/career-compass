import React from 'react';
import './AnimatedLoader.css';

const EKG_PATH =
  'M0,50 L40,50 L50,35 L65,65 L80,50 L110,50 L120,20 L135,85 L150,50 L180,50 L190,40 L205,60 L220,50 L300,50';

export type AnimatedLoaderSize = 'default' | 'compact';

export type AnimatedLoaderProps = {
  size?: AnimatedLoaderSize;
  className?: string;
};

export const AnimatedLoader: React.FC<AnimatedLoaderProps> = ({
  size = 'default',
  className,
}) => {
  const rootClass = [
    'animatedLoader',
    size === 'compact' ? 'animatedLoader--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} aria-hidden="true">
      <div className="animatedLoader__canvas">
        <svg
          className="animatedLoader__svg"
          viewBox="0 0 300 100"
          preserveAspectRatio="xMidYMid meet"
        >
          <path className="animatedLoader__trace" d={EKG_PATH} />
          <path className="animatedLoader__pulse" d={EKG_PATH} />
        </svg>
      </div>
    </div>
  );
};
