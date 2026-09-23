import React, { useState, useEffect, useMemo } from 'react';
import { db, type Client, type Account, updateWithSync, addWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { useAuthStore } from '../../auth/auth-store';
import { SmartPasteModal } from './smart-paste-modal';
import { SurchargeCard } from './surcharge-card';
import { exportClientsToExcel } from './excel-export';
import {
  Plus,
  Check,
  CheckCircle2,
  Edit3,
  MessageCircle,
  FileSpreadsheet,
  ClipboardPaste,
  Filter,
  Search,
  Users,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingDown,
  X,
  CreditCard,
  Building2,
  Calendar,
  Phone,
  UserPlus,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import { BankLogo } from '../../components/bank-logos';

type FilterMode = 'all' | 'pending' | 'paid';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [showPaste, setShowPaste] = useState(false);
  const [showSurcharge, setShowSurcharge] = useState<Client | null>(null);
  const [payingClient, setPayingClient] = useState<Client | null>(null);
  const [paymentAmountStr, setPaymentAmountStr] = useState<string>('');
  const [showNewClient, setShowNewClient] = useState(false);

  // New Client Form State
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientDebt, setNewClientDebt] = useState('');
  const [newClientNote, setNewClientNote] = useState('');

  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    loadData();

    const handleSync = () => {
      loadData();
    };
    window.addEventListener('sbm:sync', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
    };
  }, []);

  const loadData = async () => {
    const [c, a] = await Promise.all([
      db.clients.orderBy('name').toArray(),
      db.accounts.toArray(),
    ]);
    setClients(c);
    setAccounts(a);
  };

  const filteredClients = useMemo(() => {
    let list = clients;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.note && c.note.toLowerCase().includes(q))
      );
    }

    if (filter === 'pending') {
      list = list.filter((c) => c.status === 'pending');
    } else if (filter === 'paid') {
      list = list.filter((c) => c.status === 'paid');
    }

    return list;
  }, [clients, search, filter]);

  const getClientEffectiveDebtUSD = (c: Client): number => {
    if (c.status === 'paid') return 0;
    const base = c.debtUSD || 0;
    if (c.surchargeActive && c.surchargePercent) {
      return Number((base * (1 + c.surchargePercent / 100)).toFixed(2));
    }
    return Number(base.toFixed(2));
  };

  // Statistics
  const pendingClients = useMemo(() => clients.filter((c) => c.status === 'pending'), [clients]);
  const paidClients = useMemo(() => clients.filter((c) => c.status === 'paid'), [clients]);
  const totalDebtUSD = useMemo(
    () => pendingClients.reduce((sum, c) => sum + getClientEffectiveDebtUSD(c), 0),
    [pendingClients]
  );
  const overdueClients = useMemo(
    () => pendingClients.filter((c) => c.dueDate && Date.now() > c.dueDate),
    [pendingClients]
  );

  const handleConfirmPayment = async (client: Client, selectedAccount: Account) => {
    const effectiveDebtUSD = getClientEffectiveDebtUSD(client);
    const parsedAmount = parseFloat(paymentAmountStr);
    const payUSD = isNaN(parsedAmount) || parsedAmount <= 0
      ? effectiveDebtUSD
      : Math.min(effectiveDebtUSD, Number(parsedAmount.toFixed(2)));

    const isFullPayment = Math.abs(payUSD - effectiveDebtUSD) < 0.01 || payUSD >= effectiveDebtUSD;
    const remainingEffectiveUSD = isFullPayment ? 0 : Number((effectiveDebtUSD - payUSD).toFixed(2));

    // Normalizar la deuda base para que el recargo activo no se aplique de forma compuesta
    const surchargeFactor = (client.surchargeActive && client.surchargePercent)
      ? (1 + client.surchargePercent / 100)
      : 1;
    const remainingBaseUSD = remainingEffectiveUSD > 0
      ? Number((remainingEffectiveUSD / surchargeFactor).toFixed(2))
      : 0;

    const isVESAccount = selectedAccount.currency === 'VES';
    const nativePaidAmount = isVESAccount
      ? Number((payUSD * activeRate).toFixed(2))
      : Number(payUSD.toFixed(2));
    const nativePaidUSD = Number(payUSD.toFixed(2));
    const nativePaidVES = Number((payUSD * activeRate).toFixed(2));

    // 1. Update client record
    await updateWithSync(db.clients, 'clients', client.id!, {
      debtUSD: remainingBaseUSD,
      debtVES: Number((remainingBaseUSD * activeRate).toFixed(2)),
      status: remainingBaseUSD <= 0 ? ('paid' as const) : ('pending' as const),
      paidDate: remainingBaseUSD <= 0 ? Date.now() : client.paidDate,
      paidAccountId: selectedAccount.id,
      surchargeActive: remainingBaseUSD <= 0 ? false : client.surchargeActive,
      updatedAt: Date.now(),
    });

    // 2. Add income transaction in account's native currency
    await addWithSync(db.transactions, 'transactions', {
      type: 'client_payment' as const,
      amount: nativePaidAmount,
      currency: selectedAccount.currency,
      amountUSD: nativePaidUSD,
      amountVES: nativePaidVES,
      accountId: selectedAccount.id!,
      accountName: selectedAccount.bankName,
      description: isFullPayment
        ? `Cobro de deuda comercial — ${client.name}`
        : `Abono parcial a deuda — ${client.name} (Saldo restante: $${remainingEffectiveUSD.toFixed(2)})`,
      clientId: client.id,
      rateUsed: activeRate,
      rateSource: useExchangeRateStore.getState().activeSource,
      date: Date.now(),
      userId: currentUser?.id || 0,
      userName: currentUser?.name || 'Administración',
    });

    // 3. Update account balance
    await updateWithSync(db.accounts, 'accounts', selectedAccount.id!, {
      balance: Number((selectedAccount.balance + nativePaidAmount).toFixed(2)),
    });

    setPayingClient(null);
    setPaymentAmountStr('');
    await loadData();
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;

    const debt = parseFloat(newClientDebt) || 0;
    const now = Date.now();
    const dueDate = now + 15 * 24 * 60 * 60 * 1000; // 15 days default

    await addWithSync(db.clients, 'clients', {
      name: newClientName.trim(),
      phone: newClientPhone.trim() || undefined,
      debtUSD: debt,
      debtVES: debt * activeRate,
      rateAtCreation: activeRate,
      dueDate,
      status: debt > 0 ? 'pending' : 'paid',
      surchargePercent: 10,
      surchargeActive: false,
      note: newClientNote.trim() || 'Crédito regular',
      createdAt: now,
      updatedAt: now,
    });

    setNewClientName('');
    setNewClientPhone('');
    setNewClientDebt('');
    setNewClientNote('');
    setShowNewClient(false);
    await loadData();
  };

  const handleWhatsApp = (client: Client) => {
    const daysOverdue = Math.max(
      0,
      Math.floor((Date.now() - client.dueDate) / (1000 * 60 * 60 * 24))
    );
    const vesEquivalent = (client.debtUSD * activeRate).toFixed(2);
    const message = `Estimado(a) ${client.name}, le saludamos de SAN BENITO MIX. Le recordamos su saldo pendiente por $${client.debtUSD.toFixed(
      2
    )} (equiv. ${vesEquivalent} Bs a tasa BCV del día).${
      daysOverdue > 0 ? ` Registra ${daysOverdue} día(s) de vencimiento.` : ''
    } Quedamos atentos para procesar su pago. ¡Muchas gracias!`;

    const phone = (client.phone || '').replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Top Header & Quick Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6E9EF] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#6161FF] uppercase tracking-wider">
              Gestión Comercial
            </span>
            <span className="text-xs text-[#C5C7D0]">·</span>
            <span className="text-xs font-semibold text-[#676879]">
              Cuentas por Cobrar
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#323338] tracking-tight">
            Directorio de Clientes
          </h1>
          <p className="text-xs text-[#676879] mt-0.5">
            Control de cuentas por cobrar, estados de crédito y cobranza directa por WhatsApp
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => exportClientsToExcel(clients, activeRate)}
            className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5"
            title="Exportar cartera a Excel"
          >
            <FileSpreadsheet size={15} className="text-[#00CA72]" />
            <span className="hidden sm:inline">Exportar Excel</span>
          </button>
          <button
            onClick={() => setShowPaste(true)}
            className="mn-btn text-xs py-2 px-3.5 bg-indigo-50 text-[#6161FF] hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 font-bold"
            title="Carga masiva desde texto de WhatsApp"
          >
            <ClipboardPaste size={15} />
            <span>Carga Inteligente</span>
          </button>
          <button
            onClick={() => setShowNewClient(true)}
            className="mn-btn mn-btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm shadow-[#6161FF]/20"
          >
            <Plus size={15} />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Overview (2x2 on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Deuda USD */}
        <div className="mn-card p-3 sm:p-4">
          <div className="flex items-center justify-between text-[0.6875rem] sm:text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span className="truncate">Deuda Total</span>
            <DollarSign size={15} className="text-[#E2445C] flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black font-mono text-[#E2445C] tracking-tight truncate">
            {formatCurrency(totalDebtUSD, 'USD')}
          </div>
          <div className="text-[0.625rem] sm:text-xs text-[#676879] font-medium mt-1 truncate">
            ≈ {formatCurrency(totalDebtUSD * activeRate, 'VES')}
          </div>
        </div>

        {/* Pendientes */}
        <div className="mn-card p-3 sm:p-4">
          <div className="flex items-center justify-between text-[0.6875rem] sm:text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span className="truncate">Con Deuda</span>
            <Users size={15} className="text-[#FDAB3D] flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#323338] tracking-tight">
            {pendingClients.length}
          </div>
          <div className="text-[0.625rem] sm:text-xs text-[#FDAB3D] font-semibold mt-1 truncate">
            Cobro pendiente
          </div>
        </div>

        {/* En Mora */}
        <div className="mn-card p-3 sm:p-4">
          <div className="flex items-center justify-between text-[0.6875rem] sm:text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span className="truncate">En Mora</span>
            <AlertTriangle size={15} className="text-[#E2445C] flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#E2445C] tracking-tight">
            {overdueClients.length}
          </div>
          <div className="text-[0.625rem] sm:text-xs text-[#676879] font-medium mt-1 truncate">
            Plazo vencido
          </div>
        </div>

        {/* Al Día */}
        <div className="mn-card p-3 sm:p-4">
          <div className="flex items-center justify-between text-[0.6875rem] sm:text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span className="truncate">Solventes</span>
            <CheckCircle2 size={15} className="text-[#00CA72] flex-shrink-0" />
          </div>
          <div className="text-lg sm:text-2xl font-black text-[#00CA72] tracking-tight">
            {paidClients.length}
          </div>
          <div className="text-[0.625rem] sm:text-xs text-[#676879] font-medium mt-1 truncate">
            {clients.length} clientes
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Segmented Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-white dark:bg-slate-700 text-[#323338] dark:text-white shadow-sm font-bold'
                : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
            }`}
          >
            Todos ({clients.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'pending'
                ? 'bg-white dark:bg-slate-700 text-[#E2445C] dark:text-rose-400 shadow-sm font-bold'
                : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
            }`}
          >
            Pendientes ({pendingClients.length})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'paid'
                ? 'bg-white dark:bg-slate-700 text-[#00CA72] dark:text-emerald-400 shadow-sm font-bold'
                : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
            }`}
          >
            Al Día ({paidClients.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#676879] dark:text-slate-400">
            <Search size={15} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, teléfono o nota..."
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 rounded-xl text-xs text-[#323338] dark:text-white placeholder:text-[#A0A4B8] focus:border-[#6161FF] focus:ring-2 focus:ring-[#6161FF]/10 outline-none transition-all"
          />
        </div>
      </div>

      {/* Monday Board Table */}
      <div className="mn-card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="mn-group-header bg-white dark:bg-slate-900 border-b border-[#E6E9EF] dark:border-slate-800">
          <div className="mn-group-color" style={{ background: '#FDAB3D' }} />
          <span className="text-sm font-bold text-[#323338] dark:text-white">
            Cartera de Clientes Registrada
          </span>
          <span className="text-xs text-[#676879] dark:text-slate-400 font-normal">
            ({filteredClients.length} registros)
          </span>
        </div>

        {/* Vista de Tarjetas Móviles Super Senior (iOS / Android) */}
        <div className="md:hidden p-3 space-y-3 bg-[#F8FAFC] dark:bg-slate-950/40">
          {filteredClients.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-[#676879] dark:text-slate-400 shadow-xs">
              <span className="text-3xl block mb-2">👥</span>
              No hay clientes que coincidan con la búsqueda.{' '}
              <button onClick={() => setShowPaste(true)} className="text-[#6161FF] dark:text-indigo-400 font-bold underline block mt-2 text-sm">
                Carga Inteligente
              </button>
            </div>
          ) : (
            filteredClients.map((client) => {
              const isPaid = client.status === 'paid';
              const daysOverdue = !isPaid && client.dueDate
                ? Math.max(0, Math.floor((Date.now() - client.dueDate) / (1000 * 60 * 60 * 24)))
                : 0;
              const initials = client.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={client.id}
                  className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-md active:scale-[0.985] transition-all space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-sm flex-shrink-0"
                        style={{ background: isPaid ? '#00CA72' : daysOverdue > 0 ? '#E2445C' : '#6161FF' }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{client.name}</div>
                        <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          {client.phone ? (
                            <a
                              href={`tel:${client.phone}`}
                              className="flex items-center gap-1 text-[#6161FF] dark:text-indigo-400 font-semibold hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone size={11} /> {client.phone}
                            </a>
                          ) : (
                            <span>Sin teléfono</span>
                          )}
                          {client.note && <span className="truncate">· {client.note}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="font-mono font-black text-base" style={{ color: isPaid ? '#00CA72' : '#E2445C' }}>
                        {formatCurrency(client.debtUSD, 'USD')}
                      </div>
                      <div className="font-mono text-[0.6875rem] text-slate-500 dark:text-slate-400">
                        ≈ {formatCurrency(client.debtUSD * activeRate, 'VES')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      {isPaid ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[0.6875rem] font-bold">
                          ✓ Al Día
                        </span>
                      ) : daysOverdue > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[0.6875rem] font-bold">
                          ⚠️ Mora {daysOverdue}d
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[0.6875rem] font-bold">
                          ● Saldo Pendiente
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isPaid && (
                        <button
                          type="button"
                          onClick={() => setPayingClient(client)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          <DollarSign size={13} />
                          <span>Cobrar</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleWhatsApp(client)}
                        className="p-2 rounded-xl bg-emerald-50 text-[#25D366] hover:bg-emerald-100 border border-emerald-200/80 active:scale-95 transition-all cursor-pointer"
                        title="Enviar mensaje por WhatsApp"
                      >
                        <MessageCircle size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowSurcharge(client)}
                        className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 active:scale-95 transition-all cursor-pointer"
                        title="Ver detalles o aplicar recargos"
                      >
                        <Percent size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Tabla para Escritorio */}
        <div className="hidden md:block overflow-x-auto">
          <table className="mn-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>AVATAR</th>
                <th>CLIENTE / RAZÓN SOCIAL</th>
                <th style={{ width: 140 }}>ESTADO</th>
                <th style={{ width: 130, textAlign: 'right' }}>DEUDA (USD)</th>
                <th style={{ width: 140, textAlign: 'right' }}>EQUIVALENTE (VES)</th>
                <th style={{ width: 130 }}>PLAZO / VENCIMIENTO</th>
                <th style={{ width: 160, textAlign: 'center' }}>GESTIÓN Y COBRANZA</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-[#676879]">
                    No se encontraron clientes que coincidan con los filtros actuales.{' '}
                    <button
                      onClick={() => setShowPaste(true)}
                      className="text-[#6161FF] font-semibold underline ml-1"
                    >
                      Realizar Carga Inteligente
                    </button>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const isPaid = client.status === 'paid';
                  const daysOverdue = !isPaid && client.dueDate
                    ? Math.max(0, Math.floor((Date.now() - client.dueDate) / (1000 * 60 * 60 * 24)))
                    : 0;

                  const initials = client.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-[#F5F6F8] transition-colors group"
                    >
                      {/* Avatar */}
                      <td className="mn-table-cell text-center">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm mx-auto"
                          style={{
                            background: isPaid
                              ? '#00CA72'
                              : daysOverdue > 0
                              ? '#E2445C'
                              : '#6161FF',
                          }}
                        >
                          {initials}
                        </div>
                      </td>

                      {/* Name & Note */}
                      <td className="mn-table-cell">
                        <div>
                          <div className="font-bold text-xs text-[#323338] leading-tight">
                            {client.name}
                          </div>
                          <div className="text-[0.6875rem] text-[#676879] flex items-center gap-2 mt-0.5">
                            {client.phone && (
                              <span className="flex items-center gap-0.5">
                                <Phone size={10} /> {client.phone}
                              </span>
                            )}
                            {client.note && <span>{client.note}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="mn-table-cell">
                        {isPaid ? (
                          <span className="mn-pill mn-pill-green">Al Día</span>
                        ) : daysOverdue > 0 ? (
                          <span className="mn-pill mn-pill-red">
                            Mora {daysOverdue}d
                          </span>
                        ) : (
                          <span className="mn-pill mn-pill-orange">Pendiente</span>
                        )}
                      </td>

                      {/* Debt USD */}
                      <td className="mn-table-cell text-right font-mono font-bold text-xs" style={{ color: isPaid ? '#00CA72' : '#E2445C' }}>
                        {formatCurrency(getClientEffectiveDebtUSD(client), 'USD')}
                        {client.surchargeActive && !isPaid && (
                          <span className="block text-[0.625rem] text-[#E2445C] font-semibold">
                            +{client.surchargePercent}% recargo
                          </span>
                        )}
                      </td>

                      {/* Debt VES */}
                      <td className="mn-table-cell text-right font-mono font-semibold text-xs text-[#323338]">
                        {formatCurrency(getClientEffectiveDebtUSD(client) * activeRate, 'VES')}
                      </td>

                      {/* Due Date */}
                      <td className="mn-table-cell text-xs text-[#676879]">
                        {client.dueDate ? (
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-[#A0A4B8]" />
                            <span>{new Date(client.dueDate).toLocaleDateString('es-VE')}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Actions */}
                      <td className="mn-table-cell text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Cobrar Button */}
                          {!isPaid && (
                            <button
                              onClick={() => {
                                setPayingClient(client);
                                setPaymentAmountStr(getClientEffectiveDebtUSD(client).toFixed(2));
                              }}
                              className="py-1 px-2.5 rounded-lg bg-emerald-50 text-[#00CA72] hover:bg-emerald-100 text-xs font-bold flex items-center gap-1 border border-emerald-200 transition-colors"
                              title="Registrar pago recibido en cuenta"
                            >
                              <Check size={12} />
                              <span>Cobrar</span>
                            </button>
                          )}

                          {/* WhatsApp Reminder Button */}
                          <button
                            onClick={() => handleWhatsApp(client)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-[#25D366] transition-colors"
                            title="Enviar recordatorio formal por WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </button>

                          {/* Recargo & Options Button */}
                          <button
                            onClick={() => setShowSurcharge(client)}
                            className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879] hover:text-[#6161FF] transition-colors"
                            title="Ver detalles o aplicar recargos"
                          >
                            <Edit3 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal (Eliminates ugly window.prompt) */}
      {payingClient && (
        <div className="mn-modal-overlay p-0 sm:p-4">
          <div className="mn-modal animate-scale-in my-0 sm:my-auto rounded-t-[28px] sm:rounded-2xl max-w-lg w-full">
            {/* Drag handle móvil */}
            <div className="md:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 flex-shrink-0" />
            <div className="mn-modal-header border-b border-[#E6E9EF]">
              <div>
                <h3 className="text-base font-bold text-[#323338]">
                  Registrar Cobro a Cliente
                </h3>
                <p className="text-xs text-[#676879] mt-0.5">
                  Selecciona la cuenta o bóveda receptora del pago de {payingClient.name}
                </p>
              </div>
              <button
                onClick={() => setPayingClient(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Payment Summary Box */}
              <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#676879] uppercase tracking-wider block">
                      Deuda Total Registrada
                    </span>
                    <div className="text-lg font-black font-mono text-[#E2445C]">
                      {formatCurrency(getClientEffectiveDebtUSD(payingClient), 'USD')}
                      {payingClient.surchargeActive && (
                        <span className="text-xs text-[#E2445C] ml-1.5 font-bold">
                          (incluye {payingClient.surchargePercent}% recargo)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-[#676879] block">Equivalente Total BCV</span>
                    <div className="text-base font-bold font-mono text-[#323338]">
                      {formatCurrency(getClientEffectiveDebtUSD(payingClient) * activeRate, 'VES')}
                    </div>
                  </div>
                </div>

                {/* Amount to Pay (Full or Partial / Abono) */}
                <div className="pt-2 border-t border-[#E6E9EF]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#323338]">
                      Monto a Cobrar / Abonar (USD):
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaymentAmountStr(getClientEffectiveDebtUSD(payingClient).toFixed(2))}
                      className="text-[0.6875rem] font-bold text-[#6161FF] hover:underline"
                    >
                      Pagar Totalidad ($)
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#676879]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getClientEffectiveDebtUSD(payingClient)}
                      value={paymentAmountStr}
                      onChange={(e) => setPaymentAmountStr(e.target.value)}
                      className="mn-input pl-7 text-base font-mono font-black text-[#00CA72]"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="text-[0.6875rem] text-[#676879] mt-1 font-mono">
                    Equivale a cobrar:{' '}
                    <strong className="text-[#323338]">
                      {formatCurrency((parseFloat(paymentAmountStr) || 0) * activeRate, 'VES')}
                    </strong>{' '}
                    en cuentas en Bolívares.
                  </div>
                </div>
              </div>

              {/* Account Selection Grid */}
              <div>
                <label className="block text-xs font-bold text-[#323338] mb-2">
                  Cuenta Destino Receptora:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {accounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleConfirmPayment(payingClient, acc)}
                      className="p-3 rounded-xl border border-[#E6E9EF] hover:border-[#6161FF] hover:bg-[#6161FF]/5 text-left transition-all flex items-center gap-3 group"
                    >
                      <BankLogo name={acc.bankName} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#323338] truncate group-hover:text-[#6161FF]">
                          {acc.bankName}
                        </div>
                        <div className="text-[0.6875rem] text-[#676879] truncate">
                          {acc.accountType} · {acc.currency}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mn-modal-footer">
              <button
                onClick={() => setPayingClient(null)}
                className="mn-btn mn-btn-outline text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal (Large Executive Format) */}
      {showNewClient && (
        <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
          <div className="mn-modal max-w-4xl w-full animate-scale-in bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-[#E6E9EF] overflow-hidden my-0 sm:my-auto flex flex-col max-h-[94dvh]">
            {/* Drag handle móvil */}
            <div className="md:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 flex-shrink-0" />
            <div className="mn-modal-header border-b border-[#E6E9EF] bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] px-4 sm:px-7 py-3.5 sm:py-5 flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 pr-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#6161FF]/10 text-[#6161FF] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <UserPlus size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                    <span className="text-[0.625rem] sm:text-[0.6875rem] font-extrabold uppercase tracking-wider text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded-full">
                      Clientes & CRM
                    </span>
                    <span className="text-xs text-[#C5C7D0]">/</span>
                    <span className="text-xs text-[#00CA72] font-semibold flex items-center gap-1">
                      <ShieldCheck size={11} /> Cuentas por Cobrar
                    </span>
                  </div>
                  <h3 className="text-base sm:text-2xl font-black text-[#323338] tracking-tight truncate">
                    Registrar Nuevo Cliente
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  type="submit"
                  form="new-client-form"
                  className="py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-95 transition-all cursor-pointer"
                  title="Guardar nuevo cliente"
                >
                  <UserPlus size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Guardar</span>
                  <span className="sm:hidden inline">Guardar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 text-[#676879] hover:text-[#323338] transition-colors"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <form id="new-client-form" onSubmit={handleCreateClient} className="p-4 sm:p-7 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Identificación y Contacto */}
                <div className="p-5 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                  <span className="text-xs font-black uppercase tracking-wider text-[#323338] block border-b border-[#E6E9EF] pb-2">
                    1. Identificación y Contacto
                  </span>

                  <div>
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                      Nombre Comercial o Razón Social
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Inversiones El Maní C.A. / Bodegón San José"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="mn-input text-xs font-bold"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                      Teléfono Móvil / WhatsApp de Cobranza
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej. 0414-1234567 / 0424-9876543"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="mn-input text-xs font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                      Zona Comercial o Dirección de Despacho
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Calle Principal, Local 4, Centro / Ruta Norte"
                      value={newClientNote}
                      onChange={(e) => setNewClientNote(e.target.value)}
                      className="mn-input text-xs"
                    />
                  </div>
                </div>

                {/* Right Column: Términos Financieros y Deuda Inicial */}
                <div className="p-5 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E6E9EF] pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-[#323338]">
                      2. Condiciones de Crédito y Deuda Inicial
                    </span>
                    <span className="text-[0.6875rem] font-mono font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded">
                      Tasa: {activeRate.toFixed(2)} Bs
                    </span>
                  </div>

                  <div>
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                      Saldo Inicial Pendiente / Deuda ($ USD)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newClientDebt}
                        onChange={(e) => setNewClientDebt(e.target.value)}
                        className="mn-input text-2xl font-mono font-black pl-8"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#676879]">
                        $
                      </span>
                    </div>
                  </div>

                  {/* Contravalor en Bolívares */}
                  <div className="p-3 bg-white rounded-xl border border-[#E6E9EF] flex items-center justify-between font-mono text-xs shadow-sm">
                    <span className="text-[#676879] font-sans">Equivalente en Bolívares:</span>
                    <span className="font-bold text-[#00CA72]">
                      {formatCurrency((parseFloat(newClientDebt) || 0) * activeRate, 'VES')}
                    </span>
                  </div>

                  <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-[#0086C9] space-y-1">
                    <span className="font-bold block">✓ Registro Inmediato en Libro Mayor</span>
                    <p className="text-[0.6875rem] leading-relaxed text-[#676879]">
                      Si se asigna una deuda inicial, se creará el asiento correspondiente en Cuentas por Cobrar Comerciales (NIIF 1.1.03.01).
                    </p>
                  </div>
                </div>
              </div>

              <div className="mn-modal-footer pt-4 border-t border-[#E6E9EF] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowNewClient(false)}
                  className="mn-btn mn-btn-outline text-xs px-5 py-2.5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!newClientName.trim()}
                  className="mn-btn mn-btn-primary text-xs px-7 py-2.5 flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 font-bold disabled:opacity-40"
                >
                  <UserPlus size={16} />
                  <span>Crear Ficha de Cliente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart Paste Modal */}
      {showPaste && (
        <SmartPasteModal
          onClose={() => {
            setShowPaste(false);
            loadData();
          }}
        />
      )}

      {/* Surcharge & Details Card Modal */}
      {showSurcharge && (
        <SurchargeCard
          client={showSurcharge}
          onClose={() => {
            setShowSurcharge(null);
            loadData();
          }}
        />
      )}

      {/* Floating Action Button (FAB) for Mobile (iPhone / Android) */}
      <button
        onClick={() => setShowNewClient(true)}
        className="md:hidden fixed bottom-24 right-4 z-40 bg-gradient-to-tr from-[#6161FF] via-[#7B51EC] to-[#9A42E4] text-white px-4 py-3 rounded-2xl shadow-xl shadow-indigo-500/35 flex items-center gap-2 active:scale-95 transition-all font-black text-xs cursor-pointer border border-white/20"
        title="Registrar Nuevo Cliente"
      >
        <UserPlus size={16} />
        <span>Nuevo Cliente</span>
      </button>
    </div>
  );
};

export default ClientsPage;
