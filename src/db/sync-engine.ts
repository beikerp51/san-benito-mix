import { db } from './database';
import { getSupabaseClient } from '../services/supabase-client';
import { useExchangeRateStore } from '../services/exchange-rate-service';

// ─── Network Status ─────────────────────────────────────────────

export type NetworkStatus = 'online' | 'offline';

let networkStatus: NetworkStatus = navigator.onLine ? 'online' : 'offline';
const listeners: Set<(status: NetworkStatus) => void> = new Set();

export function getNetworkStatus(): NetworkStatus {
  return networkStatus;
}

export function onNetworkChange(callback: (status: NetworkStatus) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setNetworkStatus(status: NetworkStatus) {
  networkStatus = status;
  listeners.forEach((cb) => cb(status));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    setNetworkStatus('online');
    console.log('[SyncEngine] 🌐 Conexión restablecida. Sincronizando datos...');
    initLocalServerSync();
    initRealtimeSubscription();
    await processQueue();
    await pullFromLocalServer();
    await pullAllFromCloud().catch(console.error);
    window.dispatchEvent(new CustomEvent('sbm:sync', { detail: { reconnected: true } }));
  });

  window.addEventListener('offline', () => {
    setNetworkStatus('offline');
    console.log('[SyncEngine] 📴 Modo sin conexión. Las operaciones se guardarán localmente.');
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        initLocalServerSync();
        processQueue().catch(() => {});
        pullFromLocalServer().catch(() => {});
      }
    });
  }
}

// ─── Table Name Mapping (Dexie <-> Supabase) ────────────────────

const TABLE_MAP: Record<string, string> = {
  products: 'products',
  losses: 'losses',
  accounts: 'accounts',
  transactions: 'transactions',
  auditLog: 'audit_log',
  clients: 'clients',
  dispatches: 'dispatches',
  productionBatches: 'production_batches',
  cashClosures: 'cash_closures',
  exchangeRates: 'exchange_rates',
  users: 'users',
  settings: 'settings',
};

function keyToSnake(key: string): string {
  return key
    .replace(/USD/g, '_usd')
    .replace(/VES/g, '_ves')
    .replace(/USDT/g, '_usdt')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/__+/g, '_')
    .replace(/^_/, '');
}

function keyToCamel(key: string): string {
  return key
    .replace(/_usd/g, 'USD')
    .replace(/_ves/g, 'VES')
    .replace(/_usdt/g, 'USDT')
    .replace(/_([a-z0-9])/g, (_, g) => g.toUpperCase());
}

function objectToSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(objectToSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [keyToSnake(k), objectToSnake(v)])
    );
  }
  return obj;
}

function objectToCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(objectToCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [keyToCamel(k), objectToCamel(v)])
    );
  }
  return obj;
}

// ─── Sync Queue Processor (Push Local -> Supabase) ──────────────

const MAX_RETRIES = 5;
let isProcessing = false;

export async function processQueue(): Promise<void> {
  if (isProcessing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  isProcessing = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbm:sync_status', { detail: { status: 'syncing' } }));
  }

  try {
    const allItems = await db.syncQueue.toArray();
    const pending = allItems
      .filter((item) => !item.synced && item.retries < MAX_RETRIES)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (pending.length === 0) return;

    const supabase = getSupabaseClient();

    for (const item of pending) {
      let localPushed = false;
      let cloudPushed = false;

      // 1. Sincronizar inmediatamente con el servidor local/red
      try {
        await pushItemToLocalServer(item);
        localPushed = true;
      } catch (err: any) {
        // Error de red local
      }

      // 2. Sincronizar con Supabase si está vinculado y en línea
      if (supabase && navigator.onLine) {
        try {
          await pushItemToSupabase(supabase, item);
          cloudPushed = true;
        } catch (err: any) {
          // Error de Supabase
        }
      }

      // Si se logró sincronizar en al menos un destino (o solo había local y funcionó)
      if (localPushed || (supabase && cloudPushed)) {
        await db.syncQueue.update(item.id!, { synced: true, timestamp: Date.now() });
      } else {
        // Si no hay red disponible, no quemar reintentos y esperar a reconexión
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          break;
        }
        const nextRetries = item.retries + 1;
        await db.syncQueue.update(item.id!, {
          retries: nextRetries,
          synced: nextRetries >= MAX_RETRIES, // evitar bloqueo infinito si el dato es inválido
        });
      }
    }
  } finally {
    isProcessing = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sbm:sync_status', { detail: { status: 'synced', time: Date.now() } }));
    }
  }
}

