import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker with instant auto-update polling
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Automatically update to latest version seamlessly
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Vikramshila ERP is cached and ready for offline use');
  },
});

// Auto-recover from stale dynamic import chunk 404s after new deployments
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    event.preventDefault();
    const reloadKey = 'last_chunk_reload';
    const lastReload = Number(sessionStorage.getItem(reloadKey) || '0');
    if (Date.now() - lastReload > 10000) {
      sessionStorage.setItem(reloadKey, String(Date.now()));
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
