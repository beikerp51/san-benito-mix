import React, { useState, useEffect } from 'react';
import type { TabId } from './tab-bar';
import { useThemeStore } from '../services/theme-service';
import {
  Package,
  Landmark,
  Users,
  Sparkles,
  Grid,
  BookOpen,
  Settings,
  Send,
  Lock,
  LogOut,
  X,
  ChevronRight,
  Shield,
  CircleDot,
  Sun,
  Moon,
  Smartphone,
  Download,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  userRole?: string;
  userName?: string;
  onLock?: () => void;
  onLogout?: () => void;
  onOpenDispatch?: () => void;
  onOpenAres?: () => void;
}

interface NavTabItem {
  id: TabId;
  label: string;
  icon: React.FC<{ size: number; className?: string }>;
  isAi?: boolean;
}

const PRIMARY_TABS: NavTabItem[] = [
  { id: 'inventory', label: 'Inventario', icon: Package },
  { id: 'vault', label: 'Bóveda', icon: Landmark },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'ares', label: 'Ares IA', icon: Sparkles, isAi: true },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onChange,
  userRole,
  userName = 'Administrador',
  onLock,
  onLogout,
  onOpenDispatch,
  onOpenAres,
}) => {
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isHttpOrigin, setIsHttpOrigin] = useState(false);
  const { theme, setTheme } = useThemeStore();

  const triggerHaptic = (ms = 10) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isHttp =
        window.location.protocol === 'http:' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';
      setIsHttpOrigin(isHttp);

      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      if (isStandalone) {
        setIsInstalled(true);
      }
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    triggerHaptic(20);
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Error triggering PWA install:', err);
        setShowPwaGuide(true);
      }
    } else {
      setShowPwaGuide((prev) => !prev);
    }
  };

  const isSecondaryTabActive = activeTab === 'ledger' || activeTab === 'settings';

  return (
    <>
      {/* ─── NATIVE FLOATING BOTTOM BAR (iOS / ANDROID STYLE) ─── */}
      <nav
        className="md:hidden fixed bottom-3 inset-x-3 z-40 max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_12px_40px_rgba(15,23,42,0.14)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.6)] select-none transition-all duration-200"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
        aria-label="Navegación principal móvil"
      >
        <div className="flex items-center justify-between px-2 h-[62px]">
          {/* 4 Primary ergonomic tabs */}
          {PRIMARY_TABS.map((tab) => {
            const isActive = activeTab === tab.id && !isMoreSheetOpen;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  setIsMoreSheetOpen(false);
                  if (tab.isAi && onOpenAres) {
                    onOpenAres();
                  } else {
                    onChange(tab.id);
                  }
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 relative tap-haptic cursor-pointer ${
                  isActive
                    ? tab.isAi
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-[#6161FF] dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {/* Active Indicator Pip */}
                {isActive && (
                  <span
                    className={`absolute -top-1 w-5 h-1 rounded-full ${
                      tab.isAi
                        ? 'bg-gradient-to-r from-[#6161FF] to-[#A25DDC]'
                        : 'bg-[#6161FF] dark:bg-indigo-500'
                    } shadow-xs animate-fade-in`}
                  />
                )}

                <div
                  className={`p-1.5 rounded-2xl transition-all duration-200 ${
                    isActive
                      ? tab.isAi
                        ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'bg-[#6161FF]/10 dark:bg-indigo-500/20 text-[#6161FF] dark:text-indigo-400 shadow-xs'
                      : tab.isAi
                      ? 'text-purple-500 dark:text-purple-400'
                      : ''
                  }`}
                >
                  <Icon
                    size={20}
                    className={`${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'} ${
                      tab.isAi && !isActive ? 'animate-pulse' : ''
                    }`}
                  />
                </div>

                <span
                  className={`text-[0.625rem] leading-none mt-0.5 font-bold tracking-tight ${
                    isActive
                      ? tab.isAi
                        ? 'text-purple-700 dark:text-purple-300 font-black'
                        : 'text-[#6161FF] dark:text-indigo-400 font-black'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}

          {/* 5th Tab: Menú "Más" / Acciones Secundarias */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic(15);
              setIsMoreSheetOpen(true);
            }}
            className={`flex-1 flex flex-col items-center justify-center py-1 relative tap-haptic cursor-pointer ${
              isSecondaryTabActive || isMoreSheetOpen
                ? 'text-[#6161FF] dark:text-indigo-400'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {(isSecondaryTabActive || isMoreSheetOpen) && (
              <span className="absolute -top-1 w-5 h-1 rounded-full bg-[#6161FF] dark:bg-indigo-500 shadow-xs animate-fade-in" />
            )}

            <div
              className={`p-1.5 rounded-2xl transition-all duration-200 ${
                isSecondaryTabActive || isMoreSheetOpen
                  ? 'bg-[#6161FF]/10 dark:bg-indigo-500/20 text-[#6161FF] dark:text-indigo-400 shadow-xs'
                  : ''
              }`}
            >
              <Grid size={20} className={isSecondaryTabActive || isMoreSheetOpen ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
            </div>

            <span
              className={`text-[0.625rem] leading-none mt-0.5 font-bold tracking-tight ${
                isSecondaryTabActive || isMoreSheetOpen
                  ? 'text-[#6161FF] dark:text-indigo-400 font-black'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              Más
            </span>
          </button>
        </div>
      </nav>

      {/* ─── NATIVE ACTION SHEET / CAJÓN INFERIOR MÓVIL ─── */}
      {isMoreSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm animate-fade-in transition-opacity"
            onClick={() => setIsMoreSheetOpen(false)}
          />

          {/* Sheet Content Container */}
          <div
            className="relative z-10 bg-white dark:bg-slate-900 text-[#323338] dark:text-slate-100 rounded-t-[32px] p-5 shadow-2xl border-t border-slate-200/80 dark:border-slate-800 max-h-[85vh] overflow-y-auto animate-slide-up"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)' }}
          >
            {/* Drag Handle Pill */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 flex-shrink-0" />

            {/* Header del Bottom Sheet */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#6161FF] via-[#7B51EC] to-[#A25DDC] flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-500/20 flex-shrink-0">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                    {userName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[#6161FF] dark:text-indigo-400 uppercase tracking-wider">
                      <Shield size={10} />
                      {userRole === 'master' ? 'Master' : 'Administradora'}
                    </span>
                    <span className="flex items-center gap-1 text-[0.625rem] text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CircleDot size={8} className="animate-pulse" />
                      En Línea
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMoreSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors tap-haptic cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Selector de Modo Visual (Claro / Oscuro) */}
            <div className="mb-4">
              <span className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 block mb-1.5">
                Apariencia del Sistema
              </span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setTheme('light');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all tap-haptic cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Sun size={15} className={theme === 'light' ? 'text-amber-500 fill-amber-500' : ''} />
                  <span>Modo Claro</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    setTheme('dark');
                  }}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all tap-haptic cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Moon size={15} className={theme === 'dark' ? 'text-white fill-white' : ''} />
                  <span>Modo Oscuro</span>
                </button>
              </div>
            </div>

            {/* Quick Action Navigation Grid */}
            <div className="space-y-2 mb-4">
              <span className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Módulos del Sistema
              </span>

              {/* Entrega Multi-Producto (Fabiana -> Beiker) */}
              {onOpenDispatch && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setIsMoreSheetOpen(false);
                    onOpenDispatch();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl border bg-gradient-to-r from-emerald-500/10 via-[#6161FF]/10 to-transparent dark:from-emerald-950/40 dark:via-indigo-950/40 dark:to-transparent border-emerald-200 dark:border-emerald-800 text-[#6161FF] dark:text-emerald-400 transition-all tap-haptic text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-[#6161FF] text-white flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
                      <Send size={18} />
                    </div>
                    <div>
                      <span className="text-xs font-extrabold block text-slate-900 dark:text-white">
                        ⭐ Entregas Fabiana ➔ Beiker
                      </span>
                      <span className="text-[0.625rem] text-emerald-600 dark:text-emerald-400 block font-semibold">
                        Multi-producto con descuento automático
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-emerald-500" />
                </button>
              )}

              {/* Libro Contable */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onChange('ledger');
                  setIsMoreSheetOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all tap-haptic text-left cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-[#6161FF]'
                    : 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs flex-shrink-0">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-900 dark:text-white">Libro Contable</span>
                    <span className="text-[0.625rem] text-slate-400 block">
                      Auditoría e historial de transacciones
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>

              {/* Ajustes y Seguridad */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(10);
                  onChange('settings');
                  setIsMoreSheetOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all tap-haptic text-left cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-[#6161FF]'
                    : 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-xs flex-shrink-0">
                    <Settings size={18} />
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-900 dark:text-white">Ajustes del Sistema</span>
                    <span className="text-[0.625rem] text-slate-400 block">
                      Actualizaciones OTA, usuarios y monitor Ares
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400" />
              </button>

              {/* Opción Instalar como App en Teléfono (PWA / WebAPK) */}
              <button
                type="button"
                onClick={handleInstallClick}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all tap-haptic text-left cursor-pointer ${
                  deferredPrompt
                    ? 'bg-gradient-to-r from-[#6161FF]/15 to-[#A25DDC]/15 border-indigo-300 dark:border-indigo-700 shadow-sm animate-pulse'
                    : 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 ${
                      deferredPrompt
                        ? 'bg-[#6161FF] text-white'
                        : isInstalled
                        ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400'
                    }`}
                  >
                    {isInstalled ? <ShieldCheck size={18} /> : <Smartphone size={18} />}
                  </div>
                  <div>
                    <span className="text-xs font-bold block text-slate-900 dark:text-white">
                      {isInstalled
                        ? 'App Instalada en tu Dispositivo'
                        : deferredPrompt
                        ? '📲 Instalar APK / App Ahora'
                        : 'Instalar en Pantalla de Inicio'}
                    </span>
                    <span className="text-[0.625rem] text-slate-400 block">
                      {isInstalled
                        ? 'Modo nativo a pantalla completa activo'
                        : deferredPrompt
                        ? 'Toca para instalar paquete nativo con 1 clic'
                        : 'Descargar e instalar como app nativa'}
                    </span>
                  </div>
                </div>
                <Download
                  size={16}
                  className={deferredPrompt ? 'text-[#6161FF] animate-bounce' : 'text-cyan-500'}
                />
              </button>

              {/* Guía visual PWA interactiva / Aviso HTTP */}
              {showPwaGuide && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-xs space-y-3 animate-fade-in">
                  {isHttpOrigin && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold text-xs">
                        <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                        <span>¿Por qué Brave dice "No se puede instalar"?</span>
                      </div>
                      <p className="text-[0.6875rem] text-amber-800 dark:text-amber-300 leading-relaxed">
                        Estás conectado por IP local (HTTP sin SSL). Brave bloquea la instalación de WebAPKs por seguridad en conexiones no cifradas.
                      </p>
                      <div className="pt-1 flex flex-col gap-1.5">
                        <a
                          href="https://queue-kid-stanford-outlet.trycloudflare.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#6161FF] text-white font-bold text-xs shadow-xs tap-haptic"
                        >
                          <ShieldCheck size={13} />
                          <span>Abrir en Enlace Seguro HTTPS</span>
                          <ExternalLink size={12} />
                        </a>
                        <p className="text-[0.625rem] text-amber-700 dark:text-amber-400">
                          O en tu menú Brave, selecciona la 2ª opción: <strong>"Crear acceso directo"</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="font-extrabold flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                    <Smartphone size={14} className="text-[#6161FF]" />
                    <span>Pasos de Instalación:</span>
                  </div>
                  <ul className="space-y-1.5 text-[0.6875rem] text-slate-600 dark:text-slate-300 list-disc list-inside">
                    <li>
                      <strong>Android (Brave/Chrome):</strong> En el menú <span className="bg-white dark:bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">⋮</span> selecciona <strong>"Instalar aplicación"</strong> (en HTTPS) o <strong>"Crear acceso directo"</strong> (en WiFi local).
                    </li>
                    <li>
                      <strong>iPhone (Safari):</strong> Toca <strong>Compartir</strong> <span className="bg-white dark:bg-slate-700 px-1 py-0.5 rounded font-mono font-bold">⎋</span> abajo y luego <strong>"Agregar al inicio"</strong> ➕.
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Acciones de Seguridad y Sesión */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2.5">
              {onLock && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setIsMoreSheetOpen(false);
                    onLock();
                  }}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs tap-haptic cursor-pointer"
                >
                  <Lock size={15} />
                  <span>Bloquear</span>
                </button>
              )}

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(15);
                    setIsMoreSheetOpen(false);
                    onLogout();
                  }}
                  className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs tap-haptic cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>

            {/* Footer institucional */}
            <p className="text-center text-[0.625rem] text-slate-400 dark:text-slate-500 font-medium mt-4">
              SAN BENITO MIX 2026 • Plataforma Financiera Central
            </p>
          </div>
        </div>
      )}
    </>
  );
};
