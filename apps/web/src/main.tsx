import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initMonitoring } from '@/lib/monitoring';
import { initAnalytics } from '@/lib/analytics';
import './index.css';

// Monitoreo (Sentry) y analítica (PostHog). Cargan su SDK por import dinámico
// solo si hay env configurada; si no, son no-op. Fire-and-forget.
void initMonitoring();
void initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <Toaster position="top-center" richColors closeButton />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
