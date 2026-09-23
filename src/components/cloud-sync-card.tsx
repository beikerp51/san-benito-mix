import React, { useState, useEffect } from 'react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  testSupabaseConnection,
} from '../services/supabase-client';
import {
  pullAllFromCloud,
  pushAllToCloud,
  getNetworkStatus,
  onNetworkChange,
  startPeriodicSync,
} from '../db/sync-engine';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Key,
  Globe,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Database,
  Wifi,
  WifiOff,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

export const CloudSyncCard: React.FC = () => {
  const [config, setConfig] = useState(getSupabaseConfig());
  const [urlInput, setUrlInput] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlHelp, setShowSqlHelp] = useState(false);
  const [isOnline, setIsOnline] = useState(getNetworkStatus() === 'online');

  useEffect(() => {
    const current = getSupabaseConfig();
    setConfig(current);
    setUrlInput(current.url);
    setKeyInput(current.anonKey);

    const unsub = onNetworkChange((status) => {
      setIsOnline(status === 'online');
    });
    return () => unsub();
  }, []);

  const handleTestAndSave = async () => {
    if (!urlInput.trim() || !keyInput.trim()) {
      setTestResult({ success: false, message: 'Ingresa la URL y la Clave Anon de Supabase.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const result = await testSupabaseConnection(urlInput, keyInput);
    setTestResult(result);
    setIsTesting(false);

    if (result.success) {
      saveSupabaseConfig(urlInput, keyInput);
      setConfig(getSupabaseConfig());
      startPeriodicSync();
    }
  };

  const handleDisconnect = () => {
    if (confirm('¿Deseas desvincular Supabase de este dispositivo? Tus datos locales en este equipo no se borrarán.')) {
      clearSupabaseConfig();
      setConfig(getSupabaseConfig());
      setUrlInput('');
      setKeyInput('');
      setTestResult(null);
      setSyncResult(null);
    }
  };

  const handleManualSyncNow = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const pushRes = await pushAllToCloud();
      const pullRes = await pullAllFromCloud();

      setSyncResult({
        type: 'success',
        message: `¡Sincronización completada! ${pushRes.count} registros subidos a la nube y ${pullRes.count} recibidos.`,
      });
    } catch (e: any) {
      setSyncResult({
        type: 'error',
        message: `Error al sincronizar: ${e?.message || 'Fallo de red'}`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySchemaSql = async () => {
    try {
      // Fetch or import schema content
      const response = await fetch('/database/schema.sql').catch(() => null);
      let sqlText = '';
      if (response && response.ok) {
        sqlText = await response.text();
      } else {
        sqlText = `-- Abre el archivo database/schema.sql de la carpeta del proyecto y cópialo en el SQL Editor de Supabase.`;
      }

      await navigator.clipboard.writeText(sqlText);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      setCopiedSql(false);
    }
  };

  return (
    <div className="mn-card p-5 border border-indigo-100 bg-gradient-to-br from-white via-[#FAFBFD] to-indigo-50/20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E6E9EF]">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#6161FF]/10 text-[#6161FF] flex items-center justify-center flex-shrink-0">
            <Cloud size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#323338]">
                Sincronización en la Nube y Multidispositivo (Supabase)
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[0.6875rem] font-bold flex items-center gap-1 ${
                  config.isConfigured
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {config.isConfigured ? (
                  <>
                    <CheckCircle2 size={12} className="text-[#00CA72]" />
                    <span>Nube Vinculada</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={12} className="text-amber-600" />
                    <span>Solo Local (Offline-First)</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-[#676879] mt-0.5">
              Conecta tu proyecto gratuito de Supabase PostgreSQL para que tú y Fabiana registren datos en tiempo real desde distintas PCs o teléfonos.
            </p>
          </div>
        </div>

        {/* Network status badge */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {isOnline ? <Wifi size={13} className="text-emerald-600" /> : <WifiOff size={13} />}
            <span>{isOnline ? 'Internet Conectado' : 'Modo Sin Conexión'}</span>
          </span>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#323338] mb-1 flex items-center gap-1.5">
              <Globe size={13} className="text-[#6161FF]" />
              <span>URL del Proyecto Supabase (Project URL)</span>
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://xyzabcdefghijklm.supabase.co"
              className="mn-input w-full text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#323338] mb-1 flex items-center gap-1.5">
              <Key size={13} className="text-[#FDAB3D]" />
              <span>Clave Pública de la API (Anon Public Key)</span>
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="mn-input w-full text-xs font-mono"
            />
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testResult.success ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-rose-600" />}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Sync Result Message */}
        {syncResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 animate-fade-in ${
              syncResult.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{syncResult.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTestAndSave}
              disabled={isTesting || !urlInput.trim() || !keyInput.trim()}
              className="mn-btn mn-btn-primary text-xs py-2 px-4 flex items-center gap-2"
            >
              {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
              <span>{isTesting ? 'Probando...' : 'Probar y Vincular Supabase'}</span>
            </button>

            {config.isConfigured && (
              <button
                onClick={handleManualSyncNow}
                disabled={isSyncing || !isOnline}
                className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-2 hover:border-[#6161FF] hover:text-[#6161FF]"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin text-[#6161FF]' : ''} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Todo Ahora'}</span>
              </button>
            )}

            {config.isConfigured && (
              <button
                onClick={handleDisconnect}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Desvincular
              </button>
            )}
          </div>

          {/* Quick Help & SQL Trigger */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSqlHelp(!showSqlHelp)}
              className="text-xs font-bold text-[#676879] hover:text-[#323338] flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <HelpCircle size={14} className="text-[#6161FF]" />
              <span>¿Cómo crear mi proyecto gratis?</span>
            </button>

            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="mn-btn mn-btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <span>Ir a Supabase</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Step-by-Step Instructions Collapsible */}
        {showSqlHelp && (
          <div className="p-4 rounded-xl bg-white border border-[#E6E9EF] space-y-3 text-xs text-[#323338] animate-fade-in shadow-sm">
            <div className="flex items-center justify-between font-bold border-b border-[#E6E9EF] pb-2">
              <span className="text-[#6161FF] flex items-center gap-1.5">
                <Database size={15} /> Pasos para activar tu base de datos en Supabase (Gratis en 3 minutos):
              </span>
            </div>

            <ol className="list-decimal list-inside space-y-1.5 text-[#676879] leading-relaxed">
              <li>
                Entra en <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[#6161FF] font-bold underline">supabase.com</a> y crea tu cuenta gratuita.
              </li>
              <li>
                Crea una nueva organización y dale clic a <strong>"New Project"</strong> (nómbralo <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">san-benito-mix</code>).
              </li>
              <li>
                En el menú lateral de Supabase, entra en <strong>SQL Editor</strong>, pega el script de abajo y dale al botón <strong>"Run"</strong>.
              </li>
              <li>
                Entra en <strong>Project Settings &gt; API</strong>, copia la <strong>Project URL</strong> y la <strong>anon public key</strong>, y pégalas en los campos de arriba.
              </li>
            </ol>

            <div className="pt-1 flex items-center justify-between bg-[#F6F7FB] p-2.5 rounded-lg border border-[#E6E9EF]">
              <span className="text-[0.6875rem] text-[#676879]">
                El archivo SQL completo se encuentra en <code className="font-bold text-[#323338]">database/schema.sql</code>
              </span>
              <button
                type="button"
                onClick={handleCopySchemaSql}
                className="mn-btn mn-btn-primary text-xs py-1 px-3 flex items-center gap-1.5"
              >
                {copiedSql ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedSql ? '¡Copiado al Portapapeles!' : 'Copiar Script SQL'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
