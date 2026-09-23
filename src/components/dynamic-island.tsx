import React, { useState, useEffect } from 'react';
import { useExchangeRateStore } from '../services/exchange-rate-service';
import { useIsMaster } from '../auth/auth-store';
import type { RateSource } from '../db/database';
import {
  RefreshCw,
  TrendingUp,
  Lock,
  Check,
  Zap,
} from 'lucide-react';

const SOURCE_META: Record<
  RateSource,
  {
    name: string;
    shortName: string;
    label: string;
    currency: string;
    symbol: string;
    flag: string;
    badgeBg: string;
    badgeText: string;
    accentColor: string;
  }
> = {
  bcv_usd: {
    name: 'BCV USD',
    shortName: 'USD',
    label: 'Dólar Oficial',
    currency: 'USD',
    symbol: '$',
    flag: '🇺🇸',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-400',
    accentColor: '#10B981',
  },
  bcv_eur: {
    name: 'BCV EUR',
    shortName: 'EUR',
    label: 'Euro Oficial',
    currency: 'EUR',
    symbol: '€',
    flag: '🇪🇺',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-400',
    accentColor: '#3B82F6',
  },
  binance_usdt: {
    name: 'Binance P2P',
    shortName: 'USDT',
    label: 'USDT Cripto',
    currency: 'USDT',
    symbol: '₮',
    flag: '🟡',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    accentColor: '#F59E0B',
  },
};

export interface RateBarProps {
  isMobileStrip?: boolean;
}

