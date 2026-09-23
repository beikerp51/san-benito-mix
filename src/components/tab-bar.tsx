import React from 'react';
import { Package, Landmark, Users, BookOpen, Settings, Shield, Menu, ChevronLeft, Lock, LogOut, Send, Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../services/theme-service';

export type TabId = 'inventory' | 'vault' | 'clients' | 'ledger' | 'ares' | 'settings';

const NAV_ITEMS: { id: TabId; label: string; icon: React.FC<{ size: number }>; section?: string; badge?: string }[] = [
  { id: 'inventory', label: 'Inventario', icon: Package, section: 'GESTIÓN' },
  { id: 'vault', label: 'Bóveda', icon: Landmark },
  { id: 'clients', label: 'Clientes', icon: Users },
  { id: 'ledger', label: 'Libro Contable', icon: BookOpen, section: 'FINANZAS' },
  { id: 'ares', label: 'Ares AI & Antivirus', icon: Shield, section: 'SEGURIDAD & IA', badge: '100%' },
  { id: 'settings', label: 'Ajustes', icon: Settings, section: 'SISTEMA' },
];

export interface SidebarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
  collapsed?: boolean;
  onToggle?: () => void;
  userName?: string;
  userAvatar?: string;
  userRole?: string;
  onLock?: () => void;
  onLogout?: () => void;
  onOpenDispatch?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onChange,
  collapsed = false,
  onToggle = () => {},
  mobileOpen = false,
  onMobileClose = () => {},
  userName,
  userAvatar,
  userRole,
  onLock,
  onLogout,
  onOpenDispatch,
}) => {
  let lastSection = '';
  const { theme, toggleTheme } = useThemeStore();

  const handleSelectTab = (tab: TabId) => {
    onChange(tab);
    onMobileClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={onMobileClose}
        />
      )}

      <div className={`mn-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo Area */}
        <div className="mn-sidebar-logo">
          <img
            src="/san-benito-logo.jpg"
            alt="San Benito Mix"
            className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400/50 shadow-md flex-shrink-0"
          />
          {(!collapsed || mobileOpen) && (
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate">SAN BENITO MIX</div>
              <div className="text-xs text-white/50 font-medium truncate mt-0.5">
                Administración 2026
              </div>
            </div>
          )}

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0 hidden md:block"
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? (
              <Menu size={18} color="rgba(255,255,255,0.5)" />
            ) : (
              <ChevronLeft size={18} color="rgba(255,255,255,0.5)" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors flex-shrink-0 md:hidden"
            title="Cerrar menú"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

      {/* Navigation */}
      <div className="mn-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const Icon = item.icon;

          return (
            <React.Fragment key={item.id}>
              {showSection && !collapsed && (
                <div className="mn-sidebar-section">{item.section}</div>
              )}
              <button
                className={`mn-sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} />
                {!collapsed && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[0.6875rem] font-extrabold px-1.5 py-0.5 rounded-full bg-[#00CA72]/20 text-[#00CA72] ml-2">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>

              {/* Exclusive Administradora Quick Action in Left Panel */}
              {item.id === 'inventory' && userRole === 'admin' && onOpenDispatch && (
                <button
                  type="button"
                  onClick={onOpenDispatch}
                  className="mn-sidebar-item my-1 bg-gradient-to-r from-[#6161FF]/25 to-[#A25DDC]/25 hover:from-[#6161FF]/40 hover:to-[#A25DDC]/40 border border-[#6161FF]/40 text-white font-bold transition-all shadow-sm group"
                  title={collapsed ? 'Entregar Mercancía a Dirección' : undefined}
                >
                  <Send size={18} className="text-amber-300 group-hover:scale-110 transition-transform" />
                  {!collapsed && (
                    <div className="flex items-center justify-between flex-1 min-w-0">
                      <span className="truncate text-white text-xs font-bold">Entregar Mercancía</span>
                      <span className="text-[0.5625rem] font-black px-1.5 py-0.2 rounded bg-amber-400 text-black uppercase tracking-wider">
                        Admin
                      </span>
                    </div>
                  )}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* User Footer */}
      <div className="mn-sidebar-footer">
        <div className="flex items-center gap-3">
          <div
            className="mn-avatar"
            style={{
              background: userRole === 'master' ? 'var(--mn-primary)' : 'var(--mn-purple)',
              fontSize: '1rem',
            }}
          >
            {userAvatar || '👤'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold truncate">{userName}</div>
              <div className="text-xs text-white/50 font-medium truncate mt-0.5">
                {userRole === 'master' ? 'Master · Contador (CPC)' : 'Administradora · Contadora (CP)'}
              </div>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-amber-300 transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            {onLock && (
              <button
                onClick={onLock}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                title="Bloquear pantalla"
              >
                <Lock size={15} />
              </button>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </>
  );
};

export const TabBar = Sidebar;

