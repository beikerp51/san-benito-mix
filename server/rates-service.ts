// ─── Real-Time Exchange Rate API Service for San Benito Mix ────────
// Dedicated Backend Service & SSE Stream for BCV USD, BCV EUR, and Binance USDT
import { handleSyncMiddleware, loadCentralDb, saveCentralDb, broadcastSyncEvent } from './sync-service.ts';

let activeRateSource = 'bcv_usd';
try {
  const central = loadCentralDb();
  if (central?.activeRateSource) {
    activeRateSource = central.activeRateSource;
  }
} catch {}

interface RateData {
  bcv_usd: number;
  bcv_eur: number;
  binance_usdt: number;
  activeSource: string;
  lastUpdated: number;
  sources: {
    bcv_usd: string;
    bcv_eur: string;
    binance_usdt: string;
  };
  change?: {
    bcv_usd?: number;
    bcv_eur?: number;
    binance_usdt?: number;
  };
}

let cachedRates: RateData = {
  bcv_usd: 842.21,
  bcv_eur: 977.88,
  binance_usdt: 958.50,
  activeSource: activeRateSource,
  lastUpdated: Date.now(),
  sources: {
    bcv_usd: 'BCV Oficial (DolarAPI)',
    bcv_eur: 'BCV Oficial (DolarAPI)',
    binance_usdt: 'Binance P2P (Oficial)',
  },
};

const sseClients: Set<any> = new Set();
let isPolling = false;
let pollTimer: NodeJS.Timeout | null = null;

// ─── Fetchers ───────────────────────────────────────────────────

export async function fetchBCVRates(): Promise<{ usd: number; eur: number; source: string } | null> {
  // Source 1: DolarAPI Venezuela (Fast & official BCV rates)
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: AbortSignal.timeout(8000) }),
      fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: AbortSignal.timeout(8000) }),
    ]);

    if (usdRes.ok) {
      const usdData = (await usdRes.json()) as any;
      const usd = parseFloat(usdData?.promedio || usdData?.price || '0');

      let eur = 0;
      if (eurRes.ok) {
        const eurData = (await eurRes.json()) as any;
        eur = parseFloat(eurData?.promedio || eurData?.price || '0');
      } else {
        eur = usd * 1.16; // Reasonable fallback ratio
      }

      if (usd > 0) {
        return { usd, eur, source: 'BCV Oficial (DolarAPI)' };
      }
    }
  } catch (err: any) {
    console.warn('[RatesAPI] DolarAPI error:', err.message);
  }

  // Fallback 1: pyDolarVE
  try {
    const res = await fetch('https://pydolarve.org/api/v1/dollar?monitor=bcv', {
      headers: { 'User-Agent': 'SanBenitoMix/2026' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const usd = parseFloat(data?.price || data?.USD?.price || '0');
      const eur = parseFloat(data?.EUR?.price || String(usd * 1.16));
      if (usd > 0) {
        return { usd, eur, source: 'BCV Oficial (pyDolarVE)' };
      }
    }
  } catch (err: any) {
    console.warn('[RatesAPI] pyDolarVE error:', err.message);
  }

  // Fallback 2: bcv-api
  try {
    const res = await fetch('https://bcv-api.deno.dev/v1/exchange', {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const usd = parseFloat(data?.usd || data?.USD || '0');
      const eur = parseFloat(data?.eur || data?.EUR || String(usd * 1.16));
      if (usd > 0) {
        return { usd, eur, source: 'BCV Oficial (Deno API)' };
      }
    }
  } catch (err: any) {
    console.warn('[RatesAPI] bcv-api error:', err.message);
  }

  return null;
}

export async function fetchBinanceRate(): Promise<{ usdt: number; source: string } | null> {
  // Source 1: Direct Binance P2P API (Order book SELL - merchant bids)
  try {
    const res = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'VES',
        merchantCheck: false,
        page: 1,
        payTypes: [],
        rows: 10,
        tradeType: 'SELL',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const json = (await res.json()) as any;
      const ads = json?.data || [];
      if (ads.length > 0) {
        let totalVol = 0;
        let weightedPrice = 0;
        for (const item of ads) {
          const price = parseFloat(item?.adv?.price || '0');
          const vol = parseFloat(item?.adv?.surplusAmount || '1');
          if (price > 0) {
            weightedPrice += price * vol;
            totalVol += vol;
          }
        }
        const avg = totalVol > 0 ? weightedPrice / totalVol : parseFloat(ads[0]?.adv?.price || '0');
        if (avg > 0) {
          return { usdt: parseFloat(avg.toFixed(2)), source: 'Binance P2P Direct' };
        }
      }
    }
  } catch (err: any) {
    console.warn('[RatesAPI] Binance Direct error:', err.message);
  }

  // Fallback 1: DolarAPI Paralelo (Tracks Binance / Parallel market)
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as any;
      const usdt = parseFloat(data?.promedio || data?.price || '0');
      if (usdt > 0) {
        return { usdt, source: 'Mercado Paralelo / USDT (DolarAPI)' };
      }
    }
  } catch (err: any) {
    console.warn('[RatesAPI] DolarAPI Paralelo error:', err.message);
  }

  return null;
}

// ─── Rate Poller & Broadcaster ──────────────────────────────────

