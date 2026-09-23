// ─── Standalone Rate Server for Production ───────────────────────
// Usage: node server/standalone.js [port]

import http from 'http';
import { updateRates, fetchBCVRates, fetchBinanceRate } from './rates-service.ts';
import { loadCentralDb, saveCentralDb } from './sync-service.ts';

const PORT = parseInt(process.env.PORT || process.argv[2] || '3001', 10);
const sseClients = new Set();

let activeRateSource = 'bcv_usd';
try {
  const central = loadCentralDb();
  if (central?.activeRateSource) {
    activeRateSource = central.activeRateSource;
  }
} catch {}

let currentRates = {
  bcv_usd: 842.21,
  bcv_eur: 977.88,
  binance_usdt: 958.00,
  activeSource: activeRateSource,
  lastUpdated: Date.now(),
  sources: {
    bcv_usd: 'BCV Oficial (API)',
    bcv_eur: 'BCV Oficial (API)',
    binance_usdt: 'Binance P2P Direct',
  },
};

async function syncRates() {
  try {
    const [bcv, binance] = await Promise.all([fetchBCVRates(), fetchBinanceRate()]);
    let changed = false;

    if (bcv) {
      if (Math.abs(bcv.usd - currentRates.bcv_usd) > 0.001) changed = true;
      currentRates.bcv_usd = bcv.usd;
      currentRates.bcv_eur = bcv.eur;
      currentRates.sources.bcv_usd = bcv.source;
      currentRates.sources.bcv_eur = bcv.source;
    }

    if (binance) {
      if (Math.abs(binance.usdt - currentRates.binance_usdt) > 0.001) changed = true;
      currentRates.binance_usdt = binance.usdt;
      currentRates.sources.binance_usdt = binance.source;
    }

    currentRates.lastUpdated = Date.now();

    if (changed) {
      console.log(`[RateServer] 🔔 Tasa cambiada: USD ${currentRates.bcv_usd} | USDT ${currentRates.binance_usdt}`);
      broadcast(currentRates);
    }
  } catch (err) {
    console.error('[RateServer] Error syncing:', err.message);
  }
}

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(msg);
    } catch {
      sseClients.delete(res);
    }
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split('?')[0];

  if (url === '/api/rates/active') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ activeSource: currentRates.activeSource || 'bcv_usd' }));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          if (payload?.activeSource) {
            currentRates.activeSource = payload.activeSource;
            try {
              const central = loadCentralDb();
              central.activeRateSource = currentRates.activeSource;
              saveCentralDb(central);
            } catch {}
            broadcast({ ...currentRates });
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, activeSource: currentRates.activeSource }));
        } catch {
          res.writeHead(400);
          res.end();
        }
      });
      return;
    }
  }

  if (url === '/api/rates' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(currentRates));
    return;
  }

  if (url === '/api/rates/refresh' && req.method === 'POST') {
    syncRates().then(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(currentRates));
    });
    return;
  }

  if (url === '/api/rates/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify(currentRates)}\n\n`);
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`[RateServer] 🚀 Servidor de tasas dedicado corriendo en http://localhost:${PORT}`);
  syncRates();
  setInterval(syncRates, 20000);
});
