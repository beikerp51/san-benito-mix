import React, { useState } from 'react';
import { useUpdateStore, APP_VERSION, APP_BUILD_DATE } from '../services/update-service';
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Download,
  Smartphone,
  ShieldCheck,
  Zap,
  ArrowUpCircle,
} from 'lucide-react';

export const SystemUpdatesCard: React.FC = () => {
  const { hasUpdate, isChecking, isUpdating, lastChecked, checkForUpdates, applyUpdate } =
    useUpdateStore();
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  const handleManualCheck = async () => {
    setCheckMessage(null);
    const found = await checkForUpdates();
    if (found) {
      setCheckMessage('¡Nueva actualización lista para instalar!');
    } else {
      setCheckMessage('✅ Tu aplicación ya está en la versión más reciente.');
      setTimeout(() => setCheckMessage(null), 4000);
    }
  };

  return (
    <div className="mn-card p-5 bg-gradient-to-br from-white via-[#F8F9FA] to-[#F1F3F9] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-[#E6E9EF] dark:border-slate-800 shadow-sm rounded-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6161FF] to-[#A25DDC] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/20">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[0.6875rem] font-black px-2.5 py-0.5 rounded-full bg-[#6161FF]/10 text-[#6161FF] dark:text-indigo-300 uppercase tracking-wider">
                Actualizaciones OTA Continuas
              </span>
              <span className="text-xs text-[#C5C7D0] dark:text-slate-600">·</span>
              <span className="text-xs font-bold text-[#00CA72] flex items-center gap-1">
                <ShieldCheck size={13} /> Sin Desinstalar APK
              </span>
            </div>
            <h3 className="text-base font-black text-[#1E293B] dark:text-white mt-0.5">
              Estado de la Versión del Sistema
            </h3>
            <p className="text-xs text-[#676879] dark:text-slate-400 mt-0.5">
              Versión activa: <strong className="text-slate-800 dark:text-slate-200">{APP_VERSION}</strong> ({APP_BUILD_DATE}). Todos los cambios se aplican automáticamente sin tocar nada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {hasUpdate ? (
            <button
              onClick={applyUpdate}
              disabled={isUpdating}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black flex items-center gap-2 shadow-md shadow-emerald-950/30 active:scale-95 transition-all cursor-pointer animate-pulse"
            >
              <RefreshCw size={14} className={isUpdating ? 'animate-spin' : ''} />
              <span>{isUpdating ? 'Instalando actualización...' : 'Instalar Actualización Ahora'}</span>
            </button>
          ) : (
            <button
              onClick={handleManualCheck}
              disabled={isChecking}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 active:scale-95 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw size={13} className={isChecking ? 'animate-spin text-[#6161FF]' : ''} />
              <span>{isChecking ? 'Comprobando...' : 'Buscar Actualizaciones'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mensaje de resultado de comprobación */}
      {checkMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs font-bold flex items-center gap-2 animate-scale-in">
          <CheckCircle2 size={15} className="text-emerald-500" />
          <span>{checkMessage}</span>
        </div>
      )}

      {hasUpdate && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <span className="font-black">¡Hay una nueva compilación disponible!</span>
              <p className="text-[0.6875rem] font-normal opacity-90 mt-0.5">
                Los nuevos cambios ya están descargados en segundo plano. Haz clic en "Instalar Actualización Ahora" para reiniciar la app al instante.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
