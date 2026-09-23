import React, { useState, useEffect } from 'react';
import { seedDefaultData, cleanExistingClientRecords } from './db/database';
import { startPeriodicSync, pullFromLocalServer } from './db/sync-engine';
import { startRatePolling, useExchangeRateStore } from './services/exchange-rate-service';
import { useAuthStore } from './auth/auth-store';
import { LockScreen } from './auth/lock-screen';
import { RateBar } from './components/dynamic-island';
import { SyncBadge } from './components/sync-badge';
import { Sidebar, type TabId } from './components/tab-bar';
import { InventoryPage } from './modules/inventory/inventory-page';
import { VaultPage } from './modules/vault/vault-page';
import { ClientsPage } from './modules/clients/clients-page';
import { LedgerPage } from './modules/vault/ledger-page';
import { AresPage } from './modules/ares/ares-page';
import { SettingsPage } from './pages/settings-page';
import { DispatchModal } from './modules/inventory/dispatch-modal';
import { MobileBottomNav } from './components/mobile-bottom-nav';
import { AresCopilotModal } from './components/ares-copilot-modal';
import { InstallAppModal } from './components/install-app-modal';
import { UpdateToast } from './components/update-toast';
import { DeliveryToast } from './components/delivery-toast';
import { useThemeStore } from './services/theme-service';
import { Lock, LogOut, Menu, Sparkles, Sun, Moon, Smartphone } from 'lucide-react';

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  inventory: { title: 'Gestión de Inventario', subtitle: 'Control de existencias, costos y rentabilidad' },
  vault: { title: 'Bóveda y Cuentas', subtitle: 'Saldos multimoneda, transferencias y cierres' },
  clients: { title: 'Clientes y Cuentas por Cobrar', subtitle: 'Créditos, listas de precios y recargos' },
  ledger: { title: 'Libro Contable', subtitle: 'Historial de auditoría inmutable' },
  ares: { title: 'Ares AI Sentinel & Antivirus', subtitle: 'Supervisión de salud del sistema, diagnósticos inteligentes y blindaje de seguridad' },
  settings: { title: 'Ajustes del Sistema', subtitle: 'Control de permisos RBAC y monitor Ares' },
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('inventory');
  // Keep-alive cache: only mount tabs as they are visited, but preserve them in memory for 0ms switching
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(() => new Set<TabId>(['inventory']));
  const [isInitialized, setIsInitialized] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showGlobalDispatchModal, setShowGlobalDispatchModal] = useState(false);
  const [showAresCopilot, setShowAresCopilot] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const { isAuthenticated, currentUser, logout, lockScreen } = useAuthStore();
  const loadRates = useExchangeRateStore((s) => s.loadRates);
  const { theme, toggleTheme } = useThemeStore();

  // Global hotkey: Ctrl+K or Cmd+K to open Ares AI Copilot anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowAresCopilot((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        // Pull latest state from local central server first
        await pullFromLocalServer();

        // Seed database with default data (users, accounts, rates)
        await seedDefaultData();

        // Clean any polluted client names from previous WhatsApp pastes
        await cleanExistingClientRecords();

        // Always require login on app launch (Mandatory authentication on PC and Mobile)
        await useAuthStore.getState().loadUsers();

        // Load cached exchange rates
        await loadRates();

        // Start background sync and rate polling
        startPeriodicSync(30000);
        startRatePolling(20000);

        setIsInitialized(true);
      } catch (error) {
        console.error('Initialization error:', error);
        setIsInitialized(true); // Still show UI to not block
      }
    };

    init();
  }, [loadRates]);

  // Loading Screen (Monday.com style)
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F7FB]">
        <div className="flex flex-col items-center animate-fade-in">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #6161FF, #A25DDC)' }}
          >
            <span className="text-3xl">🥜</span>
          </div>
          <h1 className="text-2xl font-bold text-[#323338] mb-1">
            SAN BENITO MIX
          </h1>
          <p className="text-xs text-[#676879] mb-4">Administración Central 2026</p>
          <div className="w-36 h-1.5 rounded-full overflow-hidden bg-[#E6E9EF]">
            <div
              className="h-full rounded-full animate-pulse"
              style={{ background: 'var(--mn-primary)', width: '60%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Lock Screen
  if (!isAuthenticated) {
    return <LockScreen />;
  }

  const currentMeta = TAB_TITLES[activeTab] || { title: 'San Benito Mix', subtitle: '' };

  return (
    <div className="min-h-screen flex bg-[#F6F7FB] dark:bg-[#0B0F19] text-[#323338] dark:text-[#F3F4F6] transition-colors duration-200">
      {/* Monday Dark Sidebar with Mobile Drawer */}
      <Sidebar
        activeTab={activeTab}
        onChange={(tab) => {
          setActiveTab(tab);
          setMobileMenuOpen(false);
        }}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        userName={currentUser?.name}
        userAvatar={currentUser?.avatar}
        userRole={currentUser?.role}
        onLock={lockScreen}
        onLogout={logout}
        onOpenDispatch={() => setShowGlobalDispatchModal(true)}
      />

      {/* Main Workspace Layout (Full width on mobile, offset on desktop) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ml-0 ${
          sidebarCollapsed ? 'md:ml-[64px]' : 'md:ml-[260px]'
        }`}
      >
        {/* Executive Cockpit Top Bar */}
        <header className="mn-topbar">
          {/* Left: Brand Identity & Active Section */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-[#676879] dark:text-slate-400 transition-colors md:hidden cursor-pointer tap-haptic"
              title="Abrir menú de navegación"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/san-benito-logo.jpg"
                alt="San Benito Mix"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-400/60 shadow-sm flex-shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-xs sm:text-base font-extrabold text-[#1E293B] dark:text-white truncate whitespace-nowrap">
                  {currentMeta.title}
                </h1>
                <p className="text-[0.6875rem] text-[#676879] dark:text-slate-400 font-medium truncate hidden xl:block leading-none mt-0.5">
                  San Benito Mix · Administración 2026
                </p>
              </div>
            </div>
          </div>

          {/* Center (Desktop Only): Executive Live Rate Dock */}
          <div className="hidden md:flex flex-1 items-center justify-center min-w-0 px-2">
            <RateBar />
          </div>

          {/* Right Header Area: Live Sync, Theme Toggle, AI Assistant & Quick Lock */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <SyncBadge />

            {/* Dark / Light Mode Quick Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 transition-all cursor-pointer tap-haptic"
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {theme === 'dark' ? (
                <Sun size={15} className="text-amber-400 fill-amber-400" />
              ) : (
                <Moon size={15} className="text-indigo-600 fill-indigo-600" />
              )}
            </button>

            {/* Ares Copilot AI Button */}
            <button
              onClick={() => setShowAresCopilot(true)}
              className="relative group px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#6161FF] via-[#7B51EC] to-[#9A42E4] hover:opacity-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
              title="Abrir Ares AI Copilot (Atajo: Ctrl+K)"
            >
              <Sparkles size={13} className="animate-pulse" />
              <span className="text-[0.6875rem] sm:text-xs font-black">Ares AI</span>
              <kbd className="hidden lg:inline text-[0.5625rem] bg-white/20 px-1 py-0.5 rounded font-mono font-normal">
                Ctrl+K
              </kbd>
            </button>

            {/* Install Mobile PWA / APK Button */}
            <button
              onClick={() => setShowInstallModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all tap-haptic cursor-pointer"
              title="Instalar App en el Celular (APK / PWA)"
            >
              <Smartphone size={14} className="text-[#6161FF]" />
              <span className="hidden lg:inline text-[0.6875rem] font-bold">Móviles</span>
            </button>

            {/* Quick Mobile Lock Screen Button */}
            <button
              onClick={lockScreen}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors md:hidden cursor-pointer tap-haptic"
              title="Bloquear pantalla"
            >
              <Lock size={15} />
            </button>
          </div>
        </header>

        {/* Mobile Dedicated Live Rate Ticker Strip (Always legible on Android & iPhone) */}
        <div className="md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-2.5 py-1.5 flex items-center shadow-xs">
          <RateBar isMobileStrip={true} />
        </div>

        {/* Page Main Content with bottom padding for mobile navigation */}
        <main className="flex-1 overflow-y-auto mn-page pb-24 md:pb-6">
          <div className={activeTab === 'inventory' ? 'block' : 'hidden'}>
            {visitedTabs.has('inventory') && <InventoryPage />}
          </div>
          <div className={activeTab === 'vault' ? 'block' : 'hidden'}>
            {visitedTabs.has('vault') && <VaultPage />}
          </div>
          <div className={activeTab === 'clients' ? 'block' : 'hidden'}>
            {visitedTabs.has('clients') && <ClientsPage />}
          </div>
          <div className={activeTab === 'ledger' ? 'block' : 'hidden'}>
            {visitedTabs.has('ledger') && <LedgerPage />}
          </div>
          <div className={activeTab === 'ares' ? 'block' : 'hidden'}>
            {visitedTabs.has('ares') && <AresPage />}
          </div>
          <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
            {visitedTabs.has('settings') && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Ares AI Copilot Modal */}
      <AresCopilotModal
        isOpen={showAresCopilot}
        onClose={() => setShowAresCopilot(false)}
        onNavigateTab={(tab) => setActiveTab(tab as TabId)}
      />

      {/* Native Mobile Bottom Navigation Bar (iOS / Android) */}
      <MobileBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        userRole={currentUser?.role}
        userName={currentUser?.name}
        onLock={lockScreen}
        onLogout={logout}
        onOpenDispatch={() => setShowGlobalDispatchModal(true)}
        onOpenAres={() => setShowAresCopilot(true)}
      />

      {/* Global Dispatch Modal Triggered from Sidebar */}
      {showGlobalDispatchModal && (
        <DispatchModal
          onClose={() => setShowGlobalDispatchModal(false)}
          onSuccess={() => setShowGlobalDispatchModal(false)}
        />
      )}

      {/* Install Mobile App / QR Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* Real-time Delivery Notifications (Fabiana -> Beiker) */}
      <DeliveryToast />

      {/* Over-The-Air (OTA) System Updates Toast */}
      <UpdateToast />
    </div>
  );
};

export default App;
