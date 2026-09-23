import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { initAppUpdateListener, useUpdateStore } from './services/update-service';

// Purga proactiva de cachés antiguas en teléfonos móviles (para asegurar cero huella dactilar)
if (typeof window !== 'undefined' && 'caches' in window) {
  const CURRENT_VER = 'sbm-ota-v10';
  if (localStorage.getItem('sbm_cache_ver') !== CURRENT_VER) {
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== 'sbm-cache-v10-ota') {
            return caches.delete(k);
          }
        })
      );
    }).then(() => {
      localStorage.setItem('sbm_cache_ver', CURRENT_VER);
      console.log('[SBM] Caché anterior purgada con éxito.');
    }).catch(() => {});
  }
}

// Registro oficial del Service Worker PWA con soporte OTA de actualización continua
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SBM] Service Worker PWA activo:', reg.scope);
        useUpdateStore.getState().setRegistration(reg);
        initAppUpdateListener();
        // Forzar actualización inmediata en red
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('[SBM] Registro de Service Worker:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
