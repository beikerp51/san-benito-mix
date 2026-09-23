import { type Settings } from '../db/database';
import { useAuthStore } from './auth-store';

// ─── Permission Keys ────────────────────────────────────────────

export type PermissionKey = keyof Omit<Settings, 'id' | 'userId'>;

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  viewCosts: 'Ver costos de compra mayorista',
  viewMargins: 'Ver márgenes y utilidad neta',
  viewWallet: 'Ver saldos y tarjetas de la Bóveda',
  editLedger: 'Editar/anular asientos contables',
  registerPayroll: 'Registrar pagos de nómina',
  modifyRates: 'Modificar tasas de cambio',
  applySurcharges: 'Aplicar/exonerar recargos de mora',
};

export const ALL_PERMISSIONS: PermissionKey[] = [
  'viewCosts',
  'viewMargins',
  'viewWallet',
  'editLedger',
  'registerPayroll',
  'modifyRates',
  'applySurcharges',
];

// ─── Guard Component Helper ────────────────────────────────────

export function canAccess(permission: PermissionKey): boolean {
  const state = useAuthStore.getState();
  const { currentUser, permissions } = state;

  if (!currentUser) return false;
  if (currentUser.role === 'master') return true;
  if (!permissions) return false;

  return permissions[permission] as boolean;
}

// ─── Role Check ─────────────────────────────────────────────────

export function isMaster(): boolean {
  return useAuthStore.getState().currentUser?.role === 'master';
}

export function isAdmin(): boolean {
  return useAuthStore.getState().currentUser?.role === 'admin';
}
