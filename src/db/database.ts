import Dexie, { type Table } from 'dexie';
import bcrypt from 'bcryptjs';

// ─── Type Definitions ───────────────────────────────────────────

export type UserRole = 'master' | 'admin';
export type ProductCategory = 'frutos_secos' | 'platanitos' | 'turrones' | 'varios';
export type TransactionType = 'income' | 'expense' | 'payroll' | 'adjustment' | 'client_payment';
export type SyncOperation = 'create' | 'update' | 'delete';
export type RateSource = 'bcv_usd' | 'bcv_eur' | 'binance_usdt';
export type ClientStatus = 'pending' | 'paid';
export type PlatanitosFlavorType = 'Maduro' | 'Salado' | 'Ajo' | 'Picante' | 'Ondulado';

export interface User {
  id?: number;
  name: string;
  avatar: string;
  pinHash: string;
  role: UserRole;
}

export interface Settings {
  id?: number;
  userId: number;
  viewCosts: boolean;
  viewMargins: boolean;
  viewWallet: boolean;
  editLedger: boolean;
  registerPayroll: boolean;
  modifyRates: boolean;
  applySurcharges: boolean;
}

export interface ExchangeRate {
  id?: number;
  source: RateSource;
  rate: number;
  timestamp: number;
  isActive: boolean;
}

export interface Product {
  id?: number;
  category: ProductCategory;
  name: string;
  photo: string;
  flavor?: PlatanitosFlavorType;
  costTotalUSD: number;
  costTotalVES: number;
  totalWeightGrams?: number;
  packWeightGrams?: number;
  packCount?: number;
  bulkQuantity?: number;
  marginPercent: number;
  costUnitUSD: number;
  costUnitVES: number;
  priceUSD: number;
  priceVES: number;
  stock: number;
  comboUnits?: number;
  comboPrice?: number;
  unitType?: string;
  itemCategory?: string;
  minStock?: number;
  sku?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Loss {
  id?: number;
  productId: number;
  productName: string;
  quantity: number;
  reason: string;
  monetaryLossUSD: number;
  monetaryLossVES: number;
  date: number;
  userId: number;
}

export interface Account {
  id?: number;
  bankName: string;
  accountType: string;
  currency: string;
  balance: number;
  cardLast4: string;
  color: string;
  icon: string;
  order: number;
}

export interface Transaction {
  id?: number;
  type: TransactionType;
  amount: number;
  currency: string;
  amountUSD: number;
  amountVES: number;
  accountId: number;
  accountName: string;
  description: string;
  clientId?: number;
  rateUsed: number;
  rateSource: RateSource;
  date: number;
  userId: number;
  userName: string;
}

export interface AuditLog {
  id?: number;
  transactionId: number;
  field: string;
  previousValue: string;
  newValue: string;
  userId: number;
  userName: string;
  timestamp: number;
}

export interface Client {
  id?: number;
  name: string;
  phone?: string;
  debtUSD: number;
  debtVES: number;
  rateAtCreation: number;
  dueDate: number;
  status: ClientStatus;
  surchargePercent: number;
  surchargeActive: boolean;
  paidDate?: number;
  paidAccountId?: number;
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: SyncOperation;
  recordId: number;
  data: string;
  timestamp: number;
  synced: boolean;
  retries: number;
}

export interface DispatchItem {
  productId: number;
  productName: string;
  productPhoto?: string;
  category: ProductCategory;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitPriceUSD: number;
  totalUSD: number;
}

export interface DispatchRecord {
  id?: number;
  productId: number;
  productName: string;
  productPhoto?: string;
  category: ProductCategory;
  quantity: number;
  previousStock: number;
  newStock: number;
  unitPriceUSD: number;
  totalUSD: number;
  receiverName: string;
  deliveredBy: string;
  date: number;
  notes?: string;
  userId: number;
  items?: DispatchItem[];
  totalUnits?: number;
  rateUsed?: number;
  totalVES?: number;
  status?: 'delivered' | 'certified' | 'received';
}

export interface ProductionBatch {
  id?: number;
  batchCode: string;
  processType: 'tostado_mani' | 'tostado_mixto' | 'fritura_platanitos' | 'coccion_turron' | 'otro';
  rawIngredientName: string;
  rawWeightKg: number;
  rawCostUSD: number;
  outputWeightKg: number;
  lossKg: number;
  lossPercent: number;
  netCostPerKgUSD: number;
  targetProductId?: number;
  targetProductName?: string;
  unitsProduced: number;
  status: 'completed' | 'in_progress';
  date: number;
  notes?: string;
  userId: number;
}

export interface AccountClosureDetail {
  accountId: number;
  bankName: string;
  currency: string;
  systemBalance: number;
  physicalBalance: number;
  difference: number;
}

export interface CashClosure {
  id?: number;
  closureCode: string;
  date: number;
  closedByUserId: number;
  closedByUserName: string;
  totalSystemUSD: number;
  totalPhysicalUSD: number;
  totalDiffUSD: number;
  totalSystemVES: number;
  totalPhysicalVES: number;
  totalDiffVES: number;
  rateUsed: number;
  accountsDetail: AccountClosureDetail[];
  observations?: string;
  status: 'locked' | 'draft';
}

// ─── Database Class ─────────────────────────────────────────────

export class SanBenitoDatabase extends Dexie {
  users!: Table<User>;
  settings!: Table<Settings>;
  exchangeRates!: Table<ExchangeRate>;
  products!: Table<Product>;
  losses!: Table<Loss>;
  accounts!: Table<Account>;
  transactions!: Table<Transaction>;
  auditLog!: Table<AuditLog>;
  clients!: Table<Client>;
  syncQueue!: Table<SyncQueueItem>;
  dispatches!: Table<DispatchRecord>;
  productionBatches!: Table<ProductionBatch>;
  cashClosures!: Table<CashClosure>;

