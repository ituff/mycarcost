import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker for PWA support.
// When an updated SW takes over (deploy), reload once so the page
// immediately runs the new assets instead of the stale cache.
if ('serviceWorker' in navigator) {
  registerSW({ immediate: true });

  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      // First install on a brand-new client: no stale content to replace.
      hadController = true;
      return;
    }
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
