import React from 'react';
import { useUpdateStore, APP_VERSION } from '../services/update-service';
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react';

export const UpdateToast: React.FC = () => {
  const { hasUpdate, isUpdating, applyUpdate } = useUpdateStore();

  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-50 animate-bounce-in select-none">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1E1B4B] to-[#0F172A] text-white border border-indigo-500/40 shadow-2xl shadow-indigo-950/60 backdrop-blur-xl flex items-center justify-between gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6161FF] to-[#A25DDC] flex items-center justify-center text-white flex-shrink-0 shadow-md">
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[0.625rem] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                OTA Update
              </span>
              <span className="text-xs font-black text-white truncate">
                Nueva Versión Lista
              </span>
            </div>
            <p className="text-[0.6875rem] text-slate-300 truncate mt-0.5">
              Mejoras instaladas. Toca para aplicar sin desinstalar.
            </p>
          </div>
        </div>

        <button
          onClick={applyUpdate}
          disabled={isUpdating}
          className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          <RefreshCw size={13} className={isUpdating ? 'animate-spin' : ''} />
          <span>{isUpdating ? 'Instalando...' : 'Actualizar'}</span>
        </button>
      </div>
    </div>
  );
};
