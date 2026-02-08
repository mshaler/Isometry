import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';
import App from './App';
import TauriTestApp from './TauriTestApp';
import './index.css';

// Check if running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

// For testing purposes, force Tauri test app when in Tauri context
const AppComponent = isTauri ? TauriTestApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppComponent />
    </QueryClientProvider>
  </React.StrictMode>
);