// Escuchar cambios locales inmediatos desde addWithSync / updateWithSync / deleteWithSync
if (typeof window !== 'undefined') {
  window.addEventListener('sbm:queue_item_added', () => {
    processQueue().catch(() => {});
  });
}

async function pushItemToSupabase(supabase: any, item: any): Promise<void> {
  const remoteTable = TABLE_MAP[item.table] || item.table;
  const parsedData = item.data ? JSON.parse(item.data) : {};
  const snakePayload = objectToSnake(parsedData);

  if (item.operation === 'delete') {
    const { error } = await supabase.from(remoteTable).delete().eq('id', item.recordId);
    if (error) throw error;
  } else {
    // create or update -> upsert
    const { error } = await supabase.from(remoteTable).upsert(snakePayload, { onConflict: 'id' });
    if (error) throw error;
  }
}

// ─── Pull Remote Changes (Supabase -> Dexie) ────────────────────

export async function pullAllFromCloud(): Promise<{ count: number; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase || !navigator.onLine) {
    return { count: 0, error: 'Supabase no está configurado o el equipo está sin conexión.' };
  }

  let totalUpdated = 0;

  try {
    const syncableTables: Array<{ local: keyof typeof db; remote: string }> = [
      { local: 'products' as any, remote: 'products' },
      { local: 'accounts' as any, remote: 'accounts' },
      { local: 'transactions' as any, remote: 'transactions' },
      { local: 'clients' as any, remote: 'clients' },
      { local: 'losses' as any, remote: 'losses' },
      { local: 'dispatches' as any, remote: 'dispatches' },
      { local: 'productionBatches' as any, remote: 'production_batches' },
      { local: 'cashClosures' as any, remote: 'cash_closures' },
      { local: 'exchangeRates' as any, remote: 'exchange_rates' },
    ];

    for (const mapping of syncableTables) {
      const { data, error } = await supabase.from(mapping.remote).select('*').limit(2000);
      if (error) {
        console.warn(`[SyncEngine] No se pudo leer tabla remota ${mapping.remote}:`, error);
        continue;
      }

      if (data && data.length > 0) {
        const camelRecords = data.map(objectToCamel);
        const tableObj = (db as any)[mapping.local];
        if (tableObj && typeof tableObj.bulkPut === 'function') {
          await tableObj.bulkPut(camelRecords);
          totalUpdated += camelRecords.length;
        }
      }
    }

    console.log(`[SyncEngine] ✅ Pull completado. ${totalUpdated} registros sincronizados desde Supabase.`);
    return { count: totalUpdated };
  } catch (err: any) {
    console.error('[SyncEngine] Error durante pull:', err);
    return { count: totalUpdated, error: err?.message || 'Fallo de sincronización' };
  }
}

// ─── Push Everything from Local to Supabase ─────────────────────

export async function pushAllToCloud(): Promise<{ count: number; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase || !navigator.onLine) {
    return { count: 0, error: 'Supabase no está configurado o estás sin conexión.' };
  }

  let totalPushed = 0;

  try {
    const tables: Array<{ localTable: keyof typeof db; remoteName: string }> = [
      { localTable: 'products' as any, remoteName: 'products' },
      { localTable: 'accounts' as any, remoteName: 'accounts' },
      { localTable: 'transactions' as any, remoteName: 'transactions' },
      { localTable: 'clients' as any, remoteName: 'clients' },
      { localTable: 'losses' as any, remoteName: 'losses' },
      { localTable: 'dispatches' as any, remoteName: 'dispatches' },
      { localTable: 'productionBatches' as any, remoteName: 'production_batches' },
      { localTable: 'cashClosures' as any, remoteName: 'cash_closures' },
      { localTable: 'exchangeRates' as any, remoteName: 'exchange_rates' },
    ];

    for (const t of tables) {
      const localRecords = await (db as any)[t.localTable].toArray();
      if (localRecords.length === 0) continue;

      const payload = localRecords.map(objectToSnake);
      const { error } = await supabase.from(t.remoteName).upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn(`[SyncEngine] Error subiendo ${t.remoteName}:`, error);
      } else {
        totalPushed += payload.length;
      }
    }

    return { count: totalPushed };
  } catch (err: any) {
    return { count: totalPushed, error: err?.message || 'Error al subir datos' };
  }
}

