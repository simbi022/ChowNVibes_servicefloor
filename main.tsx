import { createRoot } from 'react-dom/client';

import App from './App';
import VIPApp from './VIPApp';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const isVipOrderingRoute = window.location.pathname === '/vip';

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isVipOrderingRoute ? <VIPApp /> : <App />}
  </ErrorBoundary>,
);
import { createRoot } from 'react-dom/client';

import App from './App';
import VIPApp from './VIPApp';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const isVipOrderingRoute = window.location.pathname === '/vip';

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isVipOrderingRoute ? <VIPApp /> : <App />}
  </ErrorBoundary>,
);
import { createRoot } from 'react-dom/client';

import App from './App';
import VIPApp from './VIPApp';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const isVipOrderingRoute = window.location.pathname === '/vip';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isVipOrderingRoute ? <VIPApp /> : <App />}
  </ErrorBoundary>,
);
import { createRoot } from 'react-dom/client';

import App from './App';
import VIPApp from './VIPApp';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const isVipOrderingRoute = window.location.pathname === '/vip';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    {isVipOrderingRoute ? <VIPApp /> : <App />}
  </ErrorBoundary>,
);
