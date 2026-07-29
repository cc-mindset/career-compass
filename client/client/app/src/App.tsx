import React from 'react';
import { AccountControls } from './components/AccountControls';
import { DemoNavigator, Toast } from './components/layout';
import { ClarityProvider } from './state/contexts/ClarityContext';
import { RouteRenderer } from './views/RouteRenderer';

export const App: React.FC = () => (
  <ClarityProvider>
    <RouteRenderer />
    <Toast />
    <DemoNavigator />
    <AccountControls />
  </ClarityProvider>
);