// ─── Realtime Subscriptions (Multidispositivo) ──────────────────

let realtimeChannel: any = null;

export function initRealtimeSubscription(): void {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel('sbm_realtime_sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public' },
      async (payload: any) => {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;
        const localTableName = Object.entries(TABLE_MAP).find(([, r]) => r === table)?.[0];
        if (!localTableName) return;

        const tableObj = (db as any)[localTableName];
        if (!tableObj) return;

        try {
          if (eventType === 'DELETE' && oldRecord?.id) {
            await tableObj.delete(oldRecord.id);
          } else if (newRecord) {
            const camelData = objectToCamel(newRecord);
            await tableObj.put(camelData);
          }
          console.log(`[SyncEngine Realtime] ⚡ Actualización recibida para ${table} (${eventType})`);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sbm:sync', { detail: { table: localTableName, eventType, source: 'supabase_realtime' } }));
            window.dispatchEvent(new CustomEvent('sbm:sync_status', { detail: { status: 'synced', time: Date.now(), source: 'supabase' } }));
          }
        } catch (e) {
          console.warn('[SyncEngine Realtime] Error aplicando cambio remoto:', e);
        }
      }
    )
    .subscribe((status: string) => {
      console.log(`[SyncEngine Realtime] Estado canal: ${status}`);
    });
}

// ─── Force Immediate Sync (Ares & Manual Trigger) ───────────────

export async function forceSyncAll(): Promise<number> {
  await processQueue();
  await pullAllFromCloud();
  return 1;
}

// ─── Sync Statistics (for Ares Dashboard) ───────────────────────

export interface SyncStats {
  pending: number;
  synced: number;
  failed: number;
  lastSyncTimestamp: number | null;
}

export async function getSyncStats(): Promise<SyncStats> {
  const allItems = await db.syncQueue.toArray();

  const pending = allItems.filter((i) => !i.synced && i.retries < MAX_RETRIES).length;
  const synced = allItems.filter((i) => i.synced).length;
  const failed = allItems.filter((i) => !i.synced && i.retries >= MAX_RETRIES).length;

  const lastSynced = allItems
    .filter((i) => i.synced)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return {
    pending,
    synced,
    failed,
    lastSyncTimestamp: lastSynced?.timestamp || (synced > 0 ? Date.now() : null),
  };
}

// ─── Cleanup (Ares System Cleaner) ──────────────────────────────

