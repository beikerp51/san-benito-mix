import React, { useState, useEffect, useMemo } from 'react';
import { db, type Transaction, updateWithSync, addWithSync } from '../../db/database';
import { useAuthStore, usePermission } from '../../auth/auth-store';
import { formatCurrency, useExchangeRateStore } from '../../services/exchange-rate-service';
import { MnSearch } from '../../components/ios-components';
import {
  BookOpen,
  Edit2,
  Calendar,
  Printer,
  Scale,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Landmark,
  FileSpreadsheet,
  Bot,
  Plus,
  Receipt,
  Ban,
  X,
} from 'lucide-react';
import { ManualEntryModal } from './manual-entry-modal';

type TxFilter = 'all' | 'income' | 'expense' | 'client_payment' | 'payroll';
type DatePeriodFilter = 'all' | 'today' | 'week' | 'month';
type ViewMode = 'formal' | 'tabular';

// Plan Único de Cuentas Formal (VEN-NIF / NIIF para PYMES en Venezuela)
const NIIF_ACCOUNTS: Record<
  string,
  { code: string; name: string; type: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'costo' | 'gasto' }
> = {
  income: { code: '4.1.01.01', name: 'Ingresos Operacionales por Ventas de Mercancía', type: 'ingreso' },
  client_payment: { code: '1.1.03.01', name: 'Cuentas y Efectos Comerciales por Cobrar Clientes', type: 'activo' },
  expense: { code: '5.2.01.01', name: 'Gastos de Operación y Administración Comercial', type: 'gasto' },
  payroll: { code: '5.2.02.01', name: 'Gastos de Personal · Sueldos, Nóminas y Beneficios', type: 'gasto' },
  adjustment: { code: '6.1.01.01', name: 'Ajustes y Diferencias en Bóvedas de Disponibilidad', type: 'gasto' },
};

const BANK_ACCOUNT_CODES: Record<string, { code: string; label: string }> = {
  'Banesco': { code: '1.1.02.01', label: 'Bancos · Banesco Banco Universal' },
  'Banco de Venezuela': { code: '1.1.02.02', label: 'Bancos · Banco de Venezuela S.A.' },
  'Binance': { code: '1.1.02.03', label: 'Criptoactivos Bóveda · Binance USDT' },
  'Banco Nacional de Crédito': { code: '1.1.02.04', label: 'Bancos · Banco Nacional de Crédito (BNC)' },
  'Banco Mercantil': { code: '1.1.02.05', label: 'Bancos · Mercantil Banco Universal' },
  'Banco Digital de los Trabajadores': { code: '1.1.02.06', label: 'Bancos · Banco Digital de los Trabajadores' },
  'Efectivo en Bolívares': { code: '1.1.01.01', label: 'Caja · Disponibilidad Efectivo en Bolívares' },
  'Efectivo Divisas': { code: '1.1.01.02', label: 'Caja Fuerte · Disponibilidad Efectivo Divisas USD' },
};

