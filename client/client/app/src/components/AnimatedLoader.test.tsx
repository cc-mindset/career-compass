import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedLoader } from './AnimatedLoader';

describe('AnimatedLoader', () => {
  it('renders the EKG SVG with animation class', () => {
    const { container } = render(<AnimatedLoader />);

    expect(container.querySelector('.animatedLoader__svg')).toBeTruthy();
    expect(container.querySelector('.animatedLoader__pulse')).toBeTruthy();
  });

  it('applies compact sizing when requested', () => {
    const { container } = render(<AnimatedLoader size="compact" />);

    expect(container.querySelector('.animatedLoader--compact')).toBeTruthy();
  });
});