export async function cleanupSyncedItems(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<number> {
  const allItems = await db.syncQueue.toArray();
  const synced = allItems.filter((item) => item.synced);
  const ids = synced.map((i) => i.id!).filter(Boolean);
  if (ids.length > 0) {
    await db.syncQueue.bulkDelete(ids);
  }
  return ids.length;
}

// ─── Local Server Sync (Multidispositivo en Red / LAN) ──────────

async function pushItemToLocalServer(item: any): Promise<void> {
  const res = await fetch('/api/sync/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) {
    throw new Error(`Servidor local respondió con status ${res.status}`);
  }
}

export async function pullFromLocalServer(): Promise<number> {
  try {
    const res = await fetch('/api/sync/pull');
    if (!res.ok) return 0;
    const centralDb = await res.json();
    let total = 0;

    for (const [tableName, records] of Object.entries(centralDb)) {
      if (Array.isArray(records) && records.length > 0 && tableName !== 'lastUpdated') {
        const tableObj = (db as any)[tableName];
        if (tableObj && typeof tableObj.bulkPut === 'function') {
          const validRecords = records.filter((r: any) => r && (r.id !== undefined && r.id !== null));
          if (validRecords.length > 0) {
            await tableObj.bulkPut(validRecords);
            total += validRecords.length;
          }
        }
      }
    }

    // Sincronizar tasa fijada en el servidor central si está presente
    if (
      centralDb.activeRateSource &&
      ['bcv_usd', 'bcv_eur', 'binance_usdt'].includes(centralDb.activeRateSource)
    ) {
      await useExchangeRateStore.getState().applyServerActiveSource(centralDb.activeRateSource);
    }

    if (total > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sbm:sync', { detail: { fullSync: true, total } }));
      window.dispatchEvent(new CustomEvent('sbm:sync_status', { detail: { status: 'synced', time: Date.now(), source: 'network' } }));
    }
    return total;
  } catch {
    return 0;
  }
}

let localEventSource: EventSource | null = null;
let sseReconnectTimer: any = null;

export function initLocalServerSync(): void {
  if (typeof window === 'undefined') return;

  if (localEventSource) {
    if (localEventSource.readyState === EventSource.OPEN) return;
    try {
      localEventSource.close();
    } catch {}
    localEventSource = null;
  }

  try {
    localEventSource = new EventSource('/api/sync/stream');

    localEventSource.onopen = () => {
      console.log('[LocalSync] ✅ Canal de sincronización SSE en tiempo real activo.');
    };

    localEventSource.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);

        // Keepalive / Ping desde el servidor
        if (payload.type === 'ping' || payload.type === 'connected') {
          return;
        }

        // 1. Manejar cambio global de tasa fijada por el Master
        if (payload.type === 'rate_source_changed' && payload.activeSource) {
          await useExchangeRateStore.getState().applyServerActiveSource(payload.activeSource);
          console.log(`[LocalSync] ⚡ Tasa fijada por el Master sincronizada en tiempo real: ${payload.activeSource}`);
        }

        if (payload.type === 'sync_update' && payload.payload) {
          const items = Array.isArray(payload.payload) ? payload.payload : [payload.payload];
          for (const item of items) {
            const tableObj = (db as any)[item.table];
            if (!tableObj) continue;

            const data = item.data ? (typeof item.data === 'string' ? JSON.parse(item.data) : item.data) : null;
            const targetId = item.recordId || data?.id;

            if (item.operation === 'delete' && targetId) {
              await tableObj.delete(targetId);
            } else if (data) {
              await tableObj.put({ ...data, id: targetId });
            }
          }

          // Disparar evento global para que todas las vistas de React se refresquen al instante (0 segundos)
          window.dispatchEvent(new CustomEvent('sbm:sync', { detail: payload.payload }));
          window.dispatchEvent(new CustomEvent('sbm:sync_status', { detail: { status: 'synced', time: Date.now(), source: 'remote' } }));
          console.log(`[LocalSync] ⚡ Actualización recibida de otro dispositivo en la red`);
        }
      } catch (err) {
        console.warn('[LocalSync] Error procesando evento de red:', err);
      }
    };

    localEventSource.onerror = () => {
      try {
        localEventSource?.close();
      } catch {}
      localEventSource = null;

      // Reintentar automáticamente en 3 segundos si el dispositivo está en línea
      if (!sseReconnectTimer) {
        sseReconnectTimer = setTimeout(() => {
          sseReconnectTimer = null;
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            initLocalServerSync();
          }
        }, 3000);
      }
    };
  } catch (e) {
    console.warn('[LocalSync] No se pudo inicializar EventSource local:', e);
  }
}

// ─── Auto-start periodic sync ───────────────────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs: number = 8000): void {
  // 1. Sincronización con el servidor central de la red local
  initLocalServerSync();
  pullFromLocalServer().catch(() => {});

  // 2. Sincronización con Supabase (si está configurado)
  initRealtimeSubscription();
  pullAllFromCloud().catch(() => {});

  processQueue().catch(() => {});

  if (syncInterval) return;
  syncInterval = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      processQueue().catch(() => {});
      // Respaldo de sondeo en caso de que SSE esté pausado en móvil en segundo plano
      pullFromLocalServer().catch(() => {});
    }
  }, intervalMs);
}

export function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
  if (localEventSource) {
    localEventSource.close();
    localEventSource = null;
  }
}