export async function updateRates(): Promise<RateData> {
  if (isPolling) return cachedRates;
  isPolling = true;

  try {
    const [bcvResult, binanceResult] = await Promise.all([
      fetchBCVRates(),
      fetchBinanceRate(),
    ]);

    let hasChanged = false;
    const newRates: RateData = {
      ...cachedRates,
      activeSource: activeRateSource,
      lastUpdated: Date.now(),
      change: {},
    };

    if (bcvResult) {
      if (Math.abs(bcvResult.usd - cachedRates.bcv_usd) > 0.001) {
        hasChanged = true;
        newRates.change!.bcv_usd = bcvResult.usd - cachedRates.bcv_usd;
      }
      newRates.bcv_usd = bcvResult.usd;
      newRates.bcv_eur = bcvResult.eur;
      newRates.sources.bcv_usd = bcvResult.source;
      newRates.sources.bcv_eur = bcvResult.source;
    }

    if (binanceResult) {
      if (Math.abs(binanceResult.usdt - cachedRates.binance_usdt) > 0.001) {
        hasChanged = true;
        newRates.change!.binance_usdt = binanceResult.usdt - cachedRates.binance_usdt;
      }
      newRates.binance_usdt = binanceResult.usdt;
      newRates.sources.binance_usdt = binanceResult.source;
    }

    cachedRates = newRates;

    // Broadcast update via SSE
    broadcastRates(newRates);

    if (hasChanged) {
      console.log(
        `[RatesAPI] 🔔 ¡Tasas Actualizadas! USD: ${cachedRates.bcv_usd} Bs | EUR: ${cachedRates.bcv_eur} Bs | USDT: ${cachedRates.binance_usdt} Bs`
      );
    }
  } catch (error: any) {
    console.error('[RatesAPI] Error updating rates:', error.message);
  } finally {
    isPolling = false;
  }

  return cachedRates;
}

function broadcastRates(rates: RateData) {
  const payload = {
    ...rates,
    activeSource: activeRateSource,
  };
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function startBackgroundPoller(intervalMs: number = 20000) {
  if (pollTimer) return;
  // Run immediately
  updateRates();
  pollTimer = setInterval(() => {
    updateRates();
  }, intervalMs);
  console.log(`[RatesAPI] ✅ Background rate poller active (cada ${intervalMs / 1000}s)`);
}

// ─── Vite Plugin ────────────────────────────────────────────────

export function ratesApiPlugin() {
  return {
    name: 'san-benito-rates-api',
    configureServer(server: any) {
      startBackgroundPoller(20000); // Polling every 20 seconds for instant updates

      server.middlewares.use((req: any, res: any, next: any) => {
        // Manejar sincronización multidispositivo en red local
        if (handleSyncMiddleware(req, res)) {
          return;
        }

        const url = req.url?.split('?')[0];

        // 0. GET & POST /api/rates/active (Fijación persistente de la tasa seleccionada por el usuario)
        if (url === '/api/rates/active') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ activeSource: activeRateSource }));
            return;
          }
          if (req.method === 'POST') {
            const handlePayload = (payload: any) => {
              if (
                payload?.activeSource &&
                ['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(payload.activeSource)
              ) {
                activeRateSource = payload.activeSource;
                cachedRates.activeSource = activeRateSource;
                try {
                  const central = loadCentralDb();
                  central.activeRateSource = activeRateSource;
                  saveCentralDb(central);
                } catch {}
                console.log(`[RatesAPI] 🔒 Tasa fijada en el servidor y transmitida a todos los clientes: ${activeRateSource}`);
                // Transmitir inmediatamente el cambio de tasa a todos los clientes (móviles y PCs)
                broadcastRates(cachedRates);
                broadcastSyncEvent({ type: 'rate_source_changed', activeSource: activeRateSource });
              }
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ success: true, activeSource: activeRateSource }));
            };

            if (req.body && typeof req.body === 'object') {
              handlePayload(req.body);
              return;
            }

            let body = '';
            req.on('data', (chunk: any) => {
              body += chunk.toString();
            });
            req.on('end', () => {
              let payload: any = {};
              try {
                payload = body ? JSON.parse(body) : {};
              } catch {
                const match = body.match(/activeSource["':\s]+([a-zA-Z_]+)/);
                if (match && match[1]) {
                  payload = { activeSource: match[1] };
                }
              }
              handlePayload(payload);
            });
            return;
          }
        }

        // 1. GET /api/rates
        if (url === '/api/rates' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ ...cachedRates, activeSource: activeRateSource }));
          return;
        }

        // 2. POST /api/rates/refresh
        if (url === '/api/rates/refresh' && req.method === 'POST') {
          updateRates().then((rates) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.end(JSON.stringify({ ...rates, activeSource: activeRateSource }));
          });
          return;
        }

        // 3. GET /api/rates/stream (Server-Sent Events)
        if (url === '/api/rates/stream' && req.method === 'GET') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });

          // Send immediate current rates with activeSource
          res.write(`data: ${JSON.stringify({ ...cachedRates, activeSource: activeRateSource })}\n\n`);

          // Register client
          sseClients.add(res);

          req.on('close', () => {
            sseClients.delete(res);
          });
          return;
        }

        next();
      });
    },
  };
}
