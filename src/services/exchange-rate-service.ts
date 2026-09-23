import { create } from 'zustand';
import { db, type RateSource } from '../db/database';

// ─── Types ──────────────────────────────────────────────────────

export const ACTIVE_RATE_STORAGE_KEY = 'sbm_active_rate_source';

export function getSavedActiveSource(): RateSource {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(ACTIVE_RATE_STORAGE_KEY) as RateSource | null;
      if (saved === 'bcv_usd' || saved === 'bcv_eur' || saved === 'binance_usdt') {
        return saved;
      }
    } catch (e) {
      console.warn('[ExchangeRateService] Error al leer tasa activa de localStorage:', e);
    }
  }
  return 'bcv_usd';
}

export interface ExchangeRateState {
  rates: Record<RateSource, number>;
  activeSource: RateSource;
  lastUpdate: number | null;
  isLoading: boolean;
  isLiveStreaming: boolean;
  sourcesInfo: Record<RateSource, string>;
  lastChange: Record<RateSource, number>;
  error: string | null;

  loadRates: () => Promise<void>;
  fetchRates: () => Promise<void>;
  initLiveStream: () => void;
  setActiveSource: (source: RateSource) => Promise<void>;
  applyServerActiveSource: (source: RateSource) => Promise<void>;
  manualSetRate: (source: RateSource, rate: number) => Promise<void>;
  getActiveRate: () => number;
}

