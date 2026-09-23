import React, { useState, useEffect } from 'react';
import { db, type Account, enforceOfficialAccounts } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { usePermission } from '../../auth/auth-store';
import { TransactionSheet } from './transaction-sheet';
import {
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Landmark,
  TrendingUp,
  DollarSign,
  ArrowDownUp,
  Receipt,
  LayoutGrid,
  TableProperties,
  Percent,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

import { BankLogo } from '../../components/bank-logos';
import { CashClosureModal } from './cash-closure-modal';

const CARD_GRADIENTS: Record<string, string> = {
  'Banesco': 'linear-gradient(135deg, #007953 0%, #004D34 100%)',
  'Banco de Venezuela': 'linear-gradient(135deg, #002855 0%, #00152B 100%)',
  'Binance': 'linear-gradient(135deg, #2B2F36 0%, #181A20 100%)',
  'Banco Nacional de Crédito': 'linear-gradient(135deg, #005C42 0%, #003324 100%)',
  'Banco Mercantil': 'linear-gradient(135deg, #002868 0%, #00153B 100%)',
  'Banco Digital de los Trabajadores': 'linear-gradient(135deg, #14213D 0%, #0B132B 100%)',
  'Efectivo en Bolívares': 'linear-gradient(135deg, #0F4C3A 0%, #092B21 100%)',
  'Efectivo Divisas': 'linear-gradient(135deg, #064E3B 0%, #02261C 100%)',
  // Legacy aliases
  'Binance Pay': 'linear-gradient(135deg, #2B2F36 0%, #181A20 100%)',
  'Caja Chica Divisas': 'linear-gradient(135deg, #064E3B 0%, #02261C 100%)',
  'BNC / Mercantil': 'linear-gradient(135deg, #005C42 0%, #003324 100%)',
};

export const VaultPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showBalances, setShowBalances] = useState(true);
  const [showTransaction, setShowTransaction] = useState(false);
  const [showClosure, setShowClosure] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('cards');

  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const canViewWallet = usePermission('viewWallet');

  useEffect(() => {
    loadAccounts();

    const handleSync = () => {
      loadAccounts();
    };
    window.addEventListener('sbm:sync', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
    };
  }, []);

  const loadAccounts = async () => {
    let items = await db.accounts.orderBy('order').toArray();
    if (items.length === 0) {
      await enforceOfficialAccounts();
      items = await db.accounts.orderBy('order').toArray();
    }
    setAccounts(items);
  };

  const totalUSD = accounts.reduce((sum, acc) => {
    if (acc.currency === 'USD' || acc.currency === 'USDT') return sum + acc.balance;
    if (acc.currency === 'VES' && activeRate > 0) return sum + acc.balance / activeRate;
    return sum;
  }, 0);

  const totalVES = totalUSD * activeRate;

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleNewTransaction = (account?: Account) => {
    setSelectedAccount(account || accounts[0] || null);
    setShowTransaction(true);
  };

  if (!canViewWallet) {
    return (
      <div className="flex items-center justify-center py-20 animate-fade-in">
        <div className="mn-card p-8 text-center max-w-sm">
          <EyeOff size={44} className="text-[#676879] mx-auto mb-3 opacity-60" />
          <h3 className="font-bold text-base text-[#323338] mb-1">Acceso Restringido</h3>
          <p className="text-xs text-[#676879]">
            Tu usuario no tiene permisos configurados para consultar los balances de la Bóveda.
            Solicita autorización al usuario Master.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Stat Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Stat 1: Total USD */}
        <div className="mn-card p-4 sm:p-5 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#676879] dark:text-slate-400 uppercase tracking-wider">
              Patrimonio Total en Bóvedas
            </span>
            <button
              onClick={() => setShowBalances(!showBalances)}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#676879] dark:text-slate-400 tap-haptic transition-colors cursor-pointer"
              title={showBalances ? 'Ocultar saldos' : 'Mostrar saldos'}
            >
              {showBalances ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#323338] dark:text-white tracking-tight font-mono">
            {showBalances ? formatCurrency(totalUSD, 'USD') : '••••••••'}
          </div>
          <div className="text-xs font-semibold text-[#00CA72] mt-1 flex items-center gap-1">
            <TrendingUp size={13} />
            <span>Valor Consolidado en Dólares ($ USD)</span>
          </div>
        </div>

        {/* Stat 2: Total VES */}
        <div className="mn-card p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#676879] dark:text-slate-400 uppercase tracking-wider">
              Contravalor en Bolívares
            </span>
            <DollarSign size={16} className="text-[#6161FF]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#323338] dark:text-white tracking-tight font-mono">
            {showBalances ? formatCurrency(totalVES, 'VES') : '••••••••'}
          </div>
          <div className="text-xs text-[#676879] dark:text-slate-400 font-medium mt-1">
            A tasa activa oficial ({activeRate.toFixed(2)} Bs / USD)
          </div>
        </div>

        {/* Action Button Card */}
        <div className="mn-card p-4 sm:p-5 flex flex-col justify-between bg-gradient-to-br from-[#6161FF]/5 to-[#A25DDC]/5 dark:from-[#6161FF]/10 dark:to-[#A25DDC]/10 border border-[#6161FF]/20 dark:border-[#6161FF]/30">
          <div>
            <span className="text-xs font-bold text-[#6161FF] uppercase tracking-wider block mb-1">
              Operaciones y Conciliación
            </span>
            <p className="text-xs text-[#676879] dark:text-slate-400">
              Registra movimientos bancarios o concilia el arqueo y Cierre Z.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => handleNewTransaction()}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-[#6161FF]/20 tap-haptic transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Registrar Asiento</span>
            </button>
            <button
              onClick={() => setShowClosure(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#1D2132] to-[#292F4C] hover:from-black hover:to-[#1D2132] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm tap-haptic transition-all cursor-pointer"
              title="Conciliar las 8 cuentas y emitir Cierre Z de la jornada"
            >
              <Receipt size={14} className="text-amber-400" />
              <span>Cierre Z Diario</span>
            </button>
          </div>
        </div>
      </div>

      {/* Accounts Title Bar & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Landmark size={22} className="text-[#6161FF]" />
          <div>
            <h2 className="text-base font-black text-[#323338] dark:text-white">Cuentas Financieras y Bóvedas</h2>
            <p className="text-xs text-[#676879] dark:text-slate-400">
              Cada cuenta muestra de forma prioritaria su <strong>valor equivalente en dólares ($ USD)</strong> y su moneda origen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle between Card View and Matrix View */}
          <div className="flex items-center p-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-[#1D2132] dark:text-white shadow-sm'
                  : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
              }`}
              title="Vista en tarjetas de bóveda individuales"
            >
              <LayoutGrid size={14} />
              <span>Tarjetas Ejecutivas</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'matrix'
                  ? 'bg-white dark:bg-slate-700 text-[#1D2132] dark:text-white shadow-sm'
                  : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
              }`}
              title="Vista en matriz financiera comparativa de cuentas"
            >
              <TableProperties size={14} />
              <span>Matriz Bimonetaria</span>
            </button>
          </div>

          <span className="text-xs text-[#676879] dark:text-slate-300 font-medium bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-[#E6E9EF] dark:border-slate-700">
            {accounts.length} Bóvedas Activas
          </span>
        </div>
      </div>

      {/* ── 1. VISTA DE TARJETAS EJECUTIVAS ── */}
      {viewMode === 'cards' ? (
        <div className="wallet-stack">
          {accounts.map((account) => {
            const isExpanded = expandedId === account.id;
            const gradient =
              CARD_GRADIENTS[account.bankName] || 'linear-gradient(135deg, #292F4C 0%, #1A1D2E 100%)';

            let balanceInUSD = 0;
            let contravalorVES = '';

            if (account.currency === 'VES') {
              balanceInUSD = activeRate > 0 ? account.balance / activeRate : 0;
              contravalorVES = formatCurrency(account.balance, 'VES');
            } else {
              balanceInUSD = account.balance;
              contravalorVES = formatCurrency(account.balance * activeRate, 'VES');
            }

            const percentOfTotal = totalUSD > 0 ? ((balanceInUSD / totalUSD) * 100).toFixed(1) : '0.0';

            return (
              <div
                key={account.id}
                className={`wallet-card ${isExpanded ? 'expanded' : ''}`}
                style={{ background: gradient }}
                onClick={() => toggleExpand(account.id!)}
              >
                {/* Card Header */}
                <div className="flex flex-col xs:flex-row xs:items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <BankLogo name={account.bankName} size={40} className="ring-1 ring-white/30 shadow-lg flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-white font-bold text-sm sm:text-base tracking-tight block truncate">
                        {account.bankName}
                      </span>
                      <span className="text-white/80 text-xs font-medium flex items-center gap-1.5 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-white/20 text-[0.625rem] font-bold">
                          {account.currency}
                        </span>
                        <span className="truncate">{account.accountType}</span>
                      </span>
                    </div>
                  </div>

                  {/* Prominent Dollar Value Display on Every Account */}
                  <div className="text-left xs:text-right">
                    <div className="flex items-center xs:justify-end gap-1.5">
                      <span className="text-[0.625rem] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-400 text-black shadow-sm">
                        $ USD
                      </span>
                      <span className="text-white text-xl sm:text-2xl lg:text-3xl font-black font-mono tracking-tight">
                        {showBalances ? formatCurrency(balanceInUSD, 'USD') : '••••••••'}
                      </span>
                    </div>

                    {showBalances && (
                      <div className="text-white/85 text-[0.6875rem] sm:text-xs font-semibold mt-0.5 font-mono">
                        {account.currency === 'VES' ? (
                          <span>Saldo en Bs: {formatCurrency(account.balance, 'VES')}</span>
                        ) : (
                          <span>Equiv. Bs: ≈ {contravalorVES}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Prominent Dollar Equivalent Bar on Every Single Account */}
                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs text-white/95">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[0.6875rem] uppercase text-white/80 font-bold">
                      Valor en Dólares:
                    </span>
                    <span className="font-mono text-white font-black bg-black/30 px-2.5 py-0.5 rounded-md border border-white/15 text-sm">
                      {showBalances ? formatCurrency(balanceInUSD, 'USD') : '••••••••'}
                    </span>
                  </div>

                  <div className="text-right font-mono text-[0.6875rem] text-white/80">
                    <span>{percentOfTotal}% del Total</span>
                  </div>
                </div>

                {/* Action Trigger in Expanded State */}
                {isExpanded ? (
                  <div className="flex gap-2.5 mt-4 pt-3 border-t border-white/20 animate-fade-in">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNewTransaction(account);
                      }}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-white/25 hover:bg-white/35 backdrop-blur-md flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Plus size={14} />
                      <span>Registrar Asiento</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNewTransaction(account);
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all"
                      title="Detalles y transferencia"
                    >
                      <ArrowDownUp size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 text-[0.6875rem] text-white/70">
                    <span>Toca para registrar asiento en esta cuenta</span>
                    <ChevronDown size={14} className="text-white/60" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── 2. VISTA DE MATRIZ BIMONETARIA CONSOLIDADA ── */
        <div className="mn-card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="mn-group-header bg-white dark:bg-slate-900 border-b border-[#E6E9EF] dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="mn-group-color" style={{ background: '#6161FF' }} />
              <span className="text-sm font-black text-[#323338] dark:text-white">
                MATRIZ FINANCIERA CONSOLIDADA — CUENTAS EN DÓLARES ($) Y BOLÍVARES (Bs)
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-[#6161FF] bg-[#6161FF]/10 px-2.5 py-1 rounded-lg">
              Tasa Oficial: {activeRate.toFixed(2)} Bs / USD
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="mn-table">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th style={{ width: 60 }}>LOGO</th>
                  <th>ENTIDAD FINANCIERA / BÓVEDA</th>
                  <th style={{ width: 140 }}>TIPO DE CUENTA</th>
                  <th style={{ width: 150, textAlign: 'right' }}>SALDO NATIVO</th>
                  <th style={{ width: 170, textAlign: 'right' }}>
                    <span className="text-[#00CA72] font-black">VALOR EN DÓLARES ($ USD)</span>
                  </th>
                  <th style={{ width: 170, textAlign: 'right' }}>CONTRAVALOR BS</th>
                  <th style={{ width: 100, textAlign: 'center' }}>% TOTAL</th>
                  <th style={{ width: 90, textAlign: 'center' }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => {
                  let balanceUSD = 0;
                  let balanceVES = 0;

                  if (acc.currency === 'VES') {
                    balanceUSD = activeRate > 0 ? acc.balance / activeRate : 0;
                    balanceVES = acc.balance;
                  } else {
                    balanceUSD = acc.balance;
                    balanceVES = acc.balance * activeRate;
                  }

                  const percentOfTotal =
                    totalUSD > 0 ? ((balanceUSD / totalUSD) * 100).toFixed(1) : '0.0';

                  return (
                    <tr
                      key={acc.id}
                      onClick={() => handleNewTransaction(acc)}
                      className="cursor-pointer hover:bg-[#F5F6F8] dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <td className="mn-table-cell text-center">
                        <BankLogo name={acc.bankName} size={32} className="mx-auto" />
                      </td>
                      <td className="mn-table-cell">
                        <div className="font-bold text-xs text-[#323338] dark:text-slate-200">{acc.bankName}</div>
                        <div className="text-[0.6875rem] text-[#676879] dark:text-slate-400">
                          Moneda: <strong className="text-[#323338] dark:text-slate-200">{acc.currency}</strong>
                        </div>
                      </td>
                      <td className="mn-table-cell text-xs text-[#676879] dark:text-slate-400">{acc.accountType}</td>

                      {/* Saldo Nativo */}
                      <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#323338] dark:text-slate-200">
                        {showBalances ? formatCurrency(acc.balance, acc.currency === 'VES' ? 'VES' : 'USD') : '••••••••'}
                      </td>

                      {/* VALOR EN DÓLARES DESTACADO */}
                      <td className="mn-table-cell text-right font-mono font-black text-sm text-[#00CA72] bg-emerald-50/40 dark:bg-emerald-950/20">
                        {showBalances ? formatCurrency(balanceUSD, 'USD') : '••••••••'}
                      </td>

                      {/* Contravalor en Bolívares */}
                      <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#676879] dark:text-slate-400">
                        {showBalances ? formatCurrency(balanceVES, 'VES') : '••••••••'}
                      </td>

                      {/* Participación % */}
                      <td className="mn-table-cell text-center font-mono text-xs font-bold text-[#6161FF]">
                        {percentOfTotal}%
                      </td>

                      {/* Acción */}
                      <td className="mn-table-cell text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNewTransaction(acc);
                          }}
                          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#6161FF]"
                          title="Registrar asiento en esta cuenta"
                        >
                          <Plus size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#1D2132] text-white font-mono font-bold text-xs">
                  <td colSpan={3} className="py-3 px-4 font-black">
                    TOTAL GENERAL EN BÓVEDAS (8 CUENTAS CONSOLIDADAS)
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">—</td>
                  <td className="py-3 px-4 text-right font-black text-base text-[#00CA72]">
                    {showBalances ? formatCurrency(totalUSD, 'USD') : '••••••••'}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-xs text-white">
                    {showBalances ? formatCurrency(totalVES, 'VES') : '••••••••'}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-400">100%</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Modal Sheet */}
      {showTransaction && selectedAccount && (
        <TransactionSheet
          account={selectedAccount}
          accounts={accounts}
          onClose={() => {
            setShowTransaction(false);
            loadAccounts();
          }}
        />
      )}

      {/* Cash Closure Z Modal */}
      {showClosure && (
        <CashClosureModal
          accounts={accounts}
          onClose={() => setShowClosure(false)}
          onSuccess={() => {
            loadAccounts();
          }}
        />
      )}

      {/* Floating Action Button (FAB) for Mobile (iPhone / Android) */}
      <button
        onClick={() => handleNewTransaction()}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6161FF] via-[#7B51EC] to-[#9A42E4] text-white flex items-center justify-center shadow-xl shadow-indigo-500/40 active:scale-90 transition-all cursor-pointer border border-white/20"
        title="Registrar Nuevo Asiento Bancario"
      >
        <Plus size={26} className="stroke-[2.5]" />
      </button>
    </div>
  );
};

export default VaultPage;
