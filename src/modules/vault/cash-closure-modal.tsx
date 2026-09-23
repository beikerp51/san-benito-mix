import React, { useState, useEffect } from 'react';
import { db, type Account, type CashClosure, type AccountClosureDetail, addWithSync, updateWithSync } from '../../db/database';
import { useAuthStore } from '../../auth/auth-store';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { BankLogo } from '../../components/bank-logos';
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  Printer,
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Building2,
  Receipt,
  User,
  Sparkles,
} from 'lucide-react';

interface CashClosureModalProps {
  accounts: Account[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CashClosureModal: React.FC<CashClosureModalProps> = ({
  accounts,
  onClose,
  onSuccess,
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  // Physical counts state map (accountId -> physical balance)
  const [physicalCounts, setPhysicalCounts] = useState<Record<number, number>>(() => {
    const initial: Record<number, number> = {};
    accounts.forEach((acc) => {
      if (acc.id) initial[acc.id] = acc.balance;
    });
    return initial;
  });
  const [observations, setObservations] = useState('');
  const [adjustBalances, setAdjustBalances] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedClosure, setSavedClosure] = useState<CashClosure | null>(null);

  useEffect(() => {
    // Default physical counts to current system balances if empty
    setPhysicalCounts((prev) => {
      const updated = { ...prev };
      let hasChanges = false;
      accounts.forEach((acc) => {
        if (acc.id && updated[acc.id] === undefined) {
          updated[acc.id] = acc.balance;
          hasChanges = true;
        }
      });
      return hasChanges ? updated : prev;
    });
  }, [accounts]);

  const handlePhysicalChange = (accountId: number, val: number) => {
    setPhysicalCounts((prev) => ({ ...prev, [accountId]: isNaN(val) ? 0 : val }));
  };

  // Compute closure details
  const accountsDetail: AccountClosureDetail[] = accounts.map((acc) => {
    const phys = physicalCounts[acc.id!] !== undefined ? physicalCounts[acc.id!] : acc.balance;
    const diff = phys - acc.balance;
    return {
      accountId: acc.id!,
      bankName: acc.bankName,
      currency: acc.currency,
      systemBalance: acc.balance,
      physicalBalance: phys,
      difference: diff,
    };
  });

  // Consolidated USD and VES calculations
  let totalSystemUSD = 0;
  let totalPhysicalUSD = 0;
  let totalSystemVES = 0;
  let totalPhysicalVES = 0;

  accountsDetail.forEach((d) => {
    if (d.currency === 'USD' || d.currency === 'USDT') {
      totalSystemUSD += d.systemBalance;
      totalPhysicalUSD += d.physicalBalance;
      if (activeRate > 0) {
        totalSystemVES += d.systemBalance * activeRate;
        totalPhysicalVES += d.physicalBalance * activeRate;
      }
    } else if (d.currency === 'VES') {
      totalSystemVES += d.systemBalance;
      totalPhysicalVES += d.physicalBalance;
      if (activeRate > 0) {
        totalSystemUSD += d.systemBalance / activeRate;
        totalPhysicalUSD += d.physicalBalance / activeRate;
      }
    }
  });

  const totalDiffUSD = totalPhysicalUSD - totalSystemUSD;
  const totalDiffVES = Number((totalDiffUSD * activeRate).toFixed(2));

  const handleSaveClosure = async () => {
    setIsSubmitting(true);
    try {
      const now = new Date();
      const codeStr = `CZ-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      const closureRecord: CashClosure = {
        closureCode: codeStr,
        date: Date.now(),
        closedByUserId: currentUser?.id || 1,
        closedByUserName: currentUser?.name || 'Fabiana Acosta (Administradora)',
        totalSystemUSD: Number(totalSystemUSD.toFixed(2)),
        totalPhysicalUSD: Number(totalPhysicalUSD.toFixed(2)),
        totalDiffUSD: Number(totalDiffUSD.toFixed(2)),
        totalSystemVES: Number(totalSystemVES.toFixed(2)),
        totalPhysicalVES: Number(totalPhysicalVES.toFixed(2)),
        totalDiffVES: Number(totalDiffVES.toFixed(2)),
        rateUsed: activeRate,
        accountsDetail,
        observations: observations.trim(),
        status: 'locked',
      };

      const recordId = await addWithSync(db.cashClosures, 'cashClosures', closureRecord);

      // Reconcile and adjust account balances to physical reality if enabled
      if (adjustBalances) {
        for (const detail of accountsDetail) {
          if (Math.abs(detail.difference) > 0.001) {
            await updateWithSync(db.accounts, 'accounts', detail.accountId, {
              balance: Number(detail.physicalBalance.toFixed(2)),
            });

            const isDiffPositive = detail.difference > 0;
            const diffAbs = Math.abs(detail.difference);
            const diffUSD = detail.currency === 'VES'
              ? (activeRate > 0 ? diffAbs / activeRate : 0)
              : diffAbs;
            const diffVES = detail.currency === 'VES'
              ? diffAbs
              : diffAbs * activeRate;

            await addWithSync(db.transactions, 'transactions', {
              type: 'adjustment',
              amount: Number(diffAbs.toFixed(2)),
              currency: detail.currency,
              amountUSD: Number(diffUSD.toFixed(2)),
              amountVES: Number(diffVES.toFixed(2)),
              accountId: detail.accountId,
              accountName: detail.bankName,
              description: `[CIERRE Z ${codeStr}] Regularización por ${isDiffPositive ? 'Sobrante' : 'Faltante'} en arqueo físico`,
              userId: currentUser?.id || 1,
              userName: currentUser?.name || 'Administrador',
              date: Date.now(),
              rateUsed: activeRate,
              rateSource: 'bcv_usd',
            });
          }
        }
      }

      setSavedClosure({ ...closureRecord, id: recordId });
      onSuccess();
    } catch (err) {
      console.error('Error al guardar cierre de caja:', err);
      alert('Error al procesar el Cierre Z.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grand Printable Receipt / Voucher View
  if (savedClosure) {
    return (
      <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
        <div className="mn-modal max-w-5xl w-full animate-scale-in bg-white dark:bg-slate-900 p-0 overflow-hidden shadow-2xl rounded-t-[28px] sm:rounded-3xl border border-[#E6E9EF] dark:border-slate-800 my-0 sm:my-auto flex flex-col max-h-[94dvh]">
          {/* Indicador táctil de arrastre nativo en móvil */}
          <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2.5 flex-shrink-0" />

          <div className="bg-gradient-to-r from-[#1D2132] via-[#292F4C] to-[#141824] p-5 sm:p-7 text-white text-center relative">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/20 text-[#00CA72] border border-emerald-500/30 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <ShieldCheck size={28} className="sm:w-8 sm:h-8" />
            </div>
            <span className="text-[0.6875rem] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
              Arqueo Oficial Certificado
            </span>
            <h3 className="text-xl sm:text-2xl font-black mt-2 tracking-tight">Cierre Z de Bóvedas y Caja Concluido</h3>
            <p className="text-xs text-white/70 mt-1">
              Correlativo Inmutable: <span className="font-mono text-white font-bold bg-white/10 px-2 py-0.5 rounded">{savedClosure.closureCode}</span>
            </p>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full hover:bg-white/10 text-white/80 transition-colors tap-haptic"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-4 sm:p-7 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-[#323338] dark:text-slate-200">
            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E9EF] dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src="/san-benito-logo.jpg"
                  alt="San Benito Mix"
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-amber-400/60 shadow-md"
                />
                <div>
                  <div className="font-black text-sm sm:text-base text-[#323338] dark:text-white">SAN BENITO MIX</div>
                  <div className="text-[0.6875rem] sm:text-xs text-[#676879] dark:text-slate-400 font-medium">
                    Acta Oficial de Cierre Diario de Caja · {new Date(savedClosure.date).toLocaleString('es-VE')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[0.6875rem] sm:text-xs text-[#676879] dark:text-slate-400 block font-medium">Tasa Oficial BCV</span>
                <span className="font-mono font-black text-sm sm:text-base text-[#6161FF]">{savedClosure.rateUsed.toFixed(2)} Bs/$</span>
              </div>
            </div>

            {/* Consolidated summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-5 bg-[#F6F7FB] dark:bg-slate-800/60 rounded-2xl border border-[#E6E9EF] dark:border-slate-700 text-center font-mono">
              <div>
                <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400 font-sans font-bold uppercase block mb-1">
                  Saldo Sistema
                </span>
                <span className="text-sm sm:text-xl font-black text-[#323338] dark:text-white">
                  {formatCurrency(savedClosure.totalSystemUSD, 'USD')}
                </span>
                <span className="text-[0.5625rem] sm:text-[0.625rem] text-[#676879] dark:text-slate-400 block mt-0.5">
                  ≈ {formatCurrency(savedClosure.totalSystemVES, 'VES')}
                </span>
              </div>
              <div>
                <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400 font-sans font-bold uppercase block mb-1">
                  Conteo Físico Real
                </span>
                <span className="text-sm sm:text-xl font-black text-[#00CA72]">
                  {formatCurrency(savedClosure.totalPhysicalUSD, 'USD')}
                </span>
                <span className="text-[0.5625rem] sm:text-[0.625rem] text-[#676879] dark:text-slate-400 block mt-0.5">
                  ≈ {formatCurrency(savedClosure.totalPhysicalVES, 'VES')}
                </span>
              </div>
              <div>
                <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400 font-sans font-bold uppercase block mb-1">
                  Diferencia Neta
                </span>
                <span
                  className={`text-sm sm:text-xl font-black ${
                    Math.abs(savedClosure.totalDiffUSD) < 0.05
                      ? 'text-[#00CA72]'
                      : savedClosure.totalDiffUSD > 0
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-[#E2445C]'
                  }`}
                >
                  {savedClosure.totalDiffUSD >= 0 ? '+' : ''}
                  {formatCurrency(savedClosure.totalDiffUSD, 'USD')}
                </span>
                <span className="text-[0.5625rem] sm:text-[0.625rem] font-bold block mt-0.5 text-[#676879] dark:text-slate-400">
                  {Math.abs(savedClosure.totalDiffUSD) < 0.05 ? 'Cuadrado Exacto' : savedClosure.totalDiffUSD > 0 ? 'Sobrante' : 'Faltante'}
                </span>
              </div>
            </div>

            {/* Account rows */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#676879] dark:text-slate-400 uppercase tracking-wider block mb-2">
                Conciliación por Entidad (8 Cuentas Oficiales)
              </span>
              {savedClosure.accountsDetail.map((d) => (
                <div
                  key={d.accountId}
                  className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 flex items-center justify-between font-mono hover:bg-gray-50 dark:hover:bg-slate-750 transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3 font-sans font-medium text-xs">
                    <BankLogo name={d.bankName} size={28} />
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-[#323338] dark:text-white block">{d.bankName}</span>
                      <span className="text-[0.6875rem] text-[#676879] dark:text-slate-400 font-medium">{d.currency}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 text-right">
                    <div>
                      <span className="text-[0.5625rem] sm:text-[0.625rem] text-[#676879] dark:text-slate-400 block font-sans uppercase">Sistema</span>
                      <span className="font-bold text-[0.6875rem] sm:text-xs text-[#323338] dark:text-slate-200">{formatCurrency(d.systemBalance, d.currency as any)}</span>
                    </div>
                    <div>
                      <span className="text-[0.5625rem] sm:text-[0.625rem] text-[#676879] dark:text-slate-400 block font-sans uppercase">Físico</span>
                      <span className="font-black text-[0.6875rem] sm:text-xs text-[#00CA72]">{formatCurrency(d.physicalBalance, d.currency as any)}</span>
                    </div>
                    <div className="w-16 sm:w-24 text-right">
                      <span className="text-[0.5625rem] sm:text-[0.625rem] text-[#676879] dark:text-slate-400 block font-sans uppercase">Diferencia</span>
                      <span
                        className={`font-black text-[0.6875rem] sm:text-xs ${
                          Math.abs(d.difference) < 0.01
                            ? 'text-gray-400'
                            : d.difference > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-[#E2445C]'
                        }`}
                      >
                        {Math.abs(d.difference) < 0.01 ? '0.00' : `${d.difference > 0 ? '+' : ''}${formatCurrency(d.difference, d.currency as any)}`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Signatures */}
            <div className="pt-6 sm:pt-8 border-t border-dashed border-[#E6E9EF] dark:border-slate-700 grid grid-cols-2 gap-4 sm:gap-10 text-center">
              <div className="border-t border-gray-300 dark:border-slate-600 pt-2">
                <span className="font-bold block text-xs sm:text-sm text-[#323338] dark:text-white">{savedClosure.closedByUserName}</span>
                <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400">Contadora Pública / Administración</span>
              </div>
              <div className="border-t border-gray-300 dark:border-slate-600 pt-2">
                <span className="font-bold block text-xs sm:text-sm text-[#323338] dark:text-white">Beiker Pérez</span>
                <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400">Contador Público / Dirección General</span>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-[#F6F7FB] dark:bg-slate-900 border-t border-[#E6E9EF] dark:border-slate-800 flex items-center justify-between">
            <button
              onClick={() => window.print()}
              className="mn-btn mn-btn-outline text-xs py-2.5 px-4 sm:px-5 flex items-center gap-2 tap-haptic"
            >
              <Printer size={15} />
              <span>Imprimir Cierre Z</span>
            </button>
            <button
              onClick={onClose}
              className="mn-btn mn-btn-primary text-xs py-2.5 px-5 sm:px-7 font-bold tap-haptic"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Grand Executive Reconciliation Form (Large Format)
  return (
    <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
      <div className="mn-modal max-w-6xl w-full animate-scale-in bg-white dark:bg-slate-900 p-0 overflow-hidden shadow-2xl rounded-t-[28px] sm:rounded-3xl border border-[#E6E9EF] dark:border-slate-800 my-0 sm:my-auto max-h-[94dvh] flex flex-col">
        {/* Indicador táctil de arrastre nativo en móvil */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Grand Executive Header */}
        <div className="p-4 sm:p-7 border-b border-[#E6E9EF] dark:border-slate-800 bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-[#1D2132] text-amber-400 flex items-center justify-center flex-shrink-0 shadow-lg">
              <Receipt size={22} className="sm:w-7 sm:h-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 flex-wrap">
                <span className="text-[0.625rem] sm:text-[0.6875rem] font-extrabold uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 sm:px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  Arqueo de Jornada
                </span>
                <span className="text-xs text-[#C5C7D0] hidden sm:inline">/</span>
                <span className="text-[0.6875rem] sm:text-xs text-[#676879] dark:text-slate-400 font-semibold hidden sm:inline">Conciliación de 8 Bóvedas</span>
              </div>
              <h2 className="text-lg sm:text-3xl font-black text-[#323338] dark:text-white tracking-tight truncate">
                Cierre Diario de Caja y Bóvedas
              </h2>
              <p className="text-[0.6875rem] sm:text-xs text-[#676879] dark:text-slate-400 mt-0.5 hidden sm:block">
                Audita y cuadra los saldos teóricos del sistema contra los conteos reales en efectivo y extractos bancarios.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white transition-colors tap-haptic"
          >
            <X size={20} className="sm:w-[22px] sm:h-[22px]" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-8 space-y-4 sm:space-y-5 max-h-[76vh] overflow-y-auto flex-1">
          {/* Large Live Reconciliation Banner */}
          <div className="p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-[#6161FF]/10 via-[#00CA72]/10 to-transparent border border-[#6161FF]/20 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 text-center">
            <div className="p-3 bg-white/70 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-white dark:border-slate-700">
              <span className="text-[0.625rem] sm:text-xs font-bold text-[#676879] dark:text-slate-400 uppercase block mb-1">
                Total Sistema Teórico
              </span>
              <span className="text-lg sm:text-2xl font-black text-[#323338] dark:text-white font-mono">
                {formatCurrency(totalSystemUSD, 'USD')}
              </span>
              <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400 block font-mono mt-0.5">
                ≈ {formatCurrency(totalSystemUSD * activeRate, 'VES')}
              </span>
            </div>

            <div className="p-3 bg-white/70 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-white dark:border-slate-700">
              <span className="text-[0.625rem] sm:text-xs font-bold text-[#676879] dark:text-slate-400 uppercase block mb-1">
                Total Conteo Físico Real
              </span>
              <span className="text-lg sm:text-2xl font-black text-[#00CA72] font-mono">
                {formatCurrency(totalPhysicalUSD, 'USD')}
              </span>
              <span className="text-[0.625rem] sm:text-xs text-[#676879] dark:text-slate-400 block font-mono mt-0.5">
                ≈ {formatCurrency(totalPhysicalUSD * activeRate, 'VES')}
              </span>
            </div>

            <div className="p-3 bg-white/70 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-white dark:border-slate-700">
              <span className="text-[0.625rem] sm:text-xs font-bold text-[#676879] dark:text-slate-400 uppercase block mb-1">
                Diferencia de Cuadratura
              </span>
              <span
                className={`text-lg sm:text-2xl font-black font-mono ${
                  Math.abs(totalDiffUSD) < 0.05
                    ? 'text-[#00CA72]'
                    : totalDiffUSD > 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-[#E2445C]'
                }`}
              >
                {Math.abs(totalDiffUSD) < 0.05 ? 'Cuadrado $0.00' : `${totalDiffUSD > 0 ? '+' : ''}${formatCurrency(totalDiffUSD, 'USD')}`}
              </span>
              <span className="text-[0.625rem] sm:text-xs font-bold block mt-0.5 text-[#676879] dark:text-slate-400">
                {Math.abs(totalDiffUSD) < 0.05 ? 'Sin discrepancias' : totalDiffUSD > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
              </span>
            </div>
          </div>

          {/* Accounts List for Reconciliation */}
          <div className="space-y-2.5 sm:space-y-3">
            <div className="hidden sm:flex items-center justify-between text-xs font-bold text-[#676879] dark:text-slate-400 uppercase px-3">
              <span>ENTIDAD / CUENTA BANCARIA</span>
              <div className="flex items-center gap-14 mr-4">
                <span>SALDO SISTEMA</span>
                <span>CONTEO REAL (BANCO / CAJA)</span>
                <span>DIFERENCIA</span>
              </div>
            </div>

            {accounts.map((acc) => {
              const phys = physicalCounts[acc.id!] !== undefined ? physicalCounts[acc.id!] : acc.balance;
              const diff = phys - acc.balance;

              return (
                <div
                  key={acc.id}
                  className="p-3 sm:p-4 rounded-2xl bg-[#F8F9FA] dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 hover:border-[#6161FF]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <BankLogo name={acc.bankName} size={36} className="flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-black text-xs sm:text-sm text-[#323338] dark:text-white truncate">{acc.bankName}</div>
                      <div className="text-[0.6875rem] sm:text-xs text-[#676879] dark:text-slate-400 font-medium truncate">
                        {acc.accountType} · <span className="font-bold text-[#6161FF]">{acc.currency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Columns */}
                  <div className="hidden sm:flex items-center gap-5 sm:ml-auto">
                    {/* System Balance */}
                    <div className="text-right min-w-[100px]">
                      <span className="text-sm font-mono font-bold text-[#676879] dark:text-slate-400">
                        {formatCurrency(acc.balance, acc.currency as any)}
                      </span>
                    </div>

                    {/* Editable Physical Count */}
                    <div className="w-36">
                      <input
                        type="number"
                        step="0.01"
                        value={phys}
                        onChange={(e) => handlePhysicalChange(acc.id!, parseFloat(e.target.value) || 0)}
                        className="w-full py-2 px-3 rounded-xl border border-[#E6E9EF] dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-mono font-black text-right text-[#323338] dark:text-white focus:border-[#6161FF] focus:ring-2 focus:ring-[#6161FF]/10 outline-none transition-all"
                      />
                    </div>

                    {/* Diff */}
                    <div className="text-right min-w-[90px]">
                      <span
                        className={`text-sm font-mono font-black ${
                          Math.abs(diff) < 0.01
                            ? 'text-[#00CA72]'
                            : diff > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-[#E2445C]'
                        }`}
                      >
                        {Math.abs(diff) < 0.01 ? '0.00' : `${diff > 0 ? '+' : ''}${formatCurrency(diff, acc.currency as any)}`}
                      </span>
                    </div>
                  </div>

                  {/* Mobile 3-Column Touch Grid */}
                  <div className="sm:hidden grid grid-cols-3 gap-2 pt-2 border-t border-[#E6E9EF]/60 dark:border-slate-700 items-center">
                    <div className="text-left">
                      <span className="text-[0.5625rem] text-[#676879] dark:text-slate-400 uppercase font-bold block">Sistema</span>
                      <span className="text-xs font-mono font-bold text-[#323338] dark:text-white">
                        {formatCurrency(acc.balance, acc.currency as any)}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[0.5625rem] text-[#676879] dark:text-slate-400 uppercase font-bold block mb-0.5">Conteo Real</span>
                      <input
                        type="number"
                        step="0.01"
                        value={phys}
                        onChange={(e) => handlePhysicalChange(acc.id!, parseFloat(e.target.value) || 0)}
                        className="w-full py-1.5 px-2 rounded-lg border border-[#E6E9EF] dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-black text-center text-[#323338] dark:text-white focus:border-[#6161FF] outline-none"
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-[0.5625rem] text-[#676879] dark:text-slate-400 uppercase font-bold block">Diferencia</span>
                      <span
                        className={`text-xs font-mono font-black ${
                          Math.abs(diff) < 0.01
                            ? 'text-[#00CA72]'
                            : diff > 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-[#E2445C]'
                        }`}
                      >
                        {Math.abs(diff) < 0.01 ? '0.00' : `${diff > 0 ? '+' : ''}${formatCurrency(diff, acc.currency as any)}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Observations */}
          <div>
            <label className="mn-input-label text-xs font-bold uppercase tracking-wider text-[#323338] dark:text-slate-300">
              Observaciones del Cierre de Jornada (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Cuadratura conforme de Efectivo y Pago Móvil BDV. Todo cuadrado sin novedades..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mn-input text-xs py-2.5 sm:py-3 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-[#323338] dark:text-white"
            />
          </div>

          {/* Auto Reconcile Checkbox */}
          <label className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 cursor-pointer transition-all hover:bg-emerald-100/60 dark:hover:bg-emerald-950/50">
            <input
              type="checkbox"
              checked={adjustBalances}
              onChange={(e) => setAdjustBalances(e.target.checked)}
              className="w-4 h-4 rounded text-[#00CA72] accent-[#00CA72]"
            />
            <div>
              <span className="text-xs font-bold text-[#323338] dark:text-white block">
                Ajustar y cuadrar automáticamente los saldos del sistema con el conteo físico real
              </span>
              <span className="text-[0.6875rem] text-[#676879] dark:text-slate-400">
                Genera los asientos contables de regularización (sobrante o faltante) en el Libro Diario Oficial.
              </span>
            </div>
          </label>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-[#F6F7FB] dark:bg-slate-900 border-t border-[#E6E9EF] dark:border-slate-800 flex items-center justify-between gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onClose}
            className="mn-btn mn-btn-outline text-xs py-2.5 sm:py-3 px-4 sm:px-6 tap-haptic"
          >
            Cancelar
          </button>
          <button
            onClick={handleSaveClosure}
            disabled={isSubmitting}
            className="mn-btn mn-btn-primary text-xs py-2.5 sm:py-3 px-5 sm:px-8 flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 font-bold text-xs sm:text-sm active:scale-95 transition-all tap-haptic"
          >
            <Lock size={15} />
            <span>{isSubmitting ? 'Bloqueando Cierre Z...' : 'Generar y Bloquear Cierre Z'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
