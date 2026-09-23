import React, { useState, useEffect } from 'react';
import { db, type User, type Settings, type RateSource } from '../db/database';
import { useAuthStore, useIsMaster, updatePermission } from '../auth/auth-store';
import { useExchangeRateStore, formatCurrency } from '../services/exchange-rate-service';
import { ALL_PERMISSIONS, type PermissionKey } from '../auth/rbac';
import { AresPage } from '../modules/ares/ares-page';
import { BackupManager } from '../components/backup-manager';
import { ResetSystemModal } from '../components/reset-system-modal';
import { CloudSyncCard } from '../components/cloud-sync-card';
import { SystemUpdatesCard } from '../components/system-updates-card';
import { ProfileDeliveriesCard } from '../components/profile-deliveries-card';
import {
  AlertOctagon,
  Shield,
  ShieldCheck,
  User as UserIcon,
  DollarSign,
  LogOut,
  Lock,
  Globe,
  TrendingUp,
  Landmark,
  FileEdit,
  Users,
  RefreshCw,
  Percent,
  CheckCircle2,
  ChevronRight,
  ArrowUpRight,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface PermissionDefinition {
  title: string;
  description: string;
  icon: React.FC<{ size: number; className?: string }>;
  color: string;
  bgLight: string;
}

const PERMISSION_CONFIG: Record<PermissionKey, PermissionDefinition> = {
  viewCosts: {
    title: 'Estructura de Costos de Adquisición',
    description: 'Permite auditar costos unitarios de materia prima y desembolsos de fabricación.',
    icon: DollarSign,
    color: '#0086C9',
    bgLight: 'rgba(0, 134, 201, 0.1)',
  },
  viewMargins: {
    title: 'Márgenes de Rentabilidad Comercial',
    description: 'Habilita la consulta de margen porcentual de ganancia y valorización proyectada.',
    icon: TrendingUp,
    color: '#00CA72',
    bgLight: 'rgba(0, 202, 114, 0.1)',
  },
  viewWallet: {
    title: 'Bóvedas y Balances Financieros',
    description: 'Otorga acceso al desglose de saldos en cuentas bancarias, divisas y criptoactivos.',
    icon: Landmark,
    color: '#A25DDC',
    bgLight: 'rgba(162, 93, 220, 0.1)',
  },
  editLedger: {
    title: 'Modificación del Libro Mayor',
    description: 'Faculta la edición y anulación de asientos históricos en el libro contable inmutable.',
    icon: FileEdit,
    color: '#E2445C',
    bgLight: 'rgba(226, 68, 92, 0.1)',
  },
  registerPayroll: {
    title: 'Gestión de Nómina y Remuneraciones',
    description: 'Habilita el registro y liquidación de pagos clasificados como nómina de personal.',
    icon: Users,
    color: '#FDAB3D',
    bgLight: 'rgba(253, 171, 61, 0.1)',
  },
  modifyRates: {
    title: 'Ajuste de Paridades Cambiarias',
    description: 'Permite forzar tasas de cambio manuales fuera de la sincronización automática.',
    icon: RefreshCw,
    color: '#6161FF',
    bgLight: 'rgba(97, 97, 255, 0.1)',
  },
  applySurcharges: {
    title: 'Aplicación de Recargos por Mora',
    description: 'Autoriza la imposición o exoneración de tarifas y penalizaciones a clientes.',
    icon: Percent,
    color: '#FFCB00',
    bgLight: 'rgba(255, 203, 0, 0.12)',
  },
};

export const SettingsPage: React.FC = () => {
  const isMaster = useIsMaster();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const { rates, activeSource, manualSetRate, isLiveStreaming, setActiveSource } = useExchangeRateStore();

  const [adminSettings, setAdminSettings] = useState<Settings | null>(null);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [showAres, setShowAres] = useState(false);
  const [editingRate, setEditingRate] = useState<RateSource | null>(null);
  const [manualRate, setManualRate] = useState('');
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    loadAdminSettings();
  }, []);

  const loadAdminSettings = async () => {
    const admin = await db.users.where('role').equals('admin').first();
    if (admin?.id) {
      setAdminUser(admin);
      let settings = await db.settings.where('userId').equals(admin.id).first();
      if (!settings) {
        const id = await db.settings.add({
          userId: admin.id,
          viewCosts: false,
          viewMargins: false,
          viewWallet: false,
          editLedger: false,
          registerPayroll: false,
          modifyRates: false,
          applySurcharges: false,
        }) as number;
        settings = await db.settings.get(id);
      }
      setAdminSettings(settings || null);
    }
  };

  const handleToggle = async (key: PermissionKey, value: boolean) => {
    if (!adminUser?.id) return;
    await updatePermission(adminUser.id, key, value);
    setAdminSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    setLastSavedMessage(`Privilegio "${PERMISSION_CONFIG[key].title}" ${value ? 'habilitado' : 'restringido'}`);
    setTimeout(() => setLastSavedMessage(null), 3000);
  };

  const handleManualRate = async () => {
    if (!editingRate) return;
    const rate = parseFloat(manualRate);
    if (rate > 0) {
      await manualSetRate(editingRate, rate);
      setEditingRate(null);
      setManualRate('');
    }
  };

  if (showAres) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E6E9EF]">
          <button
            onClick={() => setShowAres(false)}
            className="mn-btn mn-btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            ← Volver a Configuración
          </button>
          <span className="text-xs font-semibold text-[#676879]">
            Ares Sentinel Core 2026
          </span>
        </div>
        <AresPage />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E9EF] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#6161FF] uppercase tracking-wider">
              Gobernanza y Seguridad
            </span>
            <span className="text-xs text-[#C5C7D0]">·</span>
            <span className="text-xs font-semibold text-[#00CA72] flex items-center gap-1">
              <ShieldCheck size={13} /> Sistema Protegido
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#323338] tracking-tight">
            Configuración del Sistema
          </h1>
          <p className="text-xs text-[#676879] mt-0.5">
            Gestión de perfiles, matriz de privilegios de acceso operativo (RBAC) y parámetros institucionales
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAres(true)}
            className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-2 hover:border-[#6161FF] hover:text-[#6161FF]"
          >
            <Shield size={14} className="text-[#E2445C]" />
            <span>Auditoría Ares AI</span>
          </button>
          <button
            onClick={logout}
            className="mn-btn text-xs py-2 px-3.5 bg-rose-50 text-[#E2445C] hover:bg-rose-100 flex items-center gap-2 border border-rose-200 transition-colors"
          >
            <LogOut size={14} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* User Profile Card */}
      <div className="mn-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-md flex-shrink-0"
              style={{
                background:
                  currentUser?.role === 'master'
                    ? 'linear-gradient(135deg, #6161FF, #5050E6)'
                    : 'linear-gradient(135deg, #A25DDC, #8E44AD)',
              }}
            >
              {currentUser?.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-[#323338] leading-tight">
                  {currentUser?.name}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    currentUser?.role === 'master'
                      ? 'bg-[#6161FF]/10 text-[#6161FF]'
                      : 'bg-[#A25DDC]/10 text-[#A25DDC]'
                  }`}
                >
                  {currentUser?.role === 'master' ? 'Master · Dirección General' : 'Administradora de Operaciones'}
                </span>
              </div>
              <p className="text-xs text-[#676879] mt-1 flex items-center gap-2">
                <span>Sesión Cifrada bcrypt</span>
                <span>·</span>
                <span className="text-[#00CA72] font-semibold flex items-center gap-1">
                  <CheckCircle2 size={12} /> Acceso Autenticado
                </span>
              </p>
            </div>
          </div>

          <div className="text-xs text-[#676879] bg-[#F6F7FB] px-3.5 py-2 rounded-xl border border-[#E6E9EF] flex items-center gap-2">
            <Lock size={14} className="text-[#6161FF]" />
            <span>ID Autenticación: PIN 8 Dígitos</span>
          </div>
        </div>
      </div>

      {/* Direct Deliveries Section (Fabiana Acosta <-> Beiker Pérez) */}
      <ProfileDeliveriesCard />

      {/* RBAC Permissions Panel (Master Only) */}
      {isMaster && adminSettings && adminUser && (
        <div className="mn-card overflow-hidden">
          {/* Panel Enterprise Header */}
          <div className="p-5 border-b border-[#E6E9EF] bg-gradient-to-r from-white to-[#F6F7FB]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-md bg-[#6161FF]/10 text-[#6161FF] uppercase tracking-wider">
                    Control de Acceso Basado en Roles (RBAC)
                  </span>
                  <span className="text-xs text-[#C5C7D0]">·</span>
                  <span className="text-xs font-bold text-[#323338]">
                    Perfil Asignado: {adminUser.name}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#323338] tracking-tight">
                  Matriz de Privilegios y Acceso Operativo
                </h2>
                <p className="text-xs text-[#676879] mt-0.5 max-w-2xl leading-relaxed">
                  Active o inactive las facultades operativas del rol Administrador. Las modificaciones se aplican en tiempo real y garantizan el estricto cumplimiento del principio de menor privilegio.
                </p>
              </div>

              {lastSavedMessage && (
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-fade-in">
                  <CheckCircle2 size={14} className="text-[#00CA72]" />
                  <span>{lastSavedMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Matrix Rows */}
          <div className="divide-y divide-[#F0F1F3]">
            {ALL_PERMISSIONS.map((key) => {
              const config = PERMISSION_CONFIG[key];
              const Icon = config.icon;
              const isEnabled = adminSettings[key] as boolean;

              return (
                <div
                  key={key}
                  className="p-4 hover:bg-[#F9FAFC] transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: config.bgLight, color: config.color }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#323338]">
                          {config.title}
                        </span>
                        <span
                          className={`text-[0.625rem] font-bold px-1.5 py-0.5 rounded ${
                            isEnabled
                              ? 'bg-emerald-50 text-[#00CA72]'
                              : 'bg-gray-100 text-[#676879]'
                          }`}
                        >
                          {isEnabled ? 'AUTORIZADO' : 'RESTRINGIDO'}
                        </span>
                      </div>
                      <p className="text-xs text-[#676879] mt-0.5 leading-normal">
                        {config.description}
                      </p>
                    </div>
                  </div>

                  {/* Monday Switch */}
                  <div
                    onClick={() => handleToggle(key, !isEnabled)}
                    className={`mn-toggle ${isEnabled ? 'on' : ''}`}
                    role="switch"
                    aria-checked={isEnabled}
                    title={isEnabled ? 'Clic para revocar privilegio' : 'Clic para conceder privilegio'}
                  />
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="p-4 bg-[#F6F7FB] border-t border-[#E6E9EF] text-xs text-[#676879] flex items-center gap-2">
            <ShieldCheck size={15} className="text-[#6161FF]" />
            <span>
              Configuración restringida para nivel Master. El usuario Administrador no puede auto-otorgarse privilegios.
            </span>
          </div>
        </div>
      )}

      {/* Exchange Rates Control (Master Only) */}
      {isMaster && (
        <div className="mn-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E6E9EF]">
            <div>
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-[#6161FF]" />
                <h2 className="text-base font-bold text-[#323338]">
                  Paridades Cambiarias y Tasas de Conversión
                </h2>
              </div>
              <p className="text-xs text-[#676879] mt-0.5">
                Valores vigentes utilizados para la conversión multidivisa y fijación de precios en bolívares.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#676879]">
                Canal SSE:
              </span>
              <span className={`px-2 py-0.5 rounded text-[0.6875rem] font-bold ${
                isLiveStreaming ? 'bg-emerald-50 text-[#00CA72]' : 'bg-amber-50 text-[#FDAB3D]'
              }`}>
                {isLiveStreaming ? 'Enlace Directo Activo' : 'Sondeo Periódico'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* BCV USD */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeSource === 'bcv_usd'
                  ? 'bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-[#E6E9EF] bg-[#F6F7FB]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#676879] mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[0.625rem] font-black">
                    $
                  </span>
                  Oficial BCV USD
                </span>
                {activeSource === 'bcv_usd' ? (
                  <span className="text-[0.625rem] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    🔒 FIJADA
                  </span>
                ) : (
                  <span className="text-[0.625rem] font-semibold text-[#00CA72]">Referencial</span>
                )}
              </div>
              <div className="text-xl font-black font-mono text-[#323338]">
                {rates.bcv_usd.toFixed(2)} Bs
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E6E9EF]">
                {activeSource === 'bcv_usd' ? (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-black text-emerald-700">
                    <CheckCircle2 size={13} className="text-emerald-600" /> Tasa Activa del Sistema
                  </span>
                ) : isMaster ? (
                  <button
                    onClick={async () => {
                      await setActiveSource('bcv_usd');
                      setLastSavedMessage('🔒 Tasa Oficial BCV USD fijada como activa en todo el sistema');
                      setTimeout(() => setLastSavedMessage(null), 3000);
                    }}
                    type="button"
                    className="text-xs font-bold text-[#6161FF] hover:bg-[#6161FF] hover:text-white px-2 py-1 rounded-lg border border-[#6161FF]/30 transition-all cursor-pointer"
                  >
                    Fijar esta Tasa
                  </button>
                ) : (
                  <span className="text-[0.6875rem] font-medium text-[#A4A7B5] italic">
                    🔒 Solo Master
                  </span>
                )}
                {isMaster && (
                  <button
                    onClick={() => {
                      setEditingRate('bcv_usd');
                      setManualRate(String(rates.bcv_usd));
                    }}
                    className="text-xs font-bold text-[#676879] hover:text-[#323338] hover:underline flex items-center gap-0.5"
                  >
                    <span>Ajustar</span>
                    <ArrowUpRight size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* BCV EUR */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeSource === 'bcv_eur'
                  ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/20 shadow-sm'
                  : 'border-[#E6E9EF] bg-[#F6F7FB]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#676879] mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[0.625rem] font-black">
                    €
                  </span>
                  Oficial BCV EUR
                </span>
                {activeSource === 'bcv_eur' ? (
                  <span className="text-[0.625rem] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    🔒 FIJADA
                  </span>
                ) : (
                  <span className="text-[0.625rem] font-semibold text-[#005BAA]">Referencial</span>
                )}
              </div>
              <div className="text-xl font-black font-mono text-[#323338]">
                {rates.bcv_eur.toFixed(2)} Bs
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E6E9EF]">
                {activeSource === 'bcv_eur' ? (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-black text-blue-700">
                    <CheckCircle2 size={13} className="text-blue-600" /> Tasa Activa del Sistema
                  </span>
                ) : isMaster ? (
                  <button
                    onClick={async () => {
                      await setActiveSource('bcv_eur');
                      setLastSavedMessage('🔒 Tasa Oficial BCV EUR fijada como activa en todo el sistema');
                      setTimeout(() => setLastSavedMessage(null), 3000);
                    }}
                    type="button"
                    className="text-xs font-bold text-[#6161FF] hover:bg-[#6161FF] hover:text-white px-2 py-1 rounded-lg border border-[#6161FF]/30 transition-all cursor-pointer"
                  >
                    Fijar esta Tasa
                  </button>
                ) : (
                  <span className="text-[0.6875rem] font-medium text-[#A4A7B5] italic">
                    🔒 Solo Master
                  </span>
                )}
                {isMaster && (
                  <button
                    onClick={() => {
                      setEditingRate('bcv_eur');
                      setManualRate(String(rates.bcv_eur));
                    }}
                    className="text-xs font-bold text-[#676879] hover:text-[#323338] hover:underline flex items-center gap-0.5"
                  >
                    <span>Ajustar</span>
                    <ArrowUpRight size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Binance USDT */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                activeSource === 'binance_usdt'
                  ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20 shadow-sm'
                  : 'border-[#E6E9EF] bg-[#F6F7FB]'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-[#676879] mb-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[0.625rem] font-black">
                    ₮
                  </span>
                  Binance P2P USDT
                </span>
                {activeSource === 'binance_usdt' ? (
                  <span className="text-[0.625rem] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    🔒 FIJADA
                  </span>
                ) : (
                  <span className="text-[0.625rem] font-semibold text-[#FDAB3D]">Mercado Libre</span>
                )}
              </div>
              <div className="text-xl font-black font-mono text-[#323338]">
                {rates.binance_usdt.toFixed(2)} Bs
              </div>
              <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E6E9EF]">
                {activeSource === 'binance_usdt' ? (
                  <span className="inline-flex items-center gap-1 text-[0.6875rem] font-black text-amber-700">
                    <CheckCircle2 size={13} className="text-amber-600" /> Tasa Activa del Sistema
                  </span>
                ) : isMaster ? (
                  <button
                    onClick={async () => {
                      await setActiveSource('binance_usdt');
                      setLastSavedMessage('🔒 Tasa Binance USDT fijada como activa en todo el sistema');
                      setTimeout(() => setLastSavedMessage(null), 3000);
                    }}
                    type="button"
                    className="text-xs font-bold text-[#6161FF] hover:bg-[#6161FF] hover:text-white px-2 py-1 rounded-lg border border-[#6161FF]/30 transition-all cursor-pointer"
                  >
                    Fijar esta Tasa
                  </button>
                ) : (
                  <span className="text-[0.6875rem] font-medium text-[#A4A7B5] italic">
                    🔒 Solo Master
                  </span>
                )}
                {isMaster && (
                  <button
                    onClick={() => {
                      setEditingRate('binance_usdt');
                      setManualRate(String(rates.binance_usdt));
                    }}
                    className="text-xs font-bold text-[#676879] hover:text-[#323338] hover:underline flex items-center gap-0.5"
                  >
                    <span>Ajustar</span>
                    <ArrowUpRight size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rate Edit Modal / Bar */}
          {editingRate && (
            <div className="mt-4 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row items-center gap-3 animate-fade-in">
              <span className="text-xs font-bold text-[#323338]">
                Nueva tasa para {editingRate.toUpperCase()}:
              </span>
              <input
                type="number"
                step="0.01"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                placeholder="Ej. 65.50"
                className="mn-input max-w-xs text-sm font-mono font-bold"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualRate}
                  className="mn-btn mn-btn-primary text-xs py-2 px-4"
                >
                  Guardar Tasa
                </button>
                <button
                  onClick={() => setEditingRate(null)}
                  className="mn-btn mn-btn-outline text-xs py-2 px-3"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actualizaciones del Sistema OTA */}
      <SystemUpdatesCard />

      {/* Sincronización en la Nube Supabase */}
      <CloudSyncCard />

      {/* Backup and Restore Manager */}
      <BackupManager />

      {/* Zona de Peligro: Dejar en Blanco el Sistema (Master Only) */}
      {isMaster && (
        <div className="mn-card p-5 border border-rose-200 bg-rose-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertOctagon size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-rose-950">
                    Zona de Peligro · Dejar en Blanco el Sistema
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[0.625rem] font-bold">
                    Reinicio Total
                  </span>
                </div>
                <p className="text-xs text-rose-700 mt-0.5 max-w-xl leading-relaxed">
                  Elimina todo el inventario, clientes, ventas, compras, despachos, mermas y asientos contables, restableciendo las cuentas bancarias a 0.00 para empezar desde cero.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowResetModal(true)}
              className="mn-btn bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 flex items-center gap-2 flex-shrink-0 shadow-sm transition-colors"
            >
              <AlertOctagon size={14} />
              <span>Dejar en Blanco el Sistema</span>
            </button>
          </div>
        </div>
      )}

      <ResetSystemModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
      />

      {/* Ares AI & Security Core Banner */}
      <div className="mn-card p-5 bg-gradient-to-br from-[#1D2132] to-[#292F4C] text-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
              <Sparkles size={22} className="text-[#00CA72]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Ares Sentinel & Antivirus v2.6
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#00CA72]/20 text-[#00CA72] text-[0.625rem] font-black">
                  100% OPERATIVO
                </span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Auditoría continua de doble partida contable, blindaje offline-first y monitoreo algorítmico de pérdidas.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAres(true)}
            className="mn-btn bg-white text-[#1D2132] hover:bg-white/90 text-xs font-bold py-2.5 px-4 flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Abrir Centro de Control Ares</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
