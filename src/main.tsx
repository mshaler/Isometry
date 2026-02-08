import React from 'react';
import ReactDOM from 'react-dom/client';
// TEMP: Disable QueryClientProvider to fix client.mount errors during SuperGrid demo
// import { QueryClientProvider } from '@tanstack/react-query';
// import { queryClient } from './services/queryClient';
import App from './App';
import TauriTestApp from './TauriTestApp';
import './index.css';

// Check if running in Tauri environment
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined;

// For testing purposes, force Tauri test app when in Tauri context
const AppComponent = isTauri ? TauriTestApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* TEMP: Disabled QueryClientProvider - our sql.js hooks don't need it */}
    <AppComponent />
  </React.StrictMode>
);