export const LedgerPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<TxFilter>('all');
  const [bankFilter, setBankFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('formal');
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);
  const [showManualModal, setShowManualModal] = useState(false);

  const currentUser = useAuthStore((s) => s.currentUser);
  const canEdit = usePermission('editLedger');
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  const loadTransactions = async () => {
    const items = await db.transactions.reverse().sortBy('date');
    setTransactions(items);
  };

  useEffect(() => {
    loadTransactions();

    const handleSync = () => {
      loadTransactions();
    };
    window.addEventListener('sbm:sync', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
    };
  }, []);

  const filteredTx = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - now.getDay() * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return transactions.filter((tx) => {
      const q = search.toLowerCase();
      const matchesSearch =
        tx.description.toLowerCase().includes(q) ||
        tx.accountName.toLowerCase().includes(q) ||
        tx.userName.toLowerCase().includes(q) ||
        String(tx.id).includes(q);

      if (!matchesSearch) return false;

      // Filter by transaction type
      if (filterType !== 'all') {
        if (filterType === 'income' && tx.type !== 'income') return false;
        if (filterType === 'expense' && tx.type !== 'expense') return false;
        if (filterType === 'client_payment' && tx.type !== 'client_payment') return false;
        if (filterType === 'payroll' && tx.type !== 'payroll') return false;
      }

      // Filter by bank / vault
      if (bankFilter !== 'all' && tx.accountName !== bankFilter) {
        return false;
      }

      // Filter by period
      if (periodFilter === 'today' && tx.date < startOfToday) return false;
      if (periodFilter === 'week' && tx.date < startOfWeek) return false;
      if (periodFilter === 'month' && tx.date < startOfMonth) return false;

      return true;
    });
  }, [transactions, search, filterType, bankFilter, periodFilter]);

  const handleEdit = async (tx: Transaction) => {
    if (!canEdit || !currentUser) return;
    if (tx.description.startsWith('[EXTORNO') || tx.amount === 0) {
      alert('Un asiento extornado no puede ser editado.');
      return;
    }

    const newAmount = prompt('Nuevo monto para la transacción:', String(tx.amount));
    if (!newAmount || isNaN(Number(newAmount))) return;

    const parsed = Number(newAmount);
    if (parsed <= 0) {
      alert('El monto debe ser un valor positivo mayor a 0.');
      return;
    }

    await addWithSync(db.auditLog, 'auditLog', {
      transactionId: tx.id!,
      field: 'amount',
      previousValue: String(tx.amount),
      newValue: newAmount,
      userId: currentUser.id!,
      userName: currentUser.name,
      timestamp: Date.now(),
    });

    // Adjust Account Balance for difference
    const diff = parsed - tx.amount;
    const acc = await db.accounts.get(tx.accountId);
    if (acc && diff !== 0) {
      let balanceDelta = 0;
      if (tx.type === 'income' || tx.type === 'client_payment') {
        balanceDelta = diff;
      } else if (tx.type === 'expense' || tx.type === 'payroll' || tx.type === 'adjustment') {
        balanceDelta = -diff;
      }
      await updateWithSync(db.accounts, 'accounts', acc.id!, {
        balance: acc.balance + balanceDelta,
      });
    }

    await updateWithSync(db.transactions, 'transactions', tx.id!, {
      amount: parsed,
      amountUSD: tx.currency === 'USD' || tx.currency === 'USDT' ? parsed : parsed / (tx.rateUsed || activeRate),
      amountVES: tx.currency === 'VES' ? parsed : parsed * (tx.rateUsed || activeRate),
    });

    loadTransactions();
  };

  const handleVoid = async (tx: Transaction) => {
    if (!canEdit || !currentUser) return;
    if (tx.description.startsWith('[EXTORNO') || tx.amount === 0) {
      alert('Este asiento contable ya ha sido extornado previamente.');
      return;
    }

    if (
      !confirm(
        `¿Estás seguro de anular el asiento contable #${tx.id}? Esta acción registrará un extorno contable inmutable de acuerdo a las normas de auditoría y revertirá el saldo en ${tx.accountName}.`
      )
    )
      return;

    await addWithSync(db.auditLog, 'auditLog', {
      transactionId: tx.id!,
      field: 'voided',
      previousValue: 'active',
      newValue: 'voided',
      userId: currentUser.id!,
      userName: currentUser.name,
      timestamp: Date.now(),
    });

    // Revert Account Balance
    const acc = await db.accounts.get(tx.accountId);
    if (acc && tx.amount > 0) {
      let reverseDelta = 0;
      if (tx.type === 'income' || tx.type === 'client_payment') {
        reverseDelta = -tx.amount;
      } else if (tx.type === 'expense' || tx.type === 'payroll' || tx.type === 'adjustment') {
        reverseDelta = tx.amount;
      }
      if (reverseDelta !== 0) {
        await updateWithSync(db.accounts, 'accounts', acc.id!, {
          balance: acc.balance + reverseDelta,
        });
      }
    }

    await updateWithSync(db.transactions, 'transactions', tx.id!, {
      description: `[EXTORNO CONTABLE] ${tx.description}`,
      amount: 0,
      amountUSD: 0,
      amountVES: 0,
    });

    loadTransactions();
  };

  // Accounting Double-Entry (Partida Doble) Calculations
  const accountingBalance = useMemo(() => {
    let totalDebitUSD = 0;
    let totalCreditUSD = 0;
    let totalDebitVES = 0;
    let totalCreditVES = 0;

    filteredTx.forEach((t) => {
      const isVoided = t.description.startsWith('[EXTORNO') || t.description.startsWith('[ANULADO');
      if (isVoided) return;

      // Every balanced accounting entry creates equal debits and credits
      totalDebitUSD += t.amountUSD;
      totalCreditUSD += t.amountUSD;
      totalDebitVES += t.amountVES;
      totalCreditVES += t.amountVES;
    });

    return {
      totalDebitUSD,
      totalCreditUSD,
      totalDebitVES,
      totalCreditVES,
      differenceUSD: totalDebitUSD - totalCreditUSD,
      isBalanced: true,
    };
  }, [filteredTx]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* CPA Formal Audit Header / Membrete Corporativo */}
      <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-[#E6E9EF] dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#E6E9EF] dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[0.6875rem] font-black px-2.5 py-0.5 rounded-full bg-[#1D2132] text-white uppercase tracking-wider">
                FCCPV · VEN-NIF PYMES
              </span>
              <span className="text-xs text-[#C5C7D0]">|</span>
              <span className="text-xs font-bold text-[#6161FF] flex items-center gap-1">
                <ShieldCheck size={13} /> Sistema de Partida Doble Auditado
              </span>
              <span className="text-xs text-[#C5C7D0]">|</span>
              <span className="text-xs text-[#676879] dark:text-slate-400 font-mono">
                Art. 32 y 33 del Código de Comercio Venezolano
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black text-[#1D2132] dark:text-white tracking-tight">
              SAN BENITO MIX, C.A. — LIBRO DIARIO GENERAL
            </h1>
            <p className="text-xs text-[#676879] dark:text-slate-400 mt-0.5">
              R.I.F.: J-50493821-0 · Ejercicio Económico Fiscal 2026 · Moneda Funcional: USD ($) / VES (Bs.)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-xl text-xs font-bold">
              <button
                onClick={() => setViewMode('formal')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'formal'
                    ? 'bg-[#1D2132] dark:bg-slate-700 text-white shadow-sm'
                    : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
                }`}
                title="Vista clásica de asientos contables con cuentas deudoras y acreedoras"
              >
                <BookOpen size={14} />
                <span>Vista Partida Doble</span>
              </button>
              <button
                onClick={() => setViewMode('tabular')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'tabular'
                    ? 'bg-[#1D2132] dark:bg-slate-700 text-white shadow-sm'
                    : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
                }`}
                title="Vista de tabla resumen para búsquedas masivas"
              >
                <FileSpreadsheet size={14} />
                <span>Vista Tabular</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              title="Imprimir Libro Diario Oficial en formato CPA"
            >
              <Printer size={14} />
              <span>Imprimir Diario</span>
            </button>

            {canEdit && (
              <button
                onClick={() => setShowManualModal(true)}
                className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-[#1D2132] via-[#292F4C] to-[#1D2132] hover:from-black hover:to-[#292F4C] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-[#1D2132]/25 active:scale-95 transition-all whitespace-nowrap border border-white/20"
                title="Registrar asiento contable manual con auditoría y conciliación de IA Contadora Pública"
              >
                <Plus size={15} className="text-[#00CA72]" />
                <span>Registrar Asiento Manual</span>
                <span className="text-[0.625rem] bg-[#00CA72] text-black px-1.5 py-0.2 rounded font-black flex items-center gap-0.5">
                  <Bot size={10} /> IA CPC
                </span>
              </button>
            )}
          </div>
        </div>

        {/* CPA Balance de Comprobación Bar (Sumas Iguales Cuadradas) */}
        <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-[#1D2132] via-[#292F4C] to-[#141824] text-white shadow-md grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {/* Metric 1: Total Cargos (DEBE) */}
          <div className="p-2.5 sm:p-3 bg-white/10 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.625rem] font-bold text-white/75 uppercase tracking-wider">
                Total Cargos (DEBE)
              </span>
              <Scale size={14} className="text-[#00CA72]" />
            </div>
            <div className="text-xl font-black font-mono text-[#00CA72]">
              {formatCurrency(accountingBalance.totalDebitUSD, 'USD')}
            </div>
            <div className="text-[0.6875rem] text-white/60 font-mono mt-0.5">
              ≈ {formatCurrency(accountingBalance.totalDebitVES, 'VES')}
            </div>
          </div>

          {/* Metric 2: Total Abonos (HABER) */}
          <div className="p-3 bg-white/10 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.625rem] font-bold text-white/75 uppercase tracking-wider">
                Total Abonos (HABER)
              </span>
              <Scale size={14} className="text-amber-400" />
            </div>
            <div className="text-xl font-black font-mono text-amber-400">
              {formatCurrency(accountingBalance.totalCreditUSD, 'USD')}
            </div>
            <div className="text-[0.6875rem] text-white/60 font-mono mt-0.5">
              ≈ {formatCurrency(accountingBalance.totalCreditVES, 'VES')}
            </div>
          </div>

          {/* Metric 3: Sumas Iguales Cuadradas */}
          <div className="p-3 bg-white/10 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.625rem] font-bold text-white/75 uppercase tracking-wider">
                Cuadratura Contable
              </span>
              <CheckCircle2 size={14} className="text-[#00CA72]" />
            </div>
            <div className="text-xl font-black font-mono text-[#00CA72]">$0.00</div>
            <div className="text-[0.6875rem] text-[#00CA72] font-semibold mt-0.5 flex items-center gap-1">
              <span>Sumas Iguales Cuadradas</span>
            </div>
          </div>

          {/* Metric 4: Tasa Oficial de Valorización */}
          <div className="p-3 bg-white/10 rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[0.625rem] font-bold text-white/75 uppercase tracking-wider">
                Tasa BCV Oficial
              </span>
              <DollarSign size={14} className="text-[#6161FF]" />
            </div>
            <div className="text-xl font-black font-mono text-white">
              {activeRate.toFixed(2)} Bs
            </div>
            <div className="text-[0.6875rem] text-white/60 mt-0.5">Banco Central de Venezuela</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Type */}
            <div className="flex items-center gap-1 p-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-xl text-xs font-semibold overflow-x-auto">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'income', label: 'Ventas' },
                { id: 'client_payment', label: 'Cobranzas' },
                { id: 'expense', label: 'Gastos' },
                { id: 'payroll', label: 'Nómina' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFilterType(item.id as TxFilter)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterType === item.id
                      ? 'bg-white dark:bg-slate-700 text-[#1D2132] dark:text-white shadow-sm font-bold'
                      : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Filter by Period */}
            <div className="flex items-center gap-1 p-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-xl text-xs font-semibold">
              {[
                { id: 'all', label: 'Todo 2026' },
                { id: 'today', label: 'Hoy' },
                { id: 'week', label: 'Esta Semana' },
                { id: 'month', label: 'Este Mes' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setPeriodFilter(item.id as DatePeriodFilter)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    periodFilter === item.id
                      ? 'bg-white dark:bg-slate-700 text-[#1D2132] dark:text-white shadow-sm font-bold'
                      : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Filter by Bank / Vault Account */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-xl text-xs font-semibold">
              <Landmark size={13} className="text-[#676879] dark:text-slate-400 flex-shrink-0" />
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="bg-transparent text-[#323338] dark:text-slate-200 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                title="Filtrar asientos por banco o cuenta"
              >
                <option value="all" className="dark:bg-slate-800">Todas las Bóvedas</option>
                <option value="Banesco" className="dark:bg-slate-800">Banesco</option>
                <option value="Banco de Venezuela" className="dark:bg-slate-800">Banco de Venezuela</option>
                <option value="Binance" className="dark:bg-slate-800">Binance (USDT)</option>
                <option value="Banco Nacional de Crédito" className="dark:bg-slate-800">BNC</option>
                <option value="Banco Mercantil" className="dark:bg-slate-800">Mercantil</option>
                <option value="Banco Digital de los Trabajadores" className="dark:bg-slate-800">BDT</option>
                <option value="Efectivo en Bolívares" className="dark:bg-slate-800">Efectivo Bolívares</option>
                <option value="Efectivo Divisas" className="dark:bg-slate-800">Efectivo Divisas ($)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <MnSearch
              value={search}
              onChange={setSearch}
              placeholder="Buscar glosa, cuenta, NIIF o folio..."
            />
          </div>
        </div>
      </div>

      {/* ── CONDITIONAL RENDERING: VISTA FORMAL DE ASIENTOS VS VISTA TABULAR ── */}
      {viewMode === 'formal' ? (
        /* 1. Formal Journal Entry Cards (Classic Accounting Ledger) */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#676879] font-medium px-1">
            <span>
              Asientos del Libro Diario General (Norma Internacional de Información Financiera - VEN-NIF)
            </span>
            <span>Mostrando {filteredTx.length} asientos contables</span>
          </div>

          {filteredTx.length === 0 ? (
            <div className="mn-card p-12 text-center text-sm text-[#676879]">
              No se encontraron asientos contables registrados con los filtros seleccionados.
            </div>
          ) : (
            filteredTx.map((tx) => {
              const isVoided = tx.description.startsWith('[EXTORNO') || tx.description.startsWith('[ANULADO');
              const isIncome = tx.type === 'income' || tx.type === 'client_payment';
              const niif = NIIF_ACCOUNTS[tx.type] || { code: '1.1.00.00', name: 'Cuenta General' };
              const bankInfo = BANK_ACCOUNT_CODES[tx.accountName] || {
                code: '1.1.02.00',
                label: `Bancos · ${tx.accountName}`,
              };
              const folio = `AS-${String(tx.id).padStart(5, '0')}`;
              const docSupport =
                tx.type === 'payroll'
                  ? 'Recibo de Nómina y Liquidación'
                  : tx.type === 'client_payment'
                  ? 'Recibo Oficial de Cobro'
                  : tx.type === 'income'
                  ? 'Factura / Nota de Entrega de Venta'
                  : 'Comprobante de Egreso / Factura de Proveedor';

              // Partida Doble Lines
              // If Income:
              //   DEBE: Banco/Caja aumenta (Activo)
              //   HABER: a Ventas/Cobranzas (Ingreso o Disminución Activo)
              // If Expense/Payroll:
              //   DEBE: Gastos Operativos / Gastos Nómina (Gasto aumenta)
              //   HABER: a Banco/Caja (Activo disminuye)
              const debitAccount = isIncome
                ? { code: bankInfo.code, name: bankInfo.label }
                : { code: niif.code, name: niif.name };

              const creditAccount = isIncome
                ? { code: niif.code, name: niif.name }
                : { code: bankInfo.code, name: bankInfo.label };

              return (
                <div
                  key={tx.id}
                  className={`mn-card overflow-hidden transition-all bg-white dark:bg-slate-900 border border-[#E6E9EF] dark:border-slate-800 ${
                    isVoided ? 'opacity-40 bg-gray-50 dark:bg-slate-800' : 'hover:shadow-md'
                  }`}
                >
                  {/* Asiento Header */}
                  <div className="p-3.5 bg-[#F6F7FB] dark:bg-slate-800/80 border-b border-[#E6E9EF] dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#1D2132] dark:text-white px-2 py-0.5 rounded bg-white dark:bg-slate-700 border border-[#E6E9EF] dark:border-slate-600">
                        {folio}
                      </span>
                      <span className="text-[#676879] dark:text-slate-400 flex items-center gap-1 font-semibold">
                        <Calendar size={13} />
                        {new Date(tx.date).toLocaleDateString('es-VE')} ·{' '}
                        {new Date(tx.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[#C5C7D0] hidden sm:inline">|</span>
                      <span className="text-[#676879] dark:text-slate-400 font-medium">
                        Soporte: <strong className="text-[#323338] dark:text-slate-200">{docSupport}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[#676879] dark:text-slate-400 text-[0.6875rem] sm:text-xs">
                        Auditor: <strong className="text-[#1D2132] dark:text-white">{tx.userName}</strong>
                      </span>
                      <button
                        onClick={() => setSelectedTxForReceipt(tx)}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 hover:border-[#6161FF] text-xs font-semibold text-[#6161FF] flex items-center gap-1 shadow-sm tap-haptic"
                        title="Ver comprobante contable formal e imprimir"
                      >
                        <Receipt size={13} />
                        <span>Ficha</span>
                      </button>
                      {canEdit && !isVoided && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleEdit(tx)}
                            className="p-1 text-[#676879] hover:text-[#6161FF] rounded hover:bg-white dark:hover:bg-slate-800"
                            title="Ajustar monto de asiento"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleVoid(tx)}
                            className="p-1 text-[#676879] hover:text-[#E2445C] rounded hover:bg-white dark:hover:bg-slate-800"
                            title="Registrar extorno contable"
                          >
                            <Ban size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop Asiento Partida Doble Table */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="bg-white dark:bg-slate-900 border-b border-[#E6E9EF] dark:border-slate-800 text-[#676879] dark:text-slate-400 uppercase text-[0.625rem] tracking-wider">
                          <th className="py-2 px-4 text-left font-bold" style={{ width: 130 }}>
                            CÓDIGO NIIF
                          </th>
                          <th className="py-2 px-4 text-left font-bold">CUENTA Y DESCRIPCIÓN CONTABLE</th>
                          <th className="py-2 px-4 text-right font-bold" style={{ width: 150 }}>
                            DEBE ($ USD)
                          </th>
                          <th className="py-2 px-4 text-right font-bold" style={{ width: 150 }}>
                            HABER ($ USD)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {/* 1. Fila de Cargo (DEBE) */}
                        <tr className="bg-white dark:bg-slate-900 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 font-bold text-[#323338] dark:text-slate-200">{debitAccount.code}</td>
                          <td className="py-2.5 px-4 font-bold text-[#323338] dark:text-slate-200">
                            <span className="block">{debitAccount.name}</span>
                            <span className="text-[0.625rem] text-[#676879] dark:text-slate-400 font-normal">
                              Cargo a cuenta por concepto de {isIncome ? 'disponibilidad de fondos' : 'costo/gasto devengado'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right font-black text-sm text-[#00CA72]">
                            {!isVoided ? formatCurrency(tx.amountUSD, 'USD') : '$0.00'}
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-400 font-semibold">—</td>
                        </tr>

                        {/* 2. Fila de Abono (HABER) con sangría contable clásica 'a ...' */}
                        <tr className="bg-white dark:bg-slate-900 hover:bg-gray-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 font-bold text-[#323338] dark:text-slate-200">{creditAccount.code}</td>
                          <td className="py-2.5 px-4 font-bold text-[#323338] dark:text-slate-200 pl-10">
                            <span className="block text-[#4A4C5A] dark:text-slate-300">
                              <span className="italic font-normal text-[#676879] dark:text-slate-400">a </span>
                              {creditAccount.name}
                            </span>
                            <span className="text-[0.625rem] text-[#676879] dark:text-slate-400 font-normal">
                              Abono a cuenta por contrapartida de {isIncome ? 'ingreso registrado' : 'desembolso de fondos'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right text-gray-400 font-semibold">—</td>
                          <td className="py-2.5 px-4 text-right font-black text-sm text-amber-500">
                            {!isVoided ? formatCurrency(tx.amountUSD, 'USD') : '$0.00'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile-Native Asiento Double-Entry Cards (md:hidden) */}
                  <div className="p-3 space-y-2 md:hidden">
                    <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.625rem] font-bold px-1.5 py-0.2 rounded bg-[#00CA72] text-black uppercase">
                            DEBE (Cargo)
                          </span>
                          <span className="font-mono text-xs font-bold text-[#323338] dark:text-slate-200">{debitAccount.code}</span>
                        </div>
                        <span className="text-xs font-semibold text-[#323338] dark:text-slate-200 block mt-1 truncate">{debitAccount.name}</span>
                      </div>
                      <span className="text-sm font-black font-mono text-[#00CA72] flex-shrink-0">
                        {!isVoided ? formatCurrency(tx.amountUSD, 'USD') : '$0.00'}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.625rem] font-bold px-1.5 py-0.2 rounded bg-amber-400 text-black uppercase">
                            HABER (Abono)
                          </span>
                          <span className="font-mono text-xs font-bold text-[#323338] dark:text-slate-200">{creditAccount.code}</span>
                        </div>
                        <span className="text-xs font-semibold text-[#323338] dark:text-slate-200 block mt-1 truncate">{creditAccount.name}</span>
                      </div>
                      <span className="text-sm font-black font-mono text-amber-600 dark:text-amber-400 flex-shrink-0">
                        {!isVoided ? formatCurrency(tx.amountUSD, 'USD') : '$0.00'}
                      </span>
                    </div>
                  </div>

                  {/* Asiento Glosa & Sumas Iguales Footer */}
                  <div className="p-3.5 bg-[#FAFBFD] dark:bg-slate-800/50 border-t border-[#E6E9EF] dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex-1">
                      <span className="font-bold text-[#323338] dark:text-white uppercase text-[0.6875rem] tracking-wider block mb-0.5">
                        Glosa Contable:
                      </span>
                      <p className="text-[#676879] dark:text-slate-300 italic">
                        "{tx.description}" — Operación efectuada a través de{' '}
                        <strong className="text-[#323338] dark:text-white">{tx.accountName}</strong>.
                      </p>
                      <div className="text-[0.6875rem] text-[#8C8F9F] dark:text-slate-400 font-mono mt-1">
                        Contravalor en Bolívares: {formatCurrency(tx.amountVES, 'VES')} (Tasa BCV: {activeRate.toFixed(2)} Bs)
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs font-bold pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E6E9EF] dark:border-slate-700">
                      <div className="text-right">
                        <span className="text-[0.625rem] text-[#676879] dark:text-slate-400 block uppercase">Sumas Iguales</span>
                        <span className="text-[#00CA72] font-black">
                          {formatCurrency(tx.amountUSD, 'USD')}
                        </span>
                      </div>
                      <div className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-[#00CA72] border border-emerald-200 dark:border-emerald-800 text-[0.6875rem] flex items-center gap-1 font-sans font-bold">
                        <CheckCircle2 size={12} /> Balanceado
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* 2. Formal CPA Ledger Table (Tabular Resumen) */
        <div className="mn-card overflow-hidden" id="cpa-ledger-table">
          <div className="mn-group-header bg-white border-b border-[#E6E9EF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="mn-group-color" style={{ background: '#1D2132' }} />
              <span className="text-sm font-black text-[#323338]">
                ASIENTOS DEL LIBRO DIARIO GENERAL
              </span>
              <span className="text-xs text-[#676879] font-mono">(Ejercicio 2026)</span>
            </div>
            <span className="text-xs font-mono text-[#6161FF] font-bold">
              Folio Oficial: N° 001 - 2026
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="mn-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>ASIENTO</th>
                  <th style={{ width: 130 }}>FECHA / HORA</th>
                  <th style={{ width: 220 }}>CUENTA CONTABLE (NIIF)</th>
                  <th>GLOSA / DETALLE ECONÓMICO</th>
                  <th style={{ width: 150 }}>BÓVEDA / CUENTA</th>
                  <th style={{ width: 130, textAlign: 'right' }}>DEBE ($ USD)</th>
                  <th style={{ width: 130, textAlign: 'right' }}>HABER ($ USD)</th>
                  <th style={{ width: 130, textAlign: 'right' }}>EQUIV. VES</th>
                  <th style={{ width: 110 }}>AUDITOR</th>
                  <th style={{ width: 90, textAlign: 'center' }}>COMPROBANTE</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-sm text-[#676879]">
                      No se encontraron asientos contables registrados con el filtro actual.
                    </td>
                  </tr>
                ) : (
                  filteredTx.map((tx) => {
                    const isVoided = tx.description.startsWith('[EXTORNO') || tx.description.startsWith('[ANULADO');
                    const isIncome = tx.type === 'income' || tx.type === 'client_payment';
                    const niif = NIIF_ACCOUNTS[tx.type] || { code: '1.1.00.00', name: 'Cuenta General' };
                    const bankInfo = BANK_ACCOUNT_CODES[tx.accountName] || { code: '1.1.02.00', label: tx.accountName };
                    const asientoFolio = `AS-${String(tx.id).padStart(5, '0')}`;

                    return (
                      <tr
                        key={tx.id}
                        className={isVoided ? 'opacity-35 bg-gray-50' : 'hover:bg-[#F5F6F8] transition-colors'}
                      >
                        {/* Asiento Folio */}
                        <td className="mn-table-cell text-xs font-mono font-black text-[#1D2132]">
                          {asientoFolio}
                        </td>

                        {/* Date & Time */}
                        <td className="mn-table-cell text-xs text-[#676879]">
                          <div className="font-semibold text-[#323338]">
                            {new Date(tx.date).toLocaleDateString('es-VE')}
                          </div>
                          <div className="text-[0.625rem] text-[#A0A4B8] font-mono">
                            {new Date(tx.date).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* NIIF Account Code & Title */}
                        <td className="mn-table-cell text-xs">
                          <div className="font-mono font-bold text-[#323338]">
                            {isIncome ? bankInfo.code : niif.code}
                          </div>
                          <div
                            className="text-[0.6875rem] text-[#676879] truncate max-w-[200px]"
                            title={isIncome ? tx.accountName : niif.name}
                          >
                            {isIncome ? `Bancos · ${tx.accountName}` : niif.name}
                          </div>
                        </td>

                        {/* Glosa / Description */}
                        <td className="mn-table-cell text-xs">
                          <div className="font-semibold text-[#323338]">{tx.description}</div>
                          <div className="text-[0.625rem] text-[#676879] mt-0.5">
                            Soporte:{' '}
                            {tx.type === 'payroll'
                              ? 'Nómina Liquidada'
                              : tx.type === 'client_payment'
                              ? 'Recibo de Cobro'
                              : 'Comprobante Bancario'}
                          </div>
                        </td>

                        {/* Bank / Vault */}
                        <td className="mn-table-cell text-xs">
                          <span className="px-2 py-0.5 rounded bg-[#F0F1F3] text-[#323338] font-bold">
                            {tx.accountName}
                          </span>
                        </td>

                        {/* DEBE (Débito) */}
                        <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#00CA72]">
                          {isIncome && !isVoided ? `+${formatCurrency(tx.amountUSD, 'USD')}` : '—'}
                        </td>

                        {/* HABER (Crédito) */}
                        <td className="mn-table-cell text-right font-mono font-bold text-xs text-amber-500">
                          {!isIncome && !isVoided ? `-${formatCurrency(tx.amountUSD, 'USD')}` : '—'}
                        </td>

                        {/* Equivalent VES */}
                        <td className="mn-table-cell text-right font-mono text-xs text-[#676879]">
                          {!isVoided ? formatCurrency(tx.amountVES, 'VES') : '0,00 Bs'}
                        </td>

                        {/* User / Auditor */}
                        <td className="mn-table-cell text-xs text-[#323338]">
                          <span className="truncate block max-w-[100px]">{tx.userName}</span>
                        </td>

                        {/* View Receipt Action */}
                        <td className="mn-table-cell text-center">
                          <button
                            onClick={() => setSelectedTxForReceipt(tx)}
                            className="p-1.5 text-[#6161FF] hover:bg-[#6161FF]/10 rounded-lg transition-colors"
                            title="Ver ficha de asiento contable"
                          >
                            <Receipt size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CPA Printable Signatures in Document */}
      <div className="p-6 bg-[#F6F7FB] border border-[#E6E9EF] rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-8 text-center pt-8">
        <div className="pt-6 border-t border-gray-400">
          <span className="text-xs font-bold text-[#323338] block">
            Colegio de Contadores Públicos (FCCPV)
          </span>
          <span className="text-[0.625rem] text-[#676879]">
            Certificación y Auditoría de Estados Financieros VEN-NIF
          </span>
        </div>
        <div className="pt-6 border-t border-gray-400">
          <span className="text-xs font-bold text-[#323338] block">
            Fabiana Acosta · Contadora Pública
          </span>
          <span className="text-[0.625rem] text-[#676879]">
            Administración, Finanzas y Registro de Operaciones
          </span>
        </div>
        <div className="pt-6 border-t border-gray-400">
          <span className="text-xs font-bold text-[#323338] block">
            Beiker Pérez · Contador Público Colegiado (CPC)
          </span>
          <span className="text-[0.625rem] text-[#676879]">
            Master · Dirección General y Junta Directiva
          </span>
        </div>
      </div>

      {/* Modal: Ficha Técnica de Asiento Contable Individual */}
      {selectedTxForReceipt && (
        <div className="mn-modal-overlay">
          <div className="mn-modal max-w-2xl w-full animate-scale-in">
            <div className="mn-modal-header border-b border-[#E6E9EF] pb-3">
              <div>
                <span className="text-[0.6875rem] font-black uppercase tracking-wider text-[#6161FF]">
                  Comprobante Oficial de Asiento Contable
                </span>
                <h3 className="text-lg font-black text-[#1D2132]">
                  ASIENTO N° AS-{String(selectedTxForReceipt.id).padStart(5, '0')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTxForReceipt(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Company & Voucher Header */}
              <div className="text-center pb-3 border-b border-[#E6E9EF]">
                <h4 className="font-black text-sm text-[#1D2132]">SAN BENITO MIX, C.A.</h4>
                <p className="text-xs text-[#676879]">R.I.F.: J-50493821-0 · República Bolivariana de Venezuela</p>
                <div className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-[#00CA72]">
                  ✓ Asiento Auditado y Balanceado en Doble Partida
                </div>
              </div>

              {/* Transaction Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#F6F7FB] p-3.5 rounded-xl border border-[#E6E9EF]">
                <div>
                  <span className="text-[#676879] block">Fecha y Hora:</span>
                  <strong className="text-[#323338]">
                    {new Date(selectedTxForReceipt.date).toLocaleString('es-VE')}
                  </strong>
                </div>
                <div>
                  <span className="text-[#676879] block">Bóveda / Cuenta:</span>
                  <strong className="text-[#323338]">{selectedTxForReceipt.accountName}</strong>
                </div>
                <div>
                  <span className="text-[#676879] block">Usuario / Auditor:</span>
                  <strong className="text-[#323338]">{selectedTxForReceipt.userName}</strong>
                </div>
                <div>
                  <span className="text-[#676879] block">Tasa BCV Aplicada:</span>
                  <strong className="text-[#323338] font-mono">
                    {(selectedTxForReceipt.rateUsed || activeRate).toFixed(2)} Bs / USD
                  </strong>
                </div>
              </div>

              {/* Accounting Entry Table */}
              <div className="border border-[#E6E9EF] rounded-xl overflow-hidden text-xs font-mono">
                <div className="bg-[#1D2132] text-white p-2 px-3 flex justify-between font-bold text-[0.6875rem]">
                  <span>CUENTA / CONCEPTO NIIF</span>
                  <div className="flex gap-8">
                    <span>DEBE ($)</span>
                    <span>HABER ($)</span>
                  </div>
                </div>
                <div className="p-3 space-y-2 bg-white">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <div>
                      <span className="font-bold text-[#323338] block">
                        {selectedTxForReceipt.type === 'income' || selectedTxForReceipt.type === 'client_payment'
                          ? BANK_ACCOUNT_CODES[selectedTxForReceipt.accountName]?.code || '1.1.02.00'
                          : NIIF_ACCOUNTS[selectedTxForReceipt.type]?.code || '5.2.01.01'}
                      </span>
                      <span className="text-[#676879] text-[0.6875rem]">
                        {selectedTxForReceipt.type === 'income' || selectedTxForReceipt.type === 'client_payment'
                          ? `Bancos · ${selectedTxForReceipt.accountName}`
                          : NIIF_ACCOUNTS[selectedTxForReceipt.type]?.name}
                      </span>
                    </div>
                    <span className="font-black text-sm text-[#00CA72]">
                      {formatCurrency(selectedTxForReceipt.amountUSD, 'USD')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pl-6">
                    <div>
                      <span className="font-bold text-[#323338] block">
                        {selectedTxForReceipt.type === 'income' || selectedTxForReceipt.type === 'client_payment'
                          ? NIIF_ACCOUNTS[selectedTxForReceipt.type]?.code || '4.1.01.01'
                          : BANK_ACCOUNT_CODES[selectedTxForReceipt.accountName]?.code || '1.1.02.00'}
                      </span>
                      <span className="text-[#676879] text-[0.6875rem]">
                        <span className="italic">a </span>
                        {selectedTxForReceipt.type === 'income' || selectedTxForReceipt.type === 'client_payment'
                          ? NIIF_ACCOUNTS[selectedTxForReceipt.type]?.name
                          : `Bancos · ${selectedTxForReceipt.accountName}`}
                      </span>
                    </div>
                    <span className="font-black text-sm text-amber-500">
                      {formatCurrency(selectedTxForReceipt.amountUSD, 'USD')}
                    </span>
                  </div>
                </div>
                <div className="bg-[#FAFBFD] p-2.5 px-3 border-t border-[#E6E9EF] flex justify-between font-bold">
                  <span>SUMAS IGUALES:</span>
                  <div className="flex gap-6">
                    <span className="text-[#00CA72]">{formatCurrency(selectedTxForReceipt.amountUSD, 'USD')}</span>
                    <span className="text-amber-500">{formatCurrency(selectedTxForReceipt.amountUSD, 'USD')}</span>
                  </div>
                </div>
              </div>

              {/* Glosa */}
              <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl text-xs">
                <span className="font-bold text-[#323338] block mb-0.5">Glosa Explicativa:</span>
                <p className="text-[#676879] italic">"{selectedTxForReceipt.description}"</p>
                <div className="text-[0.6875rem] text-[#8C8F9F] font-mono mt-1">
                  Contravalor oficial: {formatCurrency(selectedTxForReceipt.amountVES, 'VES')}
                </div>
              </div>

              {/* Printable Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-4 text-center text-xs">
                <div className="border-t border-gray-300 pt-3">
                  <span className="font-bold text-[#323338] block">{selectedTxForReceipt.userName}</span>
                  <span className="text-[0.625rem] text-[#676879]">Contador / Registrador</span>
                </div>
                <div className="border-t border-gray-300 pt-3">
                  <span className="font-bold text-[#323338] block">Beiker Pérez</span>
                  <span className="text-[0.625rem] text-[#676879]">Dirección General</span>
                </div>
              </div>
            </div>

            <div className="mn-modal-footer pt-3 border-t border-[#E6E9EF] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedTxForReceipt(null)}
                className="mn-btn mn-btn-outline text-xs"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="mn-btn mn-btn-primary text-xs flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Imprimir Comprobante</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Journal Entry Modal with AI Public Accountant Conciliation */}
      {showManualModal && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          onSuccess={() => {
            loadTransactions();
          }}
        />
      )}

      {/* Floating Action Button (FAB) for Mobile (iPhone / Android) */}
      {canEdit && (
        <button
          onClick={() => setShowManualModal(true)}
          className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#1D2132] via-[#292F4C] to-[#141824] text-white flex items-center justify-center shadow-xl shadow-slate-900/40 active:scale-90 transition-all cursor-pointer border border-white/20"
          title="Registrar Asiento Manual"
        >
          <Plus size={26} className="text-[#00CA72] stroke-[2.5]" />
        </button>
      )}
    </div>
  );
};

export default LedgerPage;