// ─── Store ──────────────────────────────────────────────────────

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  rates: {
    bcv_usd: 842.21,
    bcv_eur: 977.88,
    binance_usdt: 957.80,
  },
  activeSource: getSavedActiveSource(),
  lastUpdate: null,
  isLoading: false,
  isLiveStreaming: false,
  sourcesInfo: {
    bcv_usd: 'BCV Oficial (API)',
    bcv_eur: 'BCV Oficial (API)',
    binance_usdt: 'Binance P2P Direct',
  },
  lastChange: {
    bcv_usd: 0,
    bcv_eur: 0,
    binance_usdt: 0,
  },
  error: null,

  loadRates: async () => {
    try {
      // 1. Consultar prioritariamente al servidor central la tasa fijada por el Master
      let serverActiveSource: RateSource | null = null;
      try {
        const activeRes = await fetch('/api/rates/active', { signal: AbortSignal.timeout(3000) });
        if (activeRes.ok) {
          const activeJson = await activeRes.json();
          if (
            activeJson?.activeSource &&
            ['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(activeJson.activeSource)
          ) {
            serverActiveSource = activeJson.activeSource as RateSource;
            if (typeof window !== 'undefined') {
              localStorage.setItem(ACTIVE_RATE_STORAGE_KEY, serverActiveSource);
            }
          }
        }
      } catch {
        // Modo offline / sin red: usará localStorage
      }

      const stored = await db.exchangeRates.toArray();
      const rates = { ...get().rates };

      // Prioridad 1: Tasa maestra del servidor
      // Prioridad 2: Tasa en localStorage local
      // Prioridad 3: Tasa en Dexie
      let activeSource: RateSource = serverActiveSource || getSavedActiveSource();

      for (const r of stored) {
        if (r.rate > 0) rates[r.source] = r.rate;
      }

      if (!serverActiveSource && typeof window !== 'undefined' && !localStorage.getItem(ACTIVE_RATE_STORAGE_KEY)) {
        const dbActive = stored.find((r) => r.isActive);
        if (dbActive?.source) {
          activeSource = dbActive.source;
          localStorage.setItem(ACTIVE_RATE_STORAGE_KEY, activeSource);
        }
      }

      const lastUpdate =
        stored.length > 0
          ? Math.max(...stored.map((r) => r.timestamp))
          : null;

      set({ rates, activeSource, lastUpdate });

      // Sincronizar campo isActive en Dexie para mantener coherencia
      for (const r of stored) {
        if (r.id && r.isActive !== (r.source === activeSource)) {
          await db.exchangeRates.update(r.id, { isActive: r.source === activeSource });
        }
      }
    } catch (err) {
      console.warn('[ExchangeRateService] Load rates warning:', err);
    }
  },

  applyServerActiveSource: async (source: RateSource) => {
    if (!['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(source)) return;

    // Actualización inmediata en memoria
    set({ activeSource: source });

    // Persistir en localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_RATE_STORAGE_KEY, source);
      } catch (e) {
        console.warn('[ExchangeRateService] Error guardando tasa activa en localStorage:', e);
      }
    }

    // Actualizar Dexie IndexedDB
    try {
      const allRates = await db.exchangeRates.toArray();
      if (allRates.length > 0) {
        for (const r of allRates) {
          if (r.id) {
            await db.exchangeRates.update(r.id, { isActive: r.source === source });
          }
        }
      }
    } catch (err) {
      console.warn('[ExchangeRateService] Error guardando tasa en Dexie:', err);
    }

    // Notificar a componentes locales
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sbm:active-rate-changed', { detail: { activeSource: source } })
      );
    }
  },

  initLiveStream: () => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;

    let eventSource: EventSource | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource('/api/rates/stream');

        eventSource.onopen = () => {
          set({ isLiveStreaming: true });
          console.log('[RatesSSE] 🟢 Conectado al stream de tasas en vivo');
        };

        eventSource.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data) return;

            // 1. Sincronización en tiempo real de la tasa fijada por el Master
            if (
              data.activeSource &&
              ['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(data.activeSource)
            ) {
              const currentActive = get().activeSource;
              if (currentActive !== data.activeSource) {
                console.log(`[RatesSSE] 🔄 Tasa fijada por el Master recibida en tiempo real: ${data.activeSource}`);
                await get().applyServerActiveSource(data.activeSource);
              }
            }

            const newRates = {
              bcv_usd: parseFloat(Number(data.bcv_usd || get().rates.bcv_usd).toFixed(2)),
              bcv_eur: parseFloat(Number(data.bcv_eur || get().rates.bcv_eur).toFixed(2)),
              binance_usdt: parseFloat(Number(data.binance_usdt || get().rates.binance_usdt).toFixed(2)),
            };

            const newChanges = {
              bcv_usd: data.change?.bcv_usd || 0,
              bcv_eur: data.change?.bcv_eur || 0,
              binance_usdt: data.change?.binance_usdt || 0,
            };

            const newSources = {
              bcv_usd: data.sources?.bcv_usd || get().sourcesInfo.bcv_usd,
              bcv_eur: data.sources?.bcv_eur || get().sourcesInfo.bcv_eur,
              binance_usdt: data.sources?.binance_usdt || get().sourcesInfo.binance_usdt,
            };

            // Save to Dexie offline DB
            await saveRate('bcv_usd', newRates.bcv_usd);
            await saveRate('bcv_eur', newRates.bcv_eur);
            await saveRate('binance_usdt', newRates.binance_usdt);

            set({
              rates: newRates,
              lastUpdate: data.lastUpdated || Date.now(),
              sourcesInfo: newSources,
              lastChange: newChanges,
              isLiveStreaming: true,
              error: null,
            });

            // Dispatch global event for visual flash
            window.dispatchEvent(new CustomEvent('rate-updated', { detail: newRates }));
          } catch (err) {
            console.warn('[RatesSSE] Parse error:', err);
          }
        };

        eventSource.onerror = () => {
          set({ isLiveStreaming: false });
          eventSource?.close();
          // Auto reconnect after 5s
          setTimeout(connect, 5000);
        };
      } catch (err) {
        console.warn('[RatesSSE] Connection error:', err);
        set({ isLiveStreaming: false });
      }
    };

    connect();
  },

  fetchRates: async () => {
    set({ isLoading: true, error: null });

    try {
      // 1. Try local dedicated refresh endpoint
      const response = await fetch('/api/rates/refresh', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();

        // Si el backend incluye la tasa activa del sistema, sincronizarla
        if (
          data.activeSource &&
          ['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(data.activeSource)
        ) {
          if (get().activeSource !== data.activeSource) {
            await get().applyServerActiveSource(data.activeSource);
          }
        }

        const newRates = {
          bcv_usd: parseFloat(Number(data.bcv_usd).toFixed(2)),
          bcv_eur: parseFloat(Number(data.bcv_eur).toFixed(2)),
          binance_usdt: parseFloat(Number(data.binance_usdt).toFixed(2)),
        };

        await saveRate('bcv_usd', newRates.bcv_usd);
        await saveRate('bcv_eur', newRates.bcv_eur);
        await saveRate('binance_usdt', newRates.binance_usdt);

        set({
          rates: newRates,
          lastUpdate: data.lastUpdated || Date.now(),
          sourcesInfo: data.sources || get().sourcesInfo,
          isLoading: false,
        });
        return;
      }
    } catch (localErr) {
      console.warn('[ExchangeRateService] Local API refresh failed, attempting fallback:', localErr);
    }

    // 2. Direct upstream fallback if backend is not reachable
    try {
      const [usdRes, eurRes] = await Promise.all([
        fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(6000) }),
        fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: AbortSignal.timeout(6000) }),
      ]);

      if (usdRes.ok) {
        const usdData = await usdRes.json();
        const usd = parseFloat(usdData.promedio || '0');
        let eur = 0;
        if (eurRes.ok) {
          const eurData = await eurRes.json();
          eur = parseFloat(eurData.promedio || '0');
        } else {
          eur = usd * 1.16;
        }

        if (usd > 0) {
          await saveRate('bcv_usd', usd);
          await saveRate('bcv_eur', eur);
          set((state) => ({
            rates: { ...state.rates, bcv_usd: usd, bcv_eur: eur },
            lastUpdate: Date.now(),
          }));
        }
      }
    } catch (fallbackErr) {
      console.warn('[ExchangeRateService] Direct fallback failed:', fallbackErr);
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveSource: async (source: RateSource) => {
    // 1. Actualización inmediata y síncrona en memoria
    set({ activeSource: source });

    // 2. Persistencia síncrona en localStorage (sobrevive F5, reinicios y navegación)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ACTIVE_RATE_STORAGE_KEY, source);
      } catch (e) {
        console.warn('[ExchangeRateService] Error guardando tasa activa en localStorage:', e);
      }
    }

    // 3. Persistencia en Dexie IndexedDB
    try {
      const allRates = await db.exchangeRates.toArray();
      if (allRates.length > 0) {
        for (const r of allRates) {
          if (r.id) {
            await db.exchangeRates.update(r.id, { isActive: r.source === source });
          }
        }
      } else {
        const sources: RateSource[] = ['bcv_usd', 'bcv_eur', 'binance_usdt'];
        for (const s of sources) {
          await db.exchangeRates.add({
            source: s,
            rate: get().rates[s] || 0,
            timestamp: Date.now(),
            isActive: s === source,
          });
        }
      }
    } catch (err) {
      console.warn('[ExchangeRateService] Error guardando tasa activa en Dexie:', err);
    }

    // 4. Notificar al backend para sincronizar en red local LAN
    try {
      await fetch('/api/rates/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeSource: source }),
      });
    } catch (e) {
      console.warn('[ExchangeRateService] Error notificando cambio de tasa al backend:', e);
    }

    // 5. Notificar a componentes locales
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sbm:active-rate-changed', { detail: { activeSource: source } })
      );
    }
  },

  manualSetRate: async (source: RateSource, rate: number) => {
    await saveRate(source, rate);
    set((state) => ({
      rates: { ...state.rates, [source]: rate },
      lastUpdate: Date.now(),
    }));
  },

  getActiveRate: (): number => {
    const { rates, activeSource } = get();
    return rates[activeSource] || 0;
  },
}));

