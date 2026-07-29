import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthPage from '../index';

jest.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <div data-testid="signed-out">{children}</div>,
  SignIn: ({ appearance, fallback }: { appearance?: any; fallback?: React.ReactNode }) => (
    <div data-testid="sign-in" data-appearance={JSON.stringify(appearance)}>
      {fallback}
    </div>
  ),
}));

jest.mock('../../../ui-kit/atom/animated-loader', () => ({
  __esModule: true,
  default: () => <div data-testid="animated-loader">Loading...</div>,
}));

describe('AuthPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the AuthPage component', () => {
    render(<AuthPage />);
    expect(screen.getByTestId('sign-in')).toBeInTheDocument();
  });

  it('displays welcome message when signed out', () => {
    render(<AuthPage />);
    expect(screen.getByText('Welcome to CareerCompass')).toBeInTheDocument();
    expect(screen.getByText('Sign in to access your career insights')).toBeInTheDocument();
  });

  it('shows AnimatedLoader when signed in', () => {
    render(<AuthPage />);
    const signedInElement = screen.getByTestId('signed-in');
    expect(signedInElement).toBeInTheDocument();
    expect(signedInElement).toContainElement(screen.getAllByTestId('animated-loader')[0]);
  });

  it('renders SignIn component with custom appearance', () => {
    render(<AuthPage />);
    const signInElement = screen.getByTestId('sign-in');
    expect(signInElement).toBeInTheDocument();

    // Check that appearance prop is passed
    const appearance = JSON.parse(signInElement.getAttribute('data-appearance') || '{}');
    expect(appearance).toHaveProperty('elements');
    expect(appearance).toHaveProperty('layout');
    expect(appearance.elements).toHaveProperty('formButtonPrimary');
    expect(appearance.elements).toHaveProperty('card');
    expect(appearance.layout).toHaveProperty('socialButtonsPlacement', 'bottom');
    expect(appearance.layout).toHaveProperty('socialButtonsVariant', 'blockButton');
  });

  it('has correct container styling', () => {
    render(<AuthPage />);
    const container = screen.getByTestId('signed-in').parentElement?.parentElement;
    expect(container).toHaveClass('min-h-screen');
    expect(container).toHaveClass('bg-gradient-to-br');
    expect(container).toHaveClass('from-indigo-50');
    expect(container).toHaveClass('via-white');
    expect(container).toHaveClass('to-slate-50');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-center');
    expect(container).toHaveClass('justify-center');
    expect(container).toHaveClass('p-4');
  });

  it('has correct max-width wrapper', () => {
    render(<AuthPage />);
    const wrapper = screen.getByTestId('signed-in').parentElement;
    expect(wrapper).toHaveClass('max-w-md');
  });

  it('renders fallback AnimatedLoader in SignIn', () => {
    render(<AuthPage />);
    const signInElement = screen.getByTestId('sign-in');
    expect(signInElement).toContainElement(screen.getAllByTestId('animated-loader')[1]);
  });
});