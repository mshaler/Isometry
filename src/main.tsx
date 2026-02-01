import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { TanStackQueryProvider } from './cache/TanStackQueryProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TanStackQueryProvider>
      <App />
    </TanStackQueryProvider>
  </React.StrictMode>
);