// ─── Sincronización entre Pestañas y Ventanas ────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_RATE_STORAGE_KEY && event.newValue) {
      const newSource = event.newValue as RateSource;
      if (newSource === 'bcv_usd' || newSource === 'bcv_eur' || newSource === 'binance_usdt') {
        const current = useExchangeRateStore.getState().activeSource;
        if (current !== newSource) {
          useExchangeRateStore.setState({ activeSource: newSource });
        }
      }
    }
  });
}

// ─── Persistence Helper ────────────────────────────────────────

async function saveRate(source: RateSource, rate: number): Promise<void> {
  try {
    const currentActive = useExchangeRateStore.getState().activeSource;
    const existing = await db.exchangeRates.where('source').equals(source).first();
    if (existing?.id) {
      await db.exchangeRates.update(existing.id, {
        rate,
        timestamp: Date.now(),
        // NUNCA sobreescribir la tasa activa con un sondeo de fondo
        isActive: source === currentActive,
      });
    } else {
      await db.exchangeRates.add({
        source,
        rate,
        timestamp: Date.now(),
        // Solo marcar activo si coincide con la tasa actualmente fijada por el usuario
        isActive: source === currentActive,
      });
    }
  } catch (e) {
    console.warn('[ExchangeRateService] DB save warning:', e);
  }
}