  constructor() {
    super('SanBenitoMixDB');

    this.version(1).stores({
      users: '++id, name, role',
      settings: '++id, userId',
      exchangeRates: '++id, source, isActive, timestamp',
      products: '++id, category, name, flavor, updatedAt',
      losses: '++id, productId, date',
      accounts: '++id, bankName, currency, order',
      transactions: '++id, type, accountId, clientId, date, userId',
      auditLog: '++id, transactionId, userId, timestamp',
      clients: '++id, name, status, dueDate, createdAt',
      syncQueue: '++id, table, synced, timestamp',
    });

    this.version(2).stores({
      users: '++id, name, role',
      settings: '++id, userId',
      exchangeRates: '++id, source, isActive, timestamp',
      products: '++id, category, name, flavor, updatedAt',
      losses: '++id, productId, date',
      accounts: '++id, bankName, currency, order',
      transactions: '++id, type, accountId, clientId, date, userId',
      auditLog: '++id, transactionId, userId, timestamp',
      clients: '++id, name, status, dueDate, createdAt',
      syncQueue: '++id, table, synced, timestamp',
      dispatches: '++id, productId, productName, receiverName, date, userId',
      productionBatches: '++id, batchCode, status, date',
      cashClosures: '++id, closureCode, date, closedByUserId',
    });
  }
}

export const db = new SanBenitoDatabase();

// ─── User Sanitization & Deduplication ──────────────────────────

export async function enforceUniqueUsers(): Promise<User[]> {
  const allUsers = await db.users.toArray();

  let masterUser = allUsers.find((u) => u.role === 'master');
  let adminUser = allUsers.find((u) => u.role === 'admin');

  // If no master exists, create one
  if (!masterUser) {
    const beikerHash = await bcrypt.hash('28515677', 10);
    const id = (await db.users.add({
      name: 'Beiker Pérez',
      avatar: '👨🏻‍💻',
      pinHash: beikerHash,
      role: 'master',
    })) as number;
    masterUser = { id, name: 'Beiker Pérez', avatar: '👨🏻‍💻', pinHash: beikerHash, role: 'master' };
  }

  // If no admin exists, create one
  if (!adminUser) {
    const fabianaHash = await bcrypt.hash('31121033', 10);
    const id = (await db.users.add({
      name: 'Fabiana Acosta',
      avatar: '👩🏻‍💼',
      pinHash: fabianaHash,
      role: 'admin',
    })) as number;
    adminUser = { id, name: 'Fabiana Acosta', avatar: '👩🏻‍💼', pinHash: fabianaHash, role: 'admin' };
  }

  // Find any duplicate user IDs that are NOT our canonical masterUser.id or adminUser.id
  const canonicalIds = new Set([masterUser.id!, adminUser.id!]);
  const duplicateIds: number[] = [];
  for (const u of allUsers) {
    if (u.id && !canonicalIds.has(u.id)) {
      duplicateIds.push(u.id);
    }
  }

  if (duplicateIds.length > 0) {
    await db.users.bulkDelete(duplicateIds);
    // Also remove orphan settings for deleted IDs
    for (const dupId of duplicateIds) {
      const orphans = await db.settings.where('userId').equals(dupId).toArray();
      for (const orphan of orphans) {
        if (orphan.id) await db.settings.delete(orphan.id);
      }
    }
    console.log(`[DB Users] 🧹 Se purgaron ${duplicateIds.length} cuentas de usuario duplicadas de la base de datos.`);
  }

  // Ensure admin has a settings entry
  const existingSettings = await db.settings.where('userId').equals(adminUser.id!).first();
  if (!existingSettings) {
    await db.settings.add({
      userId: adminUser.id!,
      viewCosts: false,
      viewMargins: false,
      viewWallet: false,
      editLedger: false,
      registerPayroll: false,
      modifyRates: false,
      applySurcharges: false,
    });
  }

  return [masterUser, adminUser];
}

export const OFFICIAL_ACCOUNTS: Omit<Account, 'id'>[] = [
  { bankName: 'Banesco', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#007953', icon: '🏦', order: 0 },
  { bankName: 'Banco de Venezuela', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#003366', icon: '🏛️', order: 1 },
  { bankName: 'Binance', accountType: 'Crypto', currency: 'USDT', balance: 0, cardLast4: '----', color: '#F0B90B', icon: '₿', order: 2 },
  { bankName: 'Banco Nacional de Crédito', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#005C42', icon: '💳', order: 3 },
  { bankName: 'Banco Mercantil', accountType: 'Corriente', currency: 'VES', balance: 0, cardLast4: '0000', color: '#002868', icon: '🏦', order: 4 },
  { bankName: 'Banco Digital de los Trabajadores', accountType: 'Corriente Digital', currency: 'VES', balance: 0, cardLast4: '0000', color: '#0D1B2A', icon: '⚡', order: 5 },
  { bankName: 'Efectivo en Bolívares', accountType: 'Caja Chica', currency: 'VES', balance: 0, cardLast4: '----', color: '#0F4C3A', icon: '🇻🇪', order: 6 },
  { bankName: 'Efectivo Divisas', accountType: 'Caja Fuerte', currency: 'USD', balance: 0, cardLast4: '----', color: '#064E3B', icon: '💵', order: 7 },
];

export async function enforceOfficialAccounts(): Promise<void> {
  const current = await db.accounts.toArray();
  const currentMap = new Map<string, Account>();
  
  for (const acc of current) {
    const norm = acc.bankName.toLowerCase().trim();
    if (norm.includes('binance')) currentMap.set('binance', acc);
    else if (norm.includes('venezuela') || norm.includes('bdv')) currentMap.set('banco de venezuela', acc);
    else if (norm.includes('banesco')) currentMap.set('banesco', acc);
    else if (norm.includes('bnc') && !norm.includes('mercantil')) currentMap.set('banco nacional de crédito', acc);
    else if (norm.includes('mercantil') && !norm.includes('bnc')) currentMap.set('banco mercantil', acc);
    else if (norm.includes('trabajadores') || norm.includes('bdt')) currentMap.set('banco digital de los trabajadores', acc);
    else if (norm.includes('bol') || (norm.includes('efectivo') && acc.currency === 'VES')) currentMap.set('efectivo en bolívares', acc);
    else if (norm.includes('divisas') || norm.includes('caja chica') || (norm.includes('efectivo') && acc.currency === 'USD')) currentMap.set('efectivo divisas', acc);
  }

  // If already exactly the 8 official accounts, do nothing to avoid unnecessary rewrites
  const hasAllEight = OFFICIAL_ACCOUNTS.every((tmpl) =>
    current.some((c) => c.bankName.toLowerCase().trim() === tmpl.bankName.toLowerCase().trim())
  );
  if (current.length === OFFICIAL_ACCOUNTS.length && hasAllEight) {
    return;
  }

  // Clear and update to the 8 official accounts, preserving existing balances
  await db.accounts.clear();
  const updatedList: Account[] = OFFICIAL_ACCOUNTS.map((template, idx) => {
    const norm = template.bankName.toLowerCase().trim();
    const existing = currentMap.get(norm);
    return {
      ...template,
      id: idx + 1,
      balance: existing ? existing.balance : 0,
    };
  });

  await db.accounts.bulkAdd(updatedList);
  console.log(`[DB Accounts] ✅ 8 Cuentas Oficiales Sincronizadas y Actualizadas en Bóveda.`);
}

export async function seedDefaultData(): Promise<void> {
  // Always guarantee clean users without duplicates
  await enforceUniqueUsers();

  // Always enforce the 8 official accounts requested by user
  await enforceOfficialAccounts();

  const rateCount = await db.exchangeRates.count();
  if (rateCount === 0) {
    let initialActive = 'bcv_usd';
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sbm_active_rate_source');
      if (saved === 'bcv_usd' || saved === 'bcv_eur' || saved === 'binance_usdt') {
        initialActive = saved;
      }
    }
    // Default exchange rates
    await db.exchangeRates.bulkAdd([
      { source: 'bcv_usd', rate: 0, timestamp: Date.now(), isActive: initialActive === 'bcv_usd' },
      { source: 'bcv_eur', rate: 0, timestamp: Date.now(), isActive: initialActive === 'bcv_eur' },
      { source: 'binance_usdt', rate: 0, timestamp: Date.now(), isActive: initialActive === 'binance_usdt' },
    ]);
  }
}

// ─── Real-Time Cross-Tab / Cross-Window Sync Bus ──────────────────
let syncBus: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    syncBus = new BroadcastChannel('sbm_realtime_bus');
    syncBus.onmessage = (event) => {
      if (event.data?.type === 'sbm_sync_mutation') {
        window.dispatchEvent(new CustomEvent('sbm:sync', { detail: event.data.detail }));
      }
    };
  } catch (err) {
    console.warn('[SyncBus] BroadcastChannel no soportado o con error:', err);
  }
}

export function notifyDataMutation(
  tableName: string,
  operation: 'create' | 'update' | 'delete',
  recordId: number,
  data?: any
): void {
  if (typeof window === 'undefined') return;

  const detail = { table: tableName, operation, recordId, data, time: Date.now() };

  // 1. Disparar en la pestaña/ventana actual inmediatamente (0ms)
  window.dispatchEvent(new CustomEvent('sbm:sync', { detail }));
  window.dispatchEvent(new CustomEvent('sbm:queue_item_added'));

  // 2. Transmitir a todas las demás pestañas o ventanas PWA abiertas
  if (syncBus) {
    try {
      syncBus.postMessage({ type: 'sbm_sync_mutation', detail });
    } catch {
      // Ignorar errores de postMessage si la ventana cerró
    }
  }
}

// ─── CRUD Helpers with Sync Queue & Instant Reactivity ──────────────

export async function addWithSync<T extends { id?: number }>(
  table: Table<T>,
  tableName: string,
  data: T
): Promise<number> {
  const id = (await table.add(data)) as number;
  const payloadData = { ...data, id };

  await db.syncQueue.add({
    table: tableName,
    operation: 'create',
    recordId: id,
    data: JSON.stringify(payloadData),
    timestamp: Date.now(),
    synced: false,
    retries: 0,
  });

  notifyDataMutation(tableName, 'create', id, payloadData);
  return id;
}

export async function updateWithSync<T extends { id?: number }>(
  table: Table<T>,
  tableName: string,
  id: number,
  changes: Partial<T>
): Promise<void> {
  await table.update(id, changes as any);
  const updated = await table.get(id);
  const payloadData = updated || { ...changes, id };

  await db.syncQueue.add({
    table: tableName,
    operation: 'update',
    recordId: id,
    data: JSON.stringify(payloadData),
    timestamp: Date.now(),
    synced: false,
    retries: 0,
  });

  notifyDataMutation(tableName, 'update', id, payloadData);
}

export async function deleteWithSync<T>(
  table: Table<T>,
  tableName: string,
  id: number
): Promise<void> {
  await table.delete(id);
  await db.syncQueue.add({
    table: tableName,
    operation: 'delete',
    recordId: id,
    data: JSON.stringify({ id }),
    timestamp: Date.now(),
    synced: false,
    retries: 0,
  });

  notifyDataMutation(tableName, 'delete', id, { id });
}

// ─── WhatsApp Text & Client Name Sanitizer ──────────────────────

export function cleanClientName(rawName: string): string {
  if (!rawName) return '';
  let str = rawName.trim();

  // Strip WhatsApp timestamp prefixes
  str = str.replace(
    /^\[\s*\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\s*\]\s*/i,
    ''
  );
  str = str.replace(
    /^\[\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?,?\s+\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?\s*\]\s*/i,
    ''
  );
  str = str.replace(
    /^\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\s*-\s*/i,
    ''
  );

  // Strip WhatsApp sender prefix if multiple colons
  const colons = (str.match(/:/g) || []).length;
  if (colons >= 2) {
    const firstColonIdx = str.indexOf(':');
    str = str.substring(firstColonIdx + 1).trim();
  }

  // If there is still a colon, take the client name portion
  if (str.includes(':')) {
    const colonIdx = str.indexOf(':');
    const beforeColon = str.substring(0, colonIdx).trim();
    const afterColon = str.substring(colonIdx + 1).trim();
    if (!afterColon || /^\s*[\$]?\s*\d+(?:[.,]\d+)?\s*[\$]?\s*$/.test(afterColon)) {
      str = beforeColon;
    } else {
      str = beforeColon;
    }
  }

  // Remove residual numbers or currency tags in name
  str = str.replace(/\$?\s*\d+(?:[.,]\d+)?\s*\$?/g, '').trim();
  str = str.replace(/^[-–—~*_\s:]+|[-–—~*_\s:]+$/g, '').trim();

  return str || rawName;
}

export async function cleanExistingClientRecords(): Promise<number> {
  try {
    const clients = await db.clients.toArray();
    let cleaned = 0;
    for (const c of clients) {
      const sanitizedName = cleanClientName(c.name);
      if (sanitizedName !== c.name && sanitizedName.length > 0) {
        await db.clients.update(c.id!, {
          name: sanitizedName,
          updatedAt: Date.now(),
        });
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[DB Cleaner] ✅ Se limpiaron ${cleaned} nombres de clientes con formato de WhatsApp.`);
    }
    return cleaned;
  } catch (e) {
    console.warn('[DB Cleaner] Error cleaning client names:', e);
    return 0;
  }
}

// ─── System Factory Reset / Wipe Data ───────────────────────────

export async function resetSystemToBlank(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.products,
      db.losses,
      db.transactions,
      db.auditLog,
      db.clients,
      db.dispatches,
      db.productionBatches,
      db.cashClosures,
      db.syncQueue,
      db.accounts,
    ],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.losses.clear(),
        db.transactions.clear(),
        db.auditLog.clear(),
        db.clients.clear(),
        db.dispatches.clear(),
        db.productionBatches.clear(),
        db.cashClosures.clear(),
        db.syncQueue.clear(),
      ]);

      // Reset official account balances to 0 with explicit canonical IDs (1 to 8)
      await db.accounts.clear();
      await db.accounts.bulkAdd(
        OFFICIAL_ACCOUNTS.map((a, idx) => ({ ...a, id: idx + 1, balance: 0 }))
      );
    }
  );

  // Reset central database in LAN network server
  try {
    if (typeof fetch !== 'undefined') {
      await fetch('/api/sync/reset', { method: 'POST' });
    }
  } catch {
    // Ignore network failure if running purely offline
  }

  console.log('[DB Reset] 🗑️ Sistema dejado en blanco con éxito. Tablas operativas vaciadas y cuentas en cero.');
}

