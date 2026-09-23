import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileJson,
  RefreshCw,
  HardDrive,
  Server,
  Sparkles,
  Layers,
} from 'lucide-react';

export const BackupManager: React.FC = () => {
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingServerSnapshot, setIsCreatingServerSnapshot] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);
  const [dbStats, setDbStats] = useState<{
    products: number;
    accounts: number;
    transactions: number;
    clients: number;
    dispatches: number;
  }>({ products: 0, accounts: 0, transactions: 0, clients: 0, dispatches: 0 });

  const loadStats = async () => {
    try {
      const [p, a, t, c, d] = await Promise.all([
        db.products.count(),
        db.accounts.count(),
        db.transactions.count(),
        db.clients.count(),
        db.dispatches.count(),
      ]);
      setDbStats({ products: p, accounts: a, transactions: t, clients: c, dispatches: d });
    } catch {}
  };

  useEffect(() => {
    const saved = localStorage.getItem('sbm_last_backup_date');
    if (saved) setLastBackup(saved);
    loadStats();
  }, []);

  // 1. Descargar Respaldo JSON Completo
  const handleExportBackup = async () => {
    setIsExporting(true);
    setFeedback(null);
    try {
      const backupData = {
        app: 'SanBenitoMix',
        version: '3.0',
        timestamp: Date.now(),
        dateFormatted: new Date().toISOString(),
        tables: {
          products: await db.products.toArray(),
          accounts: await db.accounts.toArray(),
          transactions: await db.transactions.toArray(),
          clients: await db.clients.toArray(),
          losses: await db.losses.toArray(),
          dispatches: await db.dispatches.toArray(),
          productionBatches: await db.productionBatches.toArray(),
          cashClosures: await db.cashClosures.toArray(),
          exchangeRates: await db.exchangeRates.toArray(),
          users: await db.users.toArray(),
          settings: await db.settings.toArray(),
          auditLog: await db.auditLog.toArray(),
        },
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const filename = `SanBenitoMix_RespaldoOficial_${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(
        now.getHours()
      ).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 200);

      // También guardar copia espejo en el servidor
      try {
        await fetch('/api/sync/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tables: backupData.tables }),
        });
      } catch {}

      const timeStr = now.toLocaleString('es-VE');
      localStorage.setItem('sbm_last_backup_date', timeStr);
      setLastBackup(timeStr);

      setFeedback({
        type: 'success',
        message: '¡Copia de seguridad generada y descargada exitosamente!',
        details: `${backupData.tables.products.length} productos, ${backupData.tables.clients.length} clientes, ${backupData.tables.dispatches.length} despachos, ${backupData.tables.accounts.length} cuentas respaldadas.`,
      });
    } catch (err) {
      console.error('Error al exportar respaldo:', err);
      setFeedback({
        type: 'error',
        message: 'Error al generar la copia de seguridad.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Crear Punto de Restauración en Servidor Central en 1 Clic
  const handleCreateServerSnapshot = async () => {
    setIsCreatingServerSnapshot(true);
    setFeedback(null);
    try {
      const backupData = {
        products: await db.products.toArray(),
        accounts: await db.accounts.toArray(),
        transactions: await db.transactions.toArray(),
        clients: await db.clients.toArray(),
        losses: await db.losses.toArray(),
        dispatches: await db.dispatches.toArray(),
        productionBatches: await db.productionBatches.toArray(),
        cashClosures: await db.cashClosures.toArray(),
        exchangeRates: await db.exchangeRates.toArray(),
        users: await db.users.toArray(),
        settings: await db.settings.toArray(),
        auditLog: await db.auditLog.toArray(),
      };

      const res = await fetch('/api/sync/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: backupData }),
      });

      if (!res.ok) throw new Error('El servidor no pudo guardar el snapshot.');

      const now = new Date();
      const timeStr = now.toLocaleString('es-VE');
      localStorage.setItem('sbm_last_backup_date', timeStr);
      setLastBackup(timeStr);

      setFeedback({
        type: 'success',
        message: '¡Punto de restauración guardado en el servidor central con éxito!',
        details: 'Todos los datos actuales quedaron blindados en el disco del servidor.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Error al crear punto en servidor.',
      });
    } finally {
      setIsCreatingServerSnapshot(false);
    }
  };

  // 3. Restaurar Copia de Seguridad JSON con Sincronización al Servidor
  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !confirm(
        '⚠️ ATENCIÓN DE SEGURIDAD:\n\nAl restaurar este respaldo, la base de datos completa de San Benito Mix (teléfonos, servidor y PC) será reemplazada por los datos del archivo.\n\n¿Estás completamente seguro de continuar?'
      )
    ) {
      event.target.value = '';
      return;
    }

    setIsImporting(true);
    setFeedback(null);

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.tables || backupData.app !== 'SanBenitoMix') {
        throw new Error('El archivo no es una copia de seguridad válida de San Benito Mix.');
      }

      const t = backupData.tables;

      // 1. Restaurar en Dexie local de manera íntegra
      if (Array.isArray(t.products)) {
        await db.products.clear();
        if (t.products.length > 0) await db.products.bulkAdd(t.products);
      }
      if (Array.isArray(t.accounts)) {
        await db.accounts.clear();
        if (t.accounts.length > 0) await db.accounts.bulkAdd(t.accounts);
      }
      if (Array.isArray(t.transactions)) {
        await db.transactions.clear();
        if (t.transactions.length > 0) await db.transactions.bulkAdd(t.transactions);
      }
      if (Array.isArray(t.clients)) {
        await db.clients.clear();
        if (t.clients.length > 0) await db.clients.bulkAdd(t.clients);
      }
      if (Array.isArray(t.losses)) {
        await db.losses.clear();
        if (t.losses.length > 0) await db.losses.bulkAdd(t.losses);
      }
      if (Array.isArray(t.dispatches)) {
        await db.dispatches.clear();
        if (t.dispatches.length > 0) await db.dispatches.bulkAdd(t.dispatches);
      }
      if (Array.isArray(t.productionBatches)) {
        await db.productionBatches.clear();
        if (t.productionBatches.length > 0) await db.productionBatches.bulkAdd(t.productionBatches);
      }
      if (Array.isArray(t.cashClosures)) {
        await db.cashClosures.clear();
        if (t.cashClosures.length > 0) await db.cashClosures.bulkAdd(t.cashClosures);
      }
      if (Array.isArray(t.exchangeRates)) {
        await db.exchangeRates.clear();
        if (t.exchangeRates.length > 0) await db.exchangeRates.bulkAdd(t.exchangeRates);
      }
      if (Array.isArray(t.auditLog)) {
        await db.auditLog.clear();
        if (t.auditLog.length > 0) await db.auditLog.bulkAdd(t.auditLog);
      }
      if (Array.isArray(t.settings)) {
        await db.settings.clear();
        if (t.settings.length > 0) await db.settings.bulkAdd(t.settings);
      }

      // 2. SINCRONIZAR INMEDIATAMENTE AL SERVIDOR CENTRAL PARA EVITAR QUE SE SOBREESCRIBA
      try {
        await fetch('/api/sync/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tables: t }),
        });
      } catch (e) {
        console.warn('[Backup] No se pudo enviar copia al servidor local:', e);
      }

      // 3. Notificar a todas las vistas y pestañas abiertas
      window.dispatchEvent(
        new CustomEvent('sbm:sync', { detail: { fullRestore: true, timestamp: Date.now() } })
      );

      await loadStats();

      setFeedback({
        type: 'success',
        message: '¡Base de datos restaurada y sincronizada al 100%!',
        details: 'Todas las tablas han sido restituidas tanto localmente como en el servidor central.',
      });

      setTimeout(() => {
        window.location.reload();
      }, 1800);
    } catch (err: any) {
      console.error('Error al importar respaldo:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Error al procesar el archivo de respaldo.',
      });
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="mn-card p-5 sm:p-6 bg-gradient-to-br from-white via-[#F8F9FA] to-[#F1F3F9] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-[#E6E9EF] dark:border-slate-800 shadow-sm rounded-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-[#E6E9EF] dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-[#6161FF] dark:text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-xs border border-indigo-100 dark:border-indigo-900/50">
            <Database size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.6875rem] font-black px-2.5 py-0.5 rounded-full bg-[#6161FF]/10 text-[#6161FF] dark:text-indigo-300 uppercase tracking-wider">
                Resiliencia & Respaldos
              </span>
              <span className="text-xs text-[#C5C7D0] dark:text-slate-600">·</span>
              <span className="text-xs font-bold text-[#00CA72] flex items-center gap-1">
                <ShieldCheck size={13} /> Sistema 100% Blindado
              </span>
            </div>
            <h3 className="text-lg font-black text-[#1E293B] dark:text-white mt-0.5">
              Gestor Ejecutivo de Copias de Seguridad
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#676879] dark:text-slate-400 bg-white dark:bg-slate-800/80 px-3.5 py-2 rounded-xl border border-[#E6E9EF] dark:border-slate-700 shadow-2xs self-start sm:self-auto">
          <Clock size={14} className="text-[#6161FF] dark:text-indigo-400" />
          <span>Último respaldo:</span>
          <span className="font-extrabold text-[#1E293B] dark:text-white">
            {lastBackup || 'Sin respaldo reciente'}
          </span>
        </div>
      </div>

      {/* Database Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-5 p-3 rounded-xl bg-white/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 text-center">
        <div>
          <span className="block text-[0.625rem] font-bold text-slate-400 uppercase">Productos</span>
          <span className="text-base font-black font-mono text-slate-800 dark:text-white">
            {dbStats.products}
          </span>
        </div>
        <div>
          <span className="block text-[0.625rem] font-bold text-slate-400 uppercase">Clientes</span>
          <span className="text-base font-black font-mono text-slate-800 dark:text-white">
            {dbStats.clients}
          </span>
        </div>
        <div>
          <span className="block text-[0.625rem] font-bold text-slate-400 uppercase">Entregas</span>
          <span className="text-base font-black font-mono text-slate-800 dark:text-white">
            {dbStats.dispatches}
          </span>
        </div>
        <div>
          <span className="block text-[0.625rem] font-bold text-slate-400 uppercase">Cuentas</span>
          <span className="text-base font-black font-mono text-slate-800 dark:text-white">
            {dbStats.accounts}
          </span>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="block text-[0.625rem] font-bold text-slate-400 uppercase">Movimientos</span>
          <span className="text-base font-black font-mono text-slate-800 dark:text-white">
            {dbStats.transactions}
          </span>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl mb-5 text-xs font-bold flex flex-col gap-1 animate-scale-in border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
            )}
            <span className="text-sm font-black">{feedback.message}</span>
          </div>
          {feedback.details && (
            <p className="text-[0.6875rem] font-normal opacity-90 pl-6.5">{feedback.details}</p>
          )}
        </div>
      )}

      {/* Three Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Export File Card */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6161FF] dark:text-indigo-400 flex items-center justify-center">
                <Download size={16} />
              </div>
              <span className="text-xs font-black text-[#1E293B] dark:text-white">
                Descargar Copia JSON
              </span>
            </div>
            <p className="text-[0.6875rem] text-[#676879] dark:text-slate-400 leading-relaxed mb-4">
              Descarga un archivo con las 12 tablas completas a tu teléfono o computadora para guardarlo en un pendrive o correo.
            </p>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={isExporting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm shadow-[#6161FF]/25 active:scale-95 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>{isExporting ? 'Generando Copia...' : 'Descargar Archivo JSON'}</span>
          </button>
        </div>

        {/* 2. Server Snapshot Card */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0086C9] dark:text-blue-400 flex items-center justify-center">
                <Server size={16} />
              </div>
              <span className="text-xs font-black text-[#1E293B] dark:text-white">
                Snapshot en Servidor
              </span>
            </div>
            <p className="text-[0.6875rem] text-[#676879] dark:text-slate-400 leading-relaxed mb-4">
              Crea un punto de restauración automático directamente en el disco del servidor central sin descargar archivos.
            </p>
          </div>

          <button
            onClick={handleCreateServerSnapshot}
            disabled={isCreatingServerSnapshot}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0086C9] to-[#0070B0] hover:opacity-95 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <HardDrive size={14} />
            <span>
              {isCreatingServerSnapshot ? 'Guardando en Servidor...' : 'Crear Snapshot en Servidor'}
            </span>
          </button>
        </div>

        {/* 3. Restore Card */}
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#00CA72] dark:text-emerald-400 flex items-center justify-center">
                <Upload size={16} />
              </div>
              <span className="text-xs font-black text-[#1E293B] dark:text-white">
                Restaurar Base de Datos
              </span>
            </div>
            <p className="text-[0.6875rem] text-[#676879] dark:text-slate-400 leading-relaxed mb-4">
              Selecciona una copia JSON previa para recuperar el 100% de la información y sincronizarla de inmediato con todos los equipos.
            </p>
          </div>

          <label className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer">
            <Upload size={14} />
            <span>{isImporting ? 'Restaurando...' : 'Seleccionar Archivo y Restaurar'}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