// ─── Poller & Live Stream Initializer ───────────────────────────

let isInitialized = false;

export function startRatePolling(intervalMs: number = 2000): void {
  if (isInitialized) return;
  isInitialized = true;

  const store = useExchangeRateStore.getState();

  // 1. Initial fetch
  store.fetchRates();

  // 2. High-speed reactive polling every 2s for rates and active source
  setInterval(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch('/api/rates', {
          cache: 'no-store',
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const data = await res.json();
          if (
            data?.activeSource &&
            ['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(data.activeSource)
          ) {
            if (useExchangeRateStore.getState().activeSource !== data.activeSource) {
              console.log(`[RatePolling] ⚡ Tasa activa actualizada desde el servidor: ${data.activeSource}`);
              await useExchangeRateStore.getState().applyServerActiveSource(data.activeSource);
            }
          }
          if (data?.bcv_usd) {
            useExchangeRateStore.setState((state) => ({
              rates: {
                bcv_usd: parseFloat(Number(data.bcv_usd).toFixed(2)),
                bcv_eur: parseFloat(Number(data.bcv_eur).toFixed(2)),
                binance_usdt: parseFloat(Number(data.binance_usdt).toFixed(2)),
              },
              lastUpdate: data.lastUpdated || Date.now(),
            }));
          }
        }
      } catch {}
    }
  }, intervalMs);
}

export function stopRatePolling(): void {
  // Kept for interface compatibility
}

// ─── Currency Conversion Helpers ────────────────────────────────

export function usdToVes(usd: number): number {
  const rate = useExchangeRateStore.getState().getActiveRate();
  return usd * rate;
}

export function vesToUsd(ves: number): number {
  const rate = useExchangeRateStore.getState().getActiveRate();
  return rate > 0 ? ves / rate : 0;
}

export function formatCurrency(amount: number, currency: 'USD' | 'VES' | 'EUR' | 'USDT'): string {
  if (currency === 'VES') {
    return `Bs. ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'EUR') {
    return `€${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'USDT') {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatUnitPlural(unitType?: string, count: number = 1): string {
  if (!unitType) return count === 1 ? 'ud' : 'uds';
  const lower = unitType.trim().toLowerCase();
  if (count === 1) return lower;
  if (lower === 'unidad') return 'unidades';
  if (lower === 'kilo') return 'kilos';
  if (lower === 'caja') return 'cajas';
  if (lower === 'bulto') return 'bultos';
  if (lower === 'paquete') return 'paquetes';
  if (lower === 'docena') return 'docenas';
  if (lower === 'bolsa') return 'bolsas';
  if (lower === 'litro') return 'litros';
  if (lower === 'rollo') return 'rollos';
  return `${lower}s`;
}

