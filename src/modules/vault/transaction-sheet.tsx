import React, { useState, useMemo } from 'react';
import { db, type Account, type Transaction, addWithSync, updateWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { useAuthStore, usePermission } from '../../auth/auth-store';
import type { TransactionType, RateSource } from '../../db/database';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  Wallet,
  X,
  Plus,
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileText,
  Building2,
  Check,
  Landmark,
  ArrowRight,
  ArrowLeftRight,
  ShieldCheck,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { BankLogo } from '../../components/bank-logos';

interface TransactionSheetProps {
  account: Account;
  accounts: Account[];
  onClose: () => void;
}

type TxMode = 'income' | 'expense' | 'payroll' | 'transfer';

export const TransactionSheet: React.FC<TransactionSheetProps> = ({
  account,
  accounts,
  onClose,
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const canPayroll = usePermission('registerPayroll');
  const { getActiveRate, activeSource } = useExchangeRateStore();
  const activeRate = getActiveRate();

  const [mode, setMode] = useState<TxMode>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [description, setDescription] = useState('');
  const [targetAccountId, setTargetAccountId] = useState(account.id!);
  const [destAccountId, setDestAccountId] = useState<number>(() => {
    const other = accounts.find((a) => a.id !== (account.id || 1));
    return other?.id || (account.id === 1 ? 2 : 1);
  });
  const [payrollRecipient, setPayrollRecipient] = useState('');

  const targetAccount = accounts.find((a) => a.id === targetAccountId) || account;
  const destAccount = accounts.find((a) => a.id === destAccountId) || (accounts.find((a) => a.id !== targetAccount.id) || targetAccount);
  const numAmount = parseFloat(amountStr) || 0;

  // Real-time transfer conversion calculations
  const transferCalc = useMemo(() => {
    if (mode !== 'transfer') return { destAmount: 0, destCurrency: '' };
    const srcCurr = targetAccount.currency;
    const destCurr = destAccount.currency;
    let destAmount = numAmount;
    if (srcCurr === destCurr) {
      destAmount = numAmount;
    } else if (srcCurr === 'VES' && (destCurr === 'USD' || destCurr === 'USDT')) {
      destAmount = activeRate > 0 ? Number((numAmount / activeRate).toFixed(2)) : 0;
    } else if ((srcCurr === 'USD' || srcCurr === 'USDT') && destCurr === 'VES') {
      destAmount = Number((numAmount * activeRate).toFixed(2));
    }
    return { destAmount, destCurrency: destCurr };
  }, [mode, numAmount, targetAccount.currency, destAccount.currency, activeRate]);

  // Real-time conversion calculations
  const conversions = useMemo(() => {
    let amountUSD = 0;
    let amountVES = 0;

    if (targetAccount.currency === 'USD' || targetAccount.currency === 'USDT') {
      amountUSD = numAmount;
      amountVES = numAmount * activeRate;
    } else {
      amountVES = numAmount;
      amountUSD = activeRate > 0 ? numAmount / activeRate : 0;
    }

    return { amountUSD, amountVES };
  }, [numAmount, targetAccount.currency, activeRate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) return;

    let finalDesc = description.trim();
    if (!finalDesc) {
      if (mode === 'income') finalDesc = `Ingreso a ${targetAccount.bankName}`;
      else if (mode === 'payroll') finalDesc = `Pago de Nómina: ${payrollRecipient.trim() || 'Personal'}`;
      else finalDesc = `Gasto / Egreso de ${targetAccount.bankName}`;
    }

    // Transfer Mode Handler
    if (mode === 'transfer') {
      if (targetAccount.id === destAccount.id) {
        alert('Por favor selecciona una cuenta de destino diferente a la de origen.');
        return;
      }
      const destAmount = transferCalc.destAmount;
      const transferDesc = description.trim() || `Traspaso de fondos: ${targetAccount.bankName} ➔ ${destAccount.bankName}`;

      // 1. Transaction Outflow (Source Account)
      await addWithSync(db.transactions, 'transactions', {
        type: 'expense',
        amount: numAmount,
        currency: targetAccount.currency,
        accountId: targetAccount.id!,
        accountName: targetAccount.bankName,
        description: `[TRANSFERENCIA SALIENTE] A ${destAccount.bankName} — ${transferDesc}`,
        userId: currentUser?.id || 1,
        userName: currentUser?.name || 'Administrador',
        date: Date.now(),
        rateUsed: activeRate,
        rateSource: activeSource,
        amountUSD: conversions.amountUSD,
        amountVES: conversions.amountVES,
      });

      // 2. Transaction Inflow (Destination Account)
      await addWithSync(db.transactions, 'transactions', {
        type: 'income',
        amount: destAmount,
        currency: destAccount.currency,
        accountId: destAccount.id!,
        accountName: destAccount.bankName,
        description: `[TRANSFERENCIA ENTRANTE] Desde ${targetAccount.bankName} — ${transferDesc}`,
        userId: currentUser?.id || 1,
        userName: currentUser?.name || 'Administrador',
        date: Date.now(),
        rateUsed: activeRate,
        rateSource: activeSource,
        amountUSD: conversions.amountUSD,
        amountVES: conversions.amountVES,
      });

      // 3. Update both accounts in Dexie and sync with central LAN
      await updateWithSync(db.accounts, 'accounts', targetAccount.id!, {
        balance: Number((targetAccount.balance - numAmount).toFixed(2)),
      });
      await updateWithSync(db.accounts, 'accounts', destAccount.id!, {
        balance: Number((destAccount.balance + destAmount).toFixed(2)),
      });

      onClose();
      return;
    }

    let txType: TransactionType = 'expense';
    let balanceDelta = 0;

    if (mode === 'income') {
      txType = 'income';
      balanceDelta = numAmount;
    } else if (mode === 'expense') {
      txType = 'expense';
      balanceDelta = -numAmount;
    } else if (mode === 'payroll') {
      txType = 'payroll';
      balanceDelta = -numAmount;
    }

    // 1. Create Transaction
    const newTx: Transaction = {
      type: txType,
      amount: numAmount,
      currency: targetAccount.currency,
      accountId: targetAccount.id!,
      accountName: targetAccount.bankName,
      description: finalDesc,
      userId: currentUser?.id || 1,
      userName: currentUser?.name || 'Administrador',
      date: Date.now(),
      rateUsed: activeRate,
      rateSource: activeSource,
      amountUSD: conversions.amountUSD,
      amountVES: conversions.amountVES,
    };

    await addWithSync(db.transactions, 'transactions', newTx);

    // 2. Update Account Balance
    const newBalance = targetAccount.balance + balanceDelta;
    await updateWithSync(db.accounts, 'accounts', targetAccount.id!, {
      balance: Number(newBalance.toFixed(2)),
    });

    onClose();
  };

  const MODES: { key: TxMode; label: string; icon: React.ReactNode; color: string; bg: string; subtitle: string }[] = [
    {
      key: 'income',
      label: 'Ingreso / Venta',
      icon: <ArrowDownCircle size={20} />,
      color: '#00CA72',
      bg: 'rgba(0, 202, 114, 0.1)',
      subtitle: 'Entrada de dinero por ventas o cobros a clientes',
    },
    {
      key: 'expense',
      label: 'Gasto / Egreso',
      icon: <ArrowUpCircle size={20} />,
      color: '#E2445C',
      bg: 'rgba(226, 68, 92, 0.1)',
      subtitle: 'Pago de mercancía, insumos, compras u operativos',
    },
    {
      key: 'transfer',
      label: 'Transferencia',
      icon: <ArrowLeftRight size={20} />,
      color: '#6161FF',
      bg: 'rgba(97, 97, 255, 0.1)',
      subtitle: 'Traspaso entre bancos, retiro o compra de USDT',
    },
    ...(canPayroll
      ? [
          {
            key: 'payroll' as TxMode,
            label: 'Nómina y Salarios',
            icon: <Users size={20} />,
            color: '#FDAB3D',
            bg: 'rgba(253, 171, 61, 0.12)',
            subtitle: 'Remuneración de personal y liquidación quincenal',
          },
        ]
      : []),
  ];

  return (
    <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
      <div className="mn-modal max-w-5xl w-full animate-scale-in bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-[#E6E9EF] dark:border-slate-800 overflow-hidden my-0 sm:my-auto max-h-[94dvh] sm:max-h-[92vh] flex flex-col">
        {/* Indicador táctil de arrastre nativo en móvil */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Grand Executive Header */}
        <div className="mn-modal-header border-b border-[#E6E9EF] dark:border-slate-800 bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 sm:px-7 py-3 sm:py-5 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 pr-2">
            <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-[#6161FF]/10 text-[#6161FF] flex items-center justify-center flex-shrink-0 shadow-sm">
              <Landmark size={22} className="sm:w-[26px] sm:h-[26px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                <span className="text-[0.625rem] sm:text-[0.6875rem] font-extrabold uppercase tracking-wider text-[#6161FF] bg-[#6161FF]/10 px-2 sm:px-2.5 py-0.5 rounded-full">
                  Gestión de Bóvedas
                </span>
                <span className="text-xs text-[#C5C7D0] hidden sm:inline">/</span>
                <span className="text-[0.6875rem] sm:text-xs text-[#00CA72] font-semibold flex items-center gap-1">
                  <ShieldCheck size={12} /> Asiento Inmediato
                </span>
              </div>
              <h2 className="text-lg sm:text-3xl font-black text-[#323338] dark:text-white tracking-tight truncate">
                Registrar Asiento Financiero
              </h2>
              <p className="text-[0.6875rem] sm:text-xs text-[#676879] dark:text-slate-400 mt-0.5 hidden sm:block">
                Actualiza al instante los saldos bancarios y asienta la partida doble en el Libro Diario Oficial.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white transition-colors tap-haptic cursor-pointer"
          >
            <X size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-8 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
          {/* Nature / Mode Selector */}
          <div>
            <label className="block text-xs font-black text-[#323338] dark:text-slate-200 uppercase tracking-wider mb-2">
              1. Naturaleza del Asiento Financiero
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODES.map(({ key, label, icon, color, subtitle }) => {
                const isSelected = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    className={`p-3.5 rounded-2xl text-left transition-all border flex flex-col justify-between gap-2 tap-haptic ${
                      isSelected
                        ? 'border-transparent shadow-lg text-white scale-[1.01]'
                        : 'border-[#E6E9EF] dark:border-slate-800 bg-white dark:bg-slate-800/80 text-[#676879] dark:text-slate-300 hover:bg-[#F5F6F8] dark:hover:bg-slate-800'
                    }`}
                    style={{
                      background: isSelected ? color : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {icon}
                        <span className="text-sm font-black">{label}</span>
                      </div>
                      {isSelected && <Check size={18} className="text-white" />}
                    </div>
                    <span className={`text-[0.6875rem] leading-tight ${isSelected ? 'text-white/85' : 'text-[#8C8F9F] dark:text-slate-400'}`}>
                      {subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── LEFT COLUMN (7 COLS): BANK ACCOUNTS ── */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-[#323338] dark:text-slate-200 uppercase tracking-wider">
                    {mode === 'transfer' ? '2. Cuenta de Origen (Emisora)' : '2. Bóveda o Cuenta Bancaria Afectada'}
                  </label>
                  <span className="text-xs text-[#676879] dark:text-slate-400 font-medium">
                    {accounts.length} Cuentas Oficiales
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {accounts.map((acc) => {
                    const isSelected = acc.id === targetAccountId;
                    let balanceInUSD = 0;
                    if (acc.currency === 'VES') {
                      balanceInUSD = activeRate > 0 ? acc.balance / activeRate : 0;
                    } else {
                      balanceInUSD = acc.balance;
                    }

                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setTargetAccountId(acc.id!)}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all tap-haptic ${
                          isSelected
                            ? 'border-[#6161FF] bg-[#6161FF]/10 ring-2 ring-[#6161FF]/30 shadow-sm'
                            : 'border-[#E6E9EF] dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:bg-[#F5F6F8] dark:hover:bg-slate-800'
                        }`}
                      >
                        <BankLogo name={acc.bankName} size={36} className="shadow-sm flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[#323338] dark:text-white truncate">
                            {acc.bankName}
                          </div>
                          <div className="text-[0.6875rem] text-[#676879] dark:text-slate-400 font-mono mt-0.5">
                            Saldo: <strong className="text-[#323338] dark:text-slate-200">{formatCurrency(acc.balance, acc.currency as any)}</strong>
                          </div>
                          <div className="text-[0.625rem] text-[#00CA72] font-mono font-semibold">
                            ≈ {formatCurrency(balanceInUSD, 'USD')} USD
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#6161FF] text-white flex items-center justify-center flex-shrink-0">
                            <Check size={14} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Destination Account Selection for Transfer Mode */}
              {mode === 'transfer' && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl animate-fade-in space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-blue-900 block">
                      Cuenta de Destino (Receptora)
                    </label>
                    <span className="text-[0.6875rem] font-bold text-blue-700">
                      Recibe: {formatCurrency(transferCalc.destAmount, transferCalc.destCurrency as any)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1">
                    {accounts
                      .filter((acc) => acc.id !== targetAccount.id)
                      .map((acc) => {
                        const isSelected = acc.id === destAccountId;
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => setDestAccountId(acc.id!)}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all tap-haptic ${
                              isSelected
                                ? 'border-[#6161FF] bg-white dark:bg-slate-800 ring-2 ring-[#6161FF] shadow-sm font-bold'
                                : 'border-[#E6E9EF] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-750'
                            }`}
                          >
                            <BankLogo name={acc.bankName} size={28} className="flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-[#323338] dark:text-white truncate font-bold">
                                {acc.bankName}
                              </div>
                              <div className="text-[0.625rem] text-[#676879] dark:text-slate-400">
                                {acc.currency} · Saldo: {formatCurrency(acc.balance, acc.currency as any)}
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="text-[#6161FF]" />}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Payroll Recipient Input (If mode === payroll) */}
              {mode === 'payroll' && (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl animate-fade-in">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-1">
                    Beneficiario de la Nómina / Empleado
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez · Operador de Tostado"
                    value={payrollRecipient}
                    onChange={(e) => setPayrollRecipient(e.target.value)}
                    className="mn-input text-xs font-bold bg-white dark:bg-slate-800 border-amber-200 dark:border-amber-800 text-[#323338] dark:text-white"
                  />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="mn-input-label text-xs font-black uppercase tracking-wider text-[#323338] dark:text-slate-200">
                  Concepto / Glosa de la Operación
                </label>
                <input
                  type="text"
                  placeholder={
                    mode === 'income'
                      ? 'Ej. Cobranza venta al mayor según recibo N° 204'
                      : mode === 'expense'
                      ? 'Ej. Compra de empaques y bolsas para producción'
                      : 'Ej. Liquidación de salarios correspondiente a la primera quincena'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mn-input text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#323338] dark:text-white"
                />
              </div>
            </div>

            {/* ── RIGHT COLUMN (5 COLS): AMOUNT, LIVE CONVERSION & TRIAL BALANCE ── */}
            <div className="lg:col-span-5 space-y-4">
              {/* Amount Box */}
              <div className="p-4 sm:p-5 rounded-3xl bg-[#F8F9FA] dark:bg-slate-800/60 border border-[#E6E9EF] dark:border-slate-700 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-[#323338] dark:text-slate-200">
                    3. Monto del Asiento
                  </label>
                  <span className="text-xs font-mono font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded">
                    Tasa: {activeRate.toFixed(2)} Bs
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full py-3.5 sm:py-4 pl-4 pr-16 rounded-2xl border border-[#E6E9EF] dark:border-slate-700 text-3xl sm:text-4xl font-mono font-black text-[#323338] dark:text-white bg-white dark:bg-slate-900 focus:border-[#6161FF] focus:ring-4 focus:ring-[#6161FF]/10 outline-none transition-all shadow-inner"
                    autoFocus
                  />
                  <span className="absolute inset-y-0 right-0 pr-4 flex items-center font-black text-base text-[#6161FF]">
                    {targetAccount.currency}
                  </span>
                </div>

                {/* Contravalor preview */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-[#E6E9EF] dark:border-slate-700 space-y-1 font-mono text-xs shadow-sm">
                  <div className="flex items-center justify-between text-[#676879] dark:text-slate-400">
                    <span>Contravalor Equivalente:</span>
                    <span className="font-black text-base text-[#00CA72]">
                      {targetAccount.currency === 'VES'
                        ? formatCurrency(conversions.amountUSD, 'USD')
                        : formatCurrency(conversions.amountVES, 'VES')}
                    </span>
                  </div>
                  <div className="text-[0.6875rem] text-[#8C8F9F] dark:text-slate-400 flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-800">
                    <span>Moneda de Operación:</span>
                    <span className="font-bold text-[#323338] dark:text-white">{targetAccount.currency}</span>
                  </div>
                </div>

                {/* Accounting Double-Entry Preview Card */}
                <div className="p-3.5 rounded-2xl bg-[#1D2132] text-white space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[0.6875rem] font-bold text-white/80">
                    <span className="flex items-center gap-1">
                      <Scale size={13} className="text-[#00CA72]" /> Partida Doble en Sistema
                    </span>
                    <span className="text-[#00CA72]">Balance Cuadrado</span>
                  </div>

                  <div className="space-y-1 font-mono text-[0.6875rem]">
                    <div className="flex justify-between text-white/90">
                      <span>DEBE (Receptor / Cargo):</span>
                      <span className="text-[#00CA72] font-bold">
                        {mode === 'transfer'
                          ? destAccount.bankName
                          : mode === 'income'
                          ? targetAccount.bankName
                          : 'Gastos Operativos / Nómina'}
                      </span>
                    </div>
                    <div className="flex justify-between text-white/90">
                      <span>HABER (Emisor / Abono):</span>
                      <span className="text-amber-400 font-bold">
                        {mode === 'transfer'
                          ? targetAccount.bankName
                          : mode === 'income'
                          ? 'Ingresos Operacionales'
                          : targetAccount.bankName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 -mx-4 -mb-4 sm:-mx-8 sm:-mb-8 bg-[#F6F7FB] dark:bg-slate-900 border-t border-[#E6E9EF] dark:border-slate-800 flex items-center justify-between gap-3 sm:gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="mn-btn mn-btn-outline text-xs py-2.5 sm:py-3 px-4 sm:px-6 font-semibold tap-haptic"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={numAmount <= 0}
              className="mn-btn mn-btn-primary text-xs py-3 sm:py-3.5 px-5 sm:px-8 flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 active:scale-95 transition-all text-xs sm:text-sm font-black disabled:opacity-40 tap-haptic"
            >
              <Plus size={18} />
              <span>Asentar en Bóveda y Libro Diario</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionSheet;
