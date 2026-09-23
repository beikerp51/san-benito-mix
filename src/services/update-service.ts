// ─── Senior OTA (Over-The-Air) App Update Service ────────────────
// Permite actualizar la aplicación en teléfonos y PCs sin desinstalar ni perder datos
import { create } from 'zustand';

export const APP_VERSION = 'v3.2.0-senior';
export const APP_BUILD_DATE = '22 Sept 2026';

interface UpdateState {
  hasUpdate: boolean;
  isChecking: boolean;
  isUpdating: boolean;
  lastChecked: number | null;
  registration: ServiceWorkerRegistration | null;
  waitingWorker: ServiceWorker | null;

  // Acciones
  setRegistration: (reg: ServiceWorkerRegistration) => void;
  setWaitingWorker: (worker: ServiceWorker) => void;
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  hasUpdate: false,
  isChecking: false,
  isUpdating: false,
  lastChecked: null,
  registration: null,
  waitingWorker: null,

  setRegistration: (reg: ServiceWorkerRegistration) => {
    set({ registration: reg });

    // Si ya hay un worker esperando, forzarlo a activarse de inmediato
    if (reg.waiting) {
      console.log('[OTA] 🚀 Worker esperando detectado. Activando de inmediato...');
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Escuchar cuando se descubra un nuevo worker
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          console.log('[OTA] 🚀 Nueva versión instalada. Activando sin esperas...');
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  },

  setWaitingWorker: (worker: ServiceWorker) => {
    set({ hasUpdate: true, waitingWorker: worker });
    worker.postMessage({ type: 'SKIP_WAITING' });
  },

  checkForUpdates: async (): Promise<boolean> => {
    const { registration } = get();
    if (!registration) {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            get().setRegistration(reg);
            await reg.update();
            set({ lastChecked: Date.now() });
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              return true;
            }
          }
        } catch {}
      }
      return false;
    }

    set({ isChecking: true });
    try {
      await registration.update();
      set({ lastChecked: Date.now() });
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[OTA] Error comprobando actualizaciones:', err);
      return false;
    } finally {
      set({ isChecking: false });
    }
  },

  applyUpdate: () => {
    const { waitingWorker } = get();
    set({ isUpdating: true });

    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }

    window.location.reload();
  },
}));

// Inicializador global de actualización
export function initAppUpdateListener(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Al tomar control el nuevo worker, recargar automáticamente sin intervención manual
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading) {
      reloading = true;
      console.log('[OTA] ✅ Nuevo Service Worker tomó el control. Recargando con versión fresca...');
      window.location.reload();
    }
  });

  // Escuchar mensaje directo del Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'OTA_UPDATE_APPLIED' && !reloading) {
      reloading = true;
      console.log('[OTA] 🔄 Nueva versión reportada por el Service Worker. Recargando...');
      window.location.reload();
    }
  });

  navigator.serviceWorker.ready.then((reg) => {
    useUpdateStore.getState().setRegistration(reg);

    // Comprobar actualización de inmediato al abrir la aplicación
    reg.update().catch(() => {});

    // Comprobación periódica cada 15 segundos en segundo plano
    setInterval(() => {
      if (navigator.onLine) {
        reg.update().catch(() => {});
      }
    }, 15000);
  });

  // Al regresar a la app en el teléfono (desbloquear pantalla o cambiar de app), forzar verificación
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          reg?.update().catch(() => {});
        });
      }
    });
  }
}
