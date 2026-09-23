import fs from 'fs';
import path from 'path';

const DB_FILE = path.resolve(process.cwd(), 'database', 'central_db.json');
const syncSseClients: Set<any> = new Set();

// SSE keepalive ping every 10 seconds to keep mobile and proxy connections alive
const syncKeepAliveTimer = setInterval(() => {
  if (syncSseClients.size > 0) {
    broadcastSyncEvent({ type: 'ping', time: Date.now() });
  }
}, 10000);
if (syncKeepAliveTimer?.unref) {
  syncKeepAliveTimer.unref();
}

const DEFAULT_OFFICIAL_ACCOUNTS = [
  { id: 1, bankName: 'Banesco', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#007953', icon: '🏦', order: 0 },
  { id: 2, bankName: 'Banco de Venezuela', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#003366', icon: '🏛️', order: 1 },
  { id: 3, bankName: 'Binance', accountType: 'Crypto', currency: 'USDT', balance: 0, cardLast4: '----', color: '#F0B90B', icon: '₿', order: 2 },
  { id: 4, bankName: 'Banco Nacional de Crédito', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#005C42', icon: '💳', order: 3 },
  { id: 5, bankName: 'Banco Mercantil', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#002868', icon: '🏦', order: 4 },
  { id: 6, bankName: 'Banco Digital de los Trabajadores', accountType: 'Corriente Digital', currency: 'VES', balance: 0, cardLast4: '0000', color: '#0D1B2A', icon: '⚡', order: 5 },
  { id: 7, bankName: 'Efectivo en Bolívares', accountType: 'Caja Chica', currency: 'VES', balance: 0, cardLast4: '----', color: '#0F4C3A', icon: '🇻🇪', order: 6 },
  { id: 8, bankName: 'Efectivo Divisas', accountType: 'Caja Fuerte', currency: 'USD', balance: 0, cardLast4: '----', color: '#064E3B', icon: '💵', order: 7 },
];

// Initial database template
function getInitialDb() {
  return {
    products: [],
    accounts: DEFAULT_OFFICIAL_ACCOUNTS,
    transactions: [],
    clients: [],
    losses: [],
    dispatches: [],
    productionBatches: [],
    cashClosures: [],
    exchangeRates: [],
    users: [],
    settings: [],
    lastUpdated: Date.now(),
  };
}

export function loadCentralDb(): any {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const init = getInitialDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf-8');
      return init;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.accounts) || data.accounts.length === 0 || !data.accounts[0]?.bankName) {
      const existingBal = data.accounts?.[0]?.balance || 0;
      data.accounts = DEFAULT_OFFICIAL_ACCOUNTS.map((acc, i) =>
        i === 0 && existingBal ? { ...acc, balance: existingBal } : acc
      );
      saveCentralDb(data);
    }
    return data;
  } catch (e) {
    console.error('[SyncServer] Error cargando central_db.json:', e);
    return getInitialDb();
  }
}

export function saveCentralDb(data: any): void {
  try {
    data.lastUpdated = Date.now();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('[SyncServer] Error guardando central_db.json:', e);
  }
}

export function broadcastSyncEvent(event: any): void {
  const msg = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of syncSseClients) {
    try {
      client.write(msg);
    } catch {
      syncSseClients.delete(client);
    }
  }
}

export function handleSyncMiddleware(req: any, res: any): boolean {
  const url = req.url?.split('?')[0];

  // 1. GET /api/sync/pull (Devuelve toda la base de datos central)
  if (url === '/api/sync/pull' && req.method === 'GET') {
    const data = loadCentralDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify(data));
    return true;
  }

  // 2. POST /api/sync/push (Recibe cambios individuales o en lote)
  if (url === '/api/sync/push' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const centralDb = loadCentralDb();

        if (Array.isArray(payload)) {
          // Bulk items from syncQueue
          for (const item of payload) {
            applyChangeToCentralDb(centralDb, item);
          }
          saveCentralDb(centralDb);
          for (const item of payload) {
            broadcastSyncEvent({ type: 'sync_update', payload: item });
          }
        } else {
          applyChangeToCentralDb(centralDb, payload);
          saveCentralDb(centralDb);
          broadcastSyncEvent({ type: 'sync_update', payload });
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: err?.message }));
      }
    });
    return true;
  }

  // 3. GET /api/sync/stream (SSE en tiempo real para todos los dispositivos conectados en la red)
  if (url === '/api/sync/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`);
    syncSseClients.add(res);

    req.on('close', () => {
      syncSseClients.delete(res);
    });
    return true;
  }

  // 4. POST /api/sync/reset (Reseteo de fábrica central en red local)
  if (url === '/api/sync/reset' && req.method === 'POST') {
    try {
      const blankDb = getInitialDb();
      saveCentralDb(blankDb);
      broadcastSyncEvent({ type: 'sync_reset', time: Date.now() });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: err?.message }));
    }
    return true;
  }

  // 5. POST /api/sync/restore (Restauración completa autorizada con persistencia en el servidor)
  if (url === '/api/sync/restore' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const tables = payload.tables || payload;
        const currentDb = loadCentralDb();

        const validTables = [
          'products',
          'accounts',
          'transactions',
          'clients',
          'losses',
          'dispatches',
          'productionBatches',
          'cashClosures',
          'exchangeRates',
          'users',
          'settings',
          'auditLog',
        ];

        for (const t of validTables) {
          if (Array.isArray(tables[t])) {
            currentDb[t] = tables[t];
          }
        }
        currentDb.lastUpdated = Date.now();
        saveCentralDb(currentDb);

        // Guardar copia histórica en disco en el servidor
        try {
          const backupsDir = path.resolve(process.cwd(), 'database', 'backups');
          if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
          }
          const backupFileName = `snapshot_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
          fs.writeFileSync(
            path.join(backupsDir, backupFileName),
            JSON.stringify(currentDb, null, 2),
            'utf-8'
          );
        } catch (e) {
          console.warn('[SyncServer] Error guardando copia histórica:', e);
        }

        // Difundir a todos los dispositivos que hubo restauración completa
        broadcastSyncEvent({
          type: 'sync_update',
          fullSync: true,
          restored: true,
          timestamp: Date.now(),
        });

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ success: true, timestamp: Date.now() }));
      } catch (err: any) {
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ success: false, error: err?.message }));
      }
    });
    return true;
  }

  return false;
}

function applyChangeToCentralDb(db: any, item: any): void {
  const table = item.table;
  if (!table) return;
  if (!Array.isArray(db[table])) {
    db[table] = [];
  }

  const list: any[] = db[table];
  const recordId = item.recordId;
  const data = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : {};
  const targetId = recordId || data.id;

  if (item.operation === 'delete') {
    db[table] = list.filter((r) => r.id !== targetId);
  } else {
    // create or update
    const idx = list.findIndex((r) => r.id === targetId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...data, id: targetId };
    } else {
      list.push({ ...data, id: targetId });
    }
  }
}
