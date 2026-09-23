import React, { useState, useEffect } from 'react';
import { pullFromLocalServer, processQueue } from '../db/sync-engine';
import { db } from '../db/database';
import { RefreshCw, Wifi, WifiOff, CloudUpload } from 'lucide-react';

export const SyncBadge: React.FC = () => {
  const [status, setStatus] = useState<'synced' | 'syncing' | 'offline'>(
    navigator.onLine ? 'synced' : 'offline'
  );
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);

  const checkPending = async () => {
    try {
      const items = await db.syncQueue.toArray();
      const pending = items.filter((i) => !i.synced).length;
      setPendingCount(pending);
    } catch {}
  };

  useEffect(() => {
    checkPending();

    const handleStatus = (e: any) => {
      const detail = e.detail;
      if (detail?.status === 'syncing') {
        setStatus('syncing');
      } else if (detail?.status === 'synced') {
        setStatus(navigator.onLine ? 'synced' : 'offline');
        setLastSyncTime(detail.time || Date.now());
        checkPending();
      }
    };

    const handleQueueChange = () => {
      checkPending();
    };

    window.addEventListener('sbm:sync_status', handleStatus);
    window.addEventListener('sbm:queue_item_added', handleQueueChange);
    window.addEventListener('sbm:sync', handleQueueChange);

    const handleOnline = () => {
      setStatus('synced');
      checkPending();
    };
    const handleOffline = () => {
      setStatus('offline');
      checkPending();
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkPending, 5000);

    return () => {
      window.removeEventListener('sbm:sync_status', handleStatus);
      window.removeEventListener('sbm:queue_item_added', handleQueueChange);
      window.removeEventListener('sbm:sync', handleQueueChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (isManualSyncing) return;
    setIsManualSyncing(true);
    setStatus('syncing');
    try {
      await Promise.all([pullFromLocalServer(), processQueue()]);
      setLastSyncTime(Date.now());
      await checkPending();
      setStatus(navigator.onLine ? 'synced' : 'offline');
    } catch {
      setStatus(navigator.onLine ? 'synced' : 'offline');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getTimeText = () => {
    const diff = Math.floor((Date.now() - lastSyncTime) / 1000);
    if (diff < 15) return 'Al día';
    if (diff < 60) return `Hace ${diff}s`;
    return `Hace ${Math.floor(diff / 60)}m`;
  };

  return (
    <button
      onClick={handleManualSync}
      disabled={isManualSyncing}
      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 border cursor-pointer select-none whitespace-nowrap ${
        status === 'syncing' || isManualSyncing
          ? 'bg-blue-50/90 text-indigo-700 border-indigo-200'
          : status === 'offline'
          ? pendingCount > 0
            ? 'bg-amber-50 text-amber-800 border-amber-300'
            : 'bg-slate-100 text-slate-500 border-slate-200'
          : pendingCount > 0
          ? 'bg-amber-50 text-amber-800 border-amber-300'
          : 'bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800 border-emerald-200/80'
      }`}
      title={
        status === 'offline'
          ? `Modo Sin Conexión. ${pendingCount} cambio(s) guardado(s) localmente listos para sincronizar al conectar.`
          : `Sincronización en vivo activa (${getTimeText()}). Toca para forzar actualización.`
      }
    >
      {status === 'syncing' || isManualSyncing ? (
        <>
          <RefreshCw size={12} className="animate-spin text-indigo-600" />
          <span className="text-[0.6875rem]">
            {pendingCount > 0 ? `Subiendo (${pendingCount})...` : 'Sincronizando...'}
          </span>
        </>
      ) : status === 'offline' ? (
        <>
          <WifiOff size={12} className={pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
          <span className="text-[0.6875rem]">
            {pendingCount > 0 ? `Offline (${pendingCount} pend.)` : 'Modo Offline'}
          </span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <CloudUpload size={12} className="text-amber-600 animate-pulse" />
          <span className="text-[0.6875rem] font-bold text-amber-800">
            {pendingCount} pend.
          </span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Wifi size={12} className="text-emerald-600" />
          <span className="text-[0.6875rem] font-extrabold hidden sm:inline">En línea</span>
          <span className="text-[0.625rem] text-emerald-700/80 font-mono hidden md:inline">
            ({getTimeText()})
          </span>
        </>
      )}
    </button>
  );
};