export const RateBar: React.FC<RateBarProps> = ({ isMobileStrip = false }) => {
  const isMaster = useIsMaster();
  const {
    rates,
    activeSource,
    isLoading,
    isLiveStreaming,
    lastUpdate,
    lastChange,
    setActiveSource,
    fetchRates,
  } = useExchangeRateStore();

  const [flashSource, setFlashSource] = useState<RateSource | null>(null);
  const [timeAgo, setTimeAgo] = useState<string>('Al día');

  useEffect(() => {
    const handleUpdate = () => {
      setFlashSource(activeSource);
      const timer = setTimeout(() => setFlashSource(null), 1200);
      return () => clearTimeout(timer);
    };

    window.addEventListener('rate-updated', handleUpdate);
    return () => window.removeEventListener('rate-updated', handleUpdate);
  }, [activeSource]);

  useEffect(() => {
    const updateTime = () => {
      if (!lastUpdate) {
        setTimeAgo('En vivo');
        return;
      }
      const diff = Math.floor((Date.now() - lastUpdate) / 1000);
      if (diff < 15) setTimeAgo('En vivo');
      else if (diff < 60) setTimeAgo(`${diff}s`);
      else setTimeAgo(`${Math.floor(diff / 60)}m`);
    };
    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const formatRate = (rate: number) =>
    rate === 0
      ? '—'
      : `${rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;

  const activeMeta = SOURCE_META[activeSource] || SOURCE_META.bcv_usd;

  // ─── VISTA MÓVIL SENIOR: Ticker Financiero Compacto (Bloomberg / Revolut) ───
  if (isMobileStrip) {
    return (
      <div className="w-full flex items-center justify-between gap-1.5 py-0.5 select-none">
        {/* Tasa Oficial Fijada Badge */}
        <div className="flex items-center gap-1.5 bg-slate-900 dark:bg-black text-white px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-xs flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[0.625rem] font-black text-slate-400 uppercase tracking-tight">
              {activeMeta.currency}:
            </span>
            <span className="text-xs font-black font-mono text-emerald-300">
              {rates[activeSource] ? rates[activeSource].toFixed(2) : '—'}
            </span>
            <span className="text-[0.5625rem] text-slate-400 font-medium">Bs</span>
          </div>
        </div>

        {/* Mini Ticker Horizontal Deslizable para las 3 Cotizaciones */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {(Object.keys(SOURCE_META) as RateSource[]).map((source) => {
            const isActive = activeSource === source;
            const meta = SOURCE_META[source];
            const rateVal = rates[source];
            const change = lastChange[source] || 0;
            const isFlashing = flashSource === source;

            return (
              <button
                key={source}
                onClick={async () => {
                  if (!isMaster) {
                    alert('🔒 Solo el Master (Beiker Pérez) puede fijar la tasa del sistema.');
                    return;
                  }
                  await setActiveSource(source);
                }}
                type="button"
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold select-none flex-shrink-0 transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                } ${isFlashing ? 'ring-2 ring-emerald-400' : ''}`}
              >
                <span className="text-[0.625rem]">{meta.shortName}:</span>
                <span className="font-mono text-[0.6875rem] font-black">
                  {rateVal ? rateVal.toFixed(2) : '—'}
                </span>
                {change !== 0 && (
                  <span
                    className={`text-[0.5625rem] font-bold ${
                      change > 0
                        ? isActive
                          ? 'text-emerald-200'
                          : 'text-emerald-500'
                        : isActive
                        ? 'text-rose-200'
                        : 'text-rose-500'
                    }`}
                  >
                    {change > 0 ? '↑' : '↓'}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={fetchRates}
            disabled={isLoading}
            type="button"
            className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 tap-haptic transition-all cursor-pointer flex-shrink-0"
            title="Actualizar cotizaciones en vivo"
          >
            <RefreshCw size={11} className={isLoading ? 'animate-spin text-[#6161FF]' : ''} />
          </button>
        </div>
      </div>
    );
  }

  // ─── VISTA ESCRITORIO: Executive Financial Terminal Dock (No Overflows, Perfect Balance) ───
  return (
    <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-slate-900/95 dark:bg-black/95 text-white border border-slate-700/70 dark:border-slate-800 shadow-md shadow-slate-950/20 backdrop-blur-xl select-none max-w-full">
      {/* 1. TASA ACTIVA OFICIAL (Highlight Hero Pill) */}
      <div
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-sm ring-1 ring-white/20 flex-shrink-0"
        title={`TASA OFICIAL ACTIVA: ${activeMeta.name} (${formatRate(rates[activeSource])}). Todas las operaciones se calculan con esta tasa.`}
      >
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200" />
        </span>

        <div className="flex items-center gap-1 leading-none">
          <span className="text-[0.625rem] font-black uppercase tracking-wider text-emerald-100 hidden lg:inline">
            Tasa Oficial:
          </span>
          <span className="text-[0.6875rem] font-black text-emerald-200 bg-emerald-950/40 px-1.5 py-0.5 rounded">
            {activeMeta.shortName}
          </span>
          <span className="text-xs sm:text-sm font-black font-mono tracking-tight text-white ml-0.5">
            {rates[activeSource] ? rates[activeSource].toFixed(2) : '—'}
          </span>
          <span className="text-[0.625rem] font-bold text-emerald-200">Bs</span>
        </div>

        <div className="hidden xl:flex items-center gap-0.5 text-[0.5625rem] font-bold text-emerald-100/90 pl-1 border-l border-emerald-500/50">
          <Lock size={9} />
          <span>Fijada</span>
        </div>
      </div>

      {/* 2. REFERENCIAS DE MERCADO (Clickable to switch if Master) */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {(Object.keys(SOURCE_META) as RateSource[]).map((source) => {
          const isActive = activeSource === source;
          const meta = SOURCE_META[source];
          const rateVal = rates[source];
          const change = lastChange[source] || 0;
          const isFlashing = flashSource === source;

          return (
            <button
              key={source}
              onClick={async () => {
                if (!isMaster) {
                  alert(
                    `Cotización: ${meta.name} (${formatRate(rateVal)}).\n🔒 Solo el Administrador Master (Beiker Pérez) puede cambiar la tasa oficial fijada.`
                  );
                  return;
                }
                await setActiveSource(source);
              }}
              type="button"
              className={`group relative flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-semibold transition-all select-none whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white/20 text-white ring-1 ring-white/30 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-700/50'
              } ${isFlashing ? 'ring-2 ring-emerald-400' : ''}`}
              title={
                !isMaster
                  ? `${meta.name}: ${formatRate(rateVal)}`
                  : isActive
                  ? `Tasa actual del sistema: ${meta.name}`
                  : `Clic para cambiar la tasa oficial a ${meta.name} (${formatRate(rateVal)})`
              }
            >
              <span className="text-[0.625rem] text-slate-400 font-bold">
                {meta.shortName}
              </span>
              <span className="font-mono font-black text-xs text-white">
                {rateVal ? rateVal.toFixed(2) : '—'}
              </span>
              {change !== 0 && (
                <span
                  className={`text-[0.5625rem] font-bold ${
                    change > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {change > 0 ? '↑' : '↓'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. REFRESH BUTTON & TIME STATUS */}
      <div className="flex items-center gap-1 pl-1 border-l border-slate-700/60 pr-1 flex-shrink-0">
        <span className="text-[0.5625rem] text-slate-400 font-mono hidden 2xl:inline">
          {timeAgo}
        </span>
        <button
          onClick={fetchRates}
          disabled={isLoading}
          type="button"
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          title="Actualizar cotizaciones en vivo"
        >
          <RefreshCw
            size={11}
            className={isLoading ? 'animate-spin text-emerald-400' : ''}
          />
        </button>
      </div>
    </div>
  );
};

export const DynamicIsland = RateBar;
