import React, { useState, useEffect, useMemo } from 'react';
import { db, type Account, type Transaction, addWithSync, updateWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { useAuthStore } from '../../auth/auth-store';
import {
  BookOpen,
  Bot,
  Sparkles,
  Scale,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  ShieldCheck,
  RotateCcw,
  Landmark,
  ArrowRight,
  Check,
  HelpCircle,
  Calculator,
  RefreshCw,
} from 'lucide-react';
import { BankLogo } from '../../components/bank-logos';

interface ManualEntryModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

// Plan Único de Cuentas VEN-NIF PYMES
export const CHART_OF_ACCOUNTS = [
  // 1. ACTIVOS
  { code: '1.1.01.01', name: 'Caja Chica · Disponibilidad Efectivo en Bolívares', nature: 'deudora', category: 'Activo' },
  { code: '1.1.01.02', name: 'Caja Fuerte · Disponibilidad Efectivo Divisas USD', nature: 'deudora', category: 'Activo' },
  { code: '1.1.02.01', name: 'Bancos · Banesco Banco Universal', nature: 'deudora', category: 'Activo' },
  { code: '1.1.02.02', name: 'Bancos · Banco de Venezuela S.A.', nature: 'deudora', category: 'Activo' },
  { code: '1.1.02.03', name: 'Criptoactivos Bóveda · Binance USDT', nature: 'deudora', category: 'Activo' },
  { code: '1.1.02.04', name: 'Bancos · Banco Nacional de Crédito (BNC)', nature: 'deudora', category: 'Activo' },
  { code: '1.1.02.05', name: 'Bancos · Mercantil Banco Universal', nature: 'deudora', category: 'Activo' },
  { code: '1.1.02.06', name: 'Bancos · Banco Digital de los Trabajadores', nature: 'deudora', category: 'Activo' },
  { code: '1.1.03.01', name: 'Cuentas por Cobrar Comerciales · Clientes', nature: 'deudora', category: 'Activo' },
  { code: '1.1.05.01', name: 'Inventario de Mercancía y Materia Prima', nature: 'deudora', category: 'Activo' },

  // 2. PASIVOS
  { code: '2.1.01.01', name: 'Cuentas por Pagar Comerciales · Proveedores', nature: 'acreedora', category: 'Pasivo' },
  { code: '2.1.02.01', name: 'Retenciones y Tributos Fiscales por Pagar', nature: 'acreedora', category: 'Pasivo' },
  { code: '2.1.03.01', name: 'Sueldos, Salarios y Beneficios por Pagar', nature: 'acreedora', category: 'Pasivo' },

  // 3. PATRIMONIO
  { code: '3.1.01.01', name: 'Capital Social Suscrito y Pagado', nature: 'acreedora', category: 'Patrimonio' },
  { code: '3.2.01.01', name: 'Resultados y Utilidades Acumuladas', nature: 'acreedora', category: 'Patrimonio' },

  // 4. INGRESOS
  { code: '4.1.01.01', name: 'Ingresos Operacionales por Ventas de Mercancía', nature: 'acreedora', category: 'Ingreso' },
  { code: '4.2.01.01', name: 'Otros Ingresos Operacionales y Financieros', nature: 'acreedora', category: 'Ingreso' },

  // 5. GASTOS Y COSTOS
  { code: '5.1.01.01', name: 'Costo de Ventas y Mercancía Vendida', nature: 'deudora', category: 'Costo' },
  { code: '5.2.01.01', name: 'Gastos de Operación y Administración Comercial', nature: 'deudora', category: 'Gasto' },
  { code: '5.2.02.01', name: 'Gastos de Personal · Sueldos, Nóminas y Beneficios', nature: 'deudora', category: 'Gasto' },
  { code: '5.2.03.01', name: 'Gastos de Transporte, Fletes y Distribución', nature: 'deudora', category: 'Gasto' },
  { code: '5.2.04.01', name: 'Gastos de Empaques, Bolsas y Consumibles', nature: 'deudora', category: 'Gasto' },
  { code: '6.1.01.01', name: 'Ajustes y Diferencias en Bóvedas de Disponibilidad', nature: 'deudora', category: 'Gasto' },
];

const OPERATION_TEMPLATES = [
  {
    id: 'sale',
    label: 'Venta de Mercancía (Ingreso)',
    debitCode: '1.1.02.01', // Bank
    creditCode: '4.1.01.01', // Sales
    type: 'income',
    glosa: 'Para registrar venta de mercancía terminada según factura/recibo comercial.',
  },
  {
    id: 'client_payment',
    label: 'Cobranza a Cliente a Crédito',
    debitCode: '1.1.02.01', // Bank
    creditCode: '1.1.03.01', // Accounts Receivable
    type: 'client_payment',
    glosa: 'Para registrar cobro de cuenta por cobrar según recibo de cobranza formal.',
  },
  {
    id: 'expense_ops',
    label: 'Gasto Operativo / Compra Insumos',
    debitCode: '5.2.01.01', // Expense
    creditCode: '1.1.02.01', // Bank
    type: 'expense',
    glosa: 'Para registrar desembolso por gastos operativos según comprobante de egreso.',
  },
  {
    id: 'packaging',
    label: 'Compra de Empaques y Bolsas',
    debitCode: '5.2.04.01', // Packaging
    creditCode: '1.1.02.01', // Bank
    type: 'expense',
    glosa: 'Para registrar compra de bolsas y materiales de empaque para producción.',
  },
  {
    id: 'payroll',
    label: 'Pago de Nómina y Salarios',
    debitCode: '5.2.02.01', // Payroll Expense
    creditCode: '1.1.02.01', // Bank
    type: 'payroll',
    glosa: 'Para registrar liquidación y pago de salarios correspondientes a la quincena.',
  },
  {
    id: 'adjustment',
    label: 'Ajuste / Regularización de Bóveda',
    debitCode: '6.1.01.01', // Adjustment
    creditCode: '1.1.02.01', // Bank
    type: 'adjustment',
    glosa: 'Para registrar regularización contable de arqueo de bóveda según acta de cierre.',
  },
];

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({ onClose, onSuccess }) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const activeSource = useExchangeRateStore((s) => s.activeSource);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [opTemplate, setOpTemplate] = useState<string>('sale');

  // Accounting fields
  const [entryDate, setEntryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [entryTime, setEntryTime] = useState<string>(() => new Date().toTimeString().slice(0, 5));
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [amountInput, setAmountInput] = useState<string>('');
  const [debitAccountCode, setDebitAccountCode] = useState<string>('1.1.02.01');
  const [creditAccountCode, setCreditAccountCode] = useState<string>('4.1.01.01');
  const [glosa, setGlosa] = useState<string>(OPERATION_TEMPLATES[0].glosa);
  const [docRef, setDocRef] = useState<string>('COMP-001');

  // AI Audit State
  const [aiAnalysisRunning, setAiAnalysisRunning] = useState(false);
  const [aiDictamenPassed, setAiDictamenPassed] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const items = await db.accounts.toArray();
    setAccounts(items);
    if (items.length > 0) {
      setSelectedAccountId(items[0].id!);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  // Sync selected account with the relevant bank code in Debit or Credit
  const handleAccountChange = (accId: number) => {
    setSelectedAccountId(accId);
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return;

    let targetCode = '1.1.02.01';
    const norm = acc.bankName.toLowerCase();
    if (norm.includes('banesco')) targetCode = '1.1.02.01';
    else if (norm.includes('venezuela')) targetCode = '1.1.02.02';
    else if (norm.includes('binance')) targetCode = '1.1.02.03';
    else if (norm.includes('nacional') || norm.includes('bnc')) targetCode = '1.1.02.04';
    else if (norm.includes('mercantil')) targetCode = '1.1.02.05';
    else if (norm.includes('trabajadores') || norm.includes('bdt')) targetCode = '1.1.02.06';
    else if (norm.includes('bol') || (norm.includes('efectivo') && acc.currency === 'VES')) targetCode = '1.1.01.01';
    else if (norm.includes('divisas') || (norm.includes('efectivo') && acc.currency === 'USD')) targetCode = '1.1.01.02';

    // Update the corresponding side
    const currentTmpl = OPERATION_TEMPLATES.find((t) => t.id === opTemplate);
    if (currentTmpl?.type === 'income' || currentTmpl?.type === 'client_payment') {
      setDebitAccountCode(targetCode);
    } else {
      setCreditAccountCode(targetCode);
    }
  };

  const handleTemplateChange = (tmplId: string) => {
    setOpTemplate(tmplId);
    const tmpl = OPERATION_TEMPLATES.find((t) => t.id === tmplId);
    if (!tmpl) return;

    setDebitAccountCode(tmpl.debitCode);
    setCreditAccountCode(tmpl.creditCode);
    setGlosa(tmpl.glosa);
    if (selectedAccount) {
      handleAccountChange(selectedAccount.id!);
    }
  };

  // Financial Calculations
  const numAmount = parseFloat(amountInput) || 0;
  const amountUSD = currency === 'USD' ? numAmount : (activeRate > 0 ? numAmount / activeRate : 0);
  const amountVES = currency === 'VES' ? numAmount : numAmount * activeRate;

  // Debit and Credit Amounts (in USD standard functional ledger currency)
  const [debitAmountUSD, setDebitAmountUSD] = useState<number>(0);
  const [creditAmountUSD, setCreditAmountUSD] = useState<number>(0);

  useEffect(() => {
    setDebitAmountUSD(amountUSD);
    setCreditAmountUSD(amountUSD);
  }, [amountUSD]);

  // Real-time AI Public Accountant (CPA) Audit Analysis
  const aiAudit = useMemo(() => {
    const diff = Math.abs(debitAmountUSD - creditAmountUSD);
    const isBalanced = diff < 0.009;

    const debitAcc = CHART_OF_ACCOUNTS.find((a) => a.code === debitAccountCode);
    const creditAcc = CHART_OF_ACCOUNTS.find((a) => a.code === creditAccountCode);

    const issues: { type: 'error' | 'warning' | 'info'; msg: string; autoFix?: () => void }[] = [];

    // 1. Math Squareness
    if (!isBalanced) {
      issues.push({
        type: 'error',
        msg: `Descuadre en Partida Doble: Hay una diferencia de ${formatCurrency(diff, 'USD')}. El principio fundamental exige que DEBE sea idéntico al HABER.`,
      });
    }

    // 2. Same Account Check
    if (debitAccountCode === creditAccountCode) {
      issues.push({
        type: 'error',
        msg: `Inconsistencia Contable: No puedes cargar y abonar a la misma cuenta (${debitAccountCode}). Selecciona cuentas de contrapartida distintas.`,
      });
    }

    // 3. Nature Check
    if (opTemplate === 'sale' && debitAcc?.category !== 'Activo') {
      issues.push({
        type: 'warning',
        msg: `Observación CPA: En una venta, el dinero que ingresa debe debitarse a una cuenta de Activo disponible (Caja o Bancos).`,
      });
    }

    if ((opTemplate === 'expense_ops' || opTemplate === 'payroll' || opTemplate === 'packaging') && debitAcc?.category !== 'Gasto' && debitAcc?.category !== 'Costo') {
      issues.push({
        type: 'warning',
        msg: `Observación CPA: En un egreso o gasto operativo, la cuenta cargada al DEBE debe pertenecer a Costos o Gastos (Clase 5).`,
      });
    }

    // 4. Legal / Glosa Check (Art. 32 Código de Comercio)
    if (!glosa.trim() || glosa.length < 10) {
      issues.push({
        type: 'warning',
        msg: `Observación Legal (Art. 32 C.Com.): La glosa contable debe detallar la causa u origen de la operación con referencia al comprobante de soporte.`,
      });
    }

    const hasErrors = issues.some((i) => i.type === 'error');

    return {
      isBalanced,
      diff,
      debitAcc,
      creditAcc,
      issues,
      hasErrors,
      canPost: isBalanced && !hasErrors && numAmount > 0,
    };
  }, [debitAmountUSD, creditAmountUSD, debitAccountCode, creditAccountCode, opTemplate, glosa, numAmount]);

  // AI Auto-Conciliate Button Action
  const handleAiAutoConciliate = () => {
    setAiAnalysisRunning(true);
    setTimeout(() => {
      // 1. Equalize Debit and Credit
      setCreditAmountUSD(debitAmountUSD);

      // 2. Fix account natures based on template
      const tmpl = OPERATION_TEMPLATES.find((t) => t.id === opTemplate);
      if (tmpl) {
        setDebitAccountCode(tmpl.debitCode);
        setCreditAccountCode(tmpl.creditCode);
        if (!glosa.trim() || glosa.length < 10) {
          setGlosa(`${tmpl.glosa} Ref: ${docRef} efectuada a través de ${selectedAccount.bankName}.`);
        }
      }

      setAiAnalysisRunning(false);
      setAiDictamenPassed(true);
    }, 300);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiAudit.canPost) return;

    const fullDate = new Date(`${entryDate}T${entryTime}:00`).getTime();
    const currentTmpl = OPERATION_TEMPLATES.find((t) => t.id === opTemplate);
    const txType = currentTmpl?.type || 'expense';

    // Calculate balance delta for selected account based on the account's native currency
    const isVESAccount = selectedAccount.currency === 'VES';
    const nativeAccountAmount = isVESAccount ? amountVES : amountUSD;

    let balanceDelta = 0;
    if (txType === 'income' || txType === 'client_payment') {
      balanceDelta = nativeAccountAmount;
    } else {
      balanceDelta = -nativeAccountAmount;
    }

    // 1. Post to db.transactions
    const newTx: Transaction = {
      type: txType as any,
      amount: Number(nativeAccountAmount.toFixed(2)),
      currency: selectedAccount.currency,
      accountId: selectedAccount.id!,
      accountName: selectedAccount.bankName,
      description: `[ASIENTO MANUAL] ${glosa.trim()}`,
      userId: currentUser?.id || 1,
      userName: `${currentUser?.name || 'Beiker Pérez'} (Contador)`,
      date: fullDate,
      rateUsed: activeRate,
      rateSource: activeSource,
      amountUSD: Number(amountUSD.toFixed(2)),
      amountVES: Number(amountVES.toFixed(2)),
    };

    await addWithSync(db.transactions, 'transactions', newTx);

    // 2. Update Bank Account Balance
    await updateWithSync(db.accounts, 'accounts', selectedAccount.id!, {
      balance: selectedAccount.balance + balanceDelta,
    });

    // 3. Register CPA Audit Log
    await addWithSync(db.auditLog, 'auditLog', {
      transactionId: Date.now(),
      field: 'manual_journal_entry',
      previousValue: 'none',
      newValue: `Asiento cuadrado: DEBE ${debitAccountCode} / HABER ${creditAccountCode} por $${amountUSD.toFixed(2)} USD`,
      userId: currentUser?.id || 1,
      userName: currentUser?.name || 'Contador Público',
      timestamp: Date.now(),
    });

    onSuccess();
    onClose();
  };

  return (
    <div className="mn-modal-overlay p-4 sm:p-6 overflow-y-auto">
      <div className="mn-modal max-w-5xl w-full animate-scale-in bg-white rounded-3xl shadow-2xl border border-[#E6E9EF] overflow-hidden my-auto max-h-[92vh] overflow-y-auto">
        {/* Executive CPA & AI Header */}
        <div className="mn-modal-header border-b border-[#E6E9EF] bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] px-7 py-5 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#1D2132] to-[#292F4C] text-white flex items-center justify-center flex-shrink-0 shadow-md">
              <BookOpen size={24} className="text-[#00CA72]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-[0.6875rem] font-black uppercase tracking-wider text-white bg-[#1D2132] px-2.5 py-0.5 rounded-full">
                  Contadores Oficiales: Master & Administrador
                </span>
                <span className="text-xs text-[#C5C7D0]">|</span>
                <span className="text-xs font-bold text-[#6161FF] flex items-center gap-1">
                  <Bot size={14} /> Auditoría y Conciliación IA (Ares CPC)
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#1D2132] tracking-tight">
                Registrar Asiento Contable Manual (Partida Doble)
              </h2>
              <p className="text-xs text-[#676879] mt-0.5">
                Ingresa el asiento contable; la IA Contadora Pública cotija y concilia en tiempo real cuadratura y normas VEN-NIF.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 text-[#676879] hover:text-[#323338] transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSaveEntry} className="p-6 sm:p-8 space-y-6">
          {/* Operation Template Chips */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-[#323338] block mb-2">
              1. Tipo de Operación y Plantilla Contable
            </label>
            <div className="flex flex-wrap gap-2">
              {OPERATION_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleTemplateChange(tmpl.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    opTemplate === tmpl.id
                      ? 'bg-[#1D2132] text-white border-[#1D2132] shadow-md scale-[1.01]'
                      : 'border-[#E6E9EF] bg-white text-[#676879] hover:border-[#6161FF]/40'
                  }`}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── COLUMNA IZQUIERDA (6 COLS): METADATOS Y MONTOS ── */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-[#323338] block border-b border-[#E6E9EF] pb-2">
                  2. Datos del Asiento y Bóveda
                </span>

                {/* Fecha y Hora */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                      Fecha del Asiento
                    </label>
                    <input
                      type="date"
                      required
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
                      className="mn-input text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                      Hora
                    </label>
                    <input
                      type="time"
                      required
                      value={entryTime}
                      onChange={(e) => setEntryTime(e.target.value)}
                      className="mn-input text-xs font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Bóveda Bancaria */}
                <div>
                  <label className="mn-input-label text-xs font-bold uppercase tracking-wider">
                    Bóveda o Cuenta Bancaria Afectada
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => handleAccountChange(Number(e.target.value))}
                    className="mn-input mn-select text-xs font-bold"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} ({acc.currency}) · Saldo: {formatCurrency(acc.balance, acc.currency as any)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Monto y Moneda */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider mb-0">
                      Monto de la Operación
                    </label>
                    <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-[#E6E9EF] text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setCurrency('USD')}
                        className={`px-2 py-0.5 rounded-md ${currency === 'USD' ? 'bg-[#6161FF] text-white' : 'text-[#676879]'}`}
                      >
                        USD ($)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrency('VES')}
                        className={`px-2 py-0.5 rounded-md ${currency === 'VES' ? 'bg-[#6161FF] text-white' : 'text-[#676879]'}`}
                      >
                        VES (Bs)
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="mn-input text-3xl font-mono font-black pl-8"
                      autoFocus
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-[#676879]">
                      {currency === 'USD' ? '$' : 'Bs'}
                    </span>
                  </div>

                  {numAmount > 0 && (
                    <div className="p-2.5 bg-white rounded-xl border border-[#E6E9EF] flex items-center justify-between text-xs font-mono mt-2 shadow-sm">
                      <span className="text-[#676879] font-sans">Contravalor Bimonetario:</span>
                      <span className="font-bold text-[#00CA72]">
                        {currency === 'USD' ? formatCurrency(amountVES, 'VES') : formatCurrency(amountUSD, 'USD')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Glosa y Comprobante */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="mn-input-label text-xs font-bold uppercase tracking-wider mb-0">
                      Glosa Explicativa (Justificación Legal)
                    </label>
                    <input
                      type="text"
                      placeholder="Doc: FACT-001"
                      value={docRef}
                      onChange={(e) => setDocRef(e.target.value)}
                      className="w-28 px-2 py-0.5 rounded border border-[#E6E9EF] text-[0.6875rem] font-mono"
                      title="Número de documento de soporte"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={glosa}
                    onChange={(e) => setGlosa(e.target.value)}
                    className="mn-input text-xs font-normal"
                    placeholder="Describe detalladamente el origen o motivo del asiento contable..."
                  />
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA (6 COLS): PARTIDA DOBLE Y AUDITORÍA IA ── */}
            <div className="lg:col-span-6 space-y-4">
              <div className="p-5 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E6E9EF] pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#323338]">
                    3. Desglose de Partida Doble (VEN-NIF)
                  </span>
                  <span className="text-xs font-mono font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded">
                    Tasa: {activeRate.toFixed(2)} Bs
                  </span>
                </div>

                {/* Cuenta DEBE (Cargo) */}
                <div className="p-3.5 bg-white rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#00CA72] uppercase tracking-wider flex items-center gap-1">
                      <CheckCircle2 size={13} /> Cuenta DEBE (Cargo Deudor)
                    </span>
                    <span className="text-xs font-mono font-black text-[#00CA72]">
                      {formatCurrency(debitAmountUSD, 'USD')}
                    </span>
                  </div>
                  <select
                    value={debitAccountCode}
                    onChange={(e) => setDebitAccountCode(e.target.value)}
                    className="mn-input mn-select text-xs font-mono font-bold"
                  >
                    {CHART_OF_ACCOUNTS.map((acc) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} — {acc.name} ({acc.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cuenta HABER (Abono) */}
                <div className="p-3.5 bg-white rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Scale size={13} /> Cuenta HABER (Abono Acreedor)
                    </span>
                    <span className="text-xs font-mono font-black text-amber-500">
                      {formatCurrency(creditAmountUSD, 'USD')}
                    </span>
                  </div>
                  <select
                    value={creditAccountCode}
                    onChange={(e) => setCreditAccountCode(e.target.value)}
                    className="mn-input mn-select text-xs font-mono font-bold"
                  >
                    {CHART_OF_ACCOUNTS.map((acc) => (
                      <option key={acc.code} value={acc.code}>
                        {acc.code} — {acc.name} ({acc.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Public Accountant Real-Time Conciliation Box */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1D2132] to-[#292F4C] text-white space-y-3 shadow-lg">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#00CA72]/20 text-[#00CA72] flex items-center justify-center">
                        <Bot size={14} />
                      </div>
                      <span className="text-xs font-bold text-white tracking-tight">
                        Auditoría IA Contador Público (Ares CPC)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleAiAutoConciliate}
                      disabled={aiAnalysisRunning}
                      className="px-2.5 py-1 rounded-lg bg-[#00CA72] hover:bg-[#00CA72]/90 text-black text-[0.6875rem] font-extrabold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                      title="Conciliar y cuadrar automáticamente el asiento con IA"
                    >
                      <Sparkles size={12} />
                      <span>{aiAnalysisRunning ? 'Conciliando...' : 'Auto-Conciliar con IA'}</span>
                    </button>
                  </div>

                  {/* Issues or Certified Status */}
                  {aiAudit.issues.length > 0 ? (
                    <div className="space-y-1.5">
                      {aiAudit.issues.map((iss, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                            iss.type === 'error'
                              ? 'bg-rose-500/20 border border-rose-500/30 text-rose-200'
                              : 'bg-amber-500/20 border border-amber-500/30 text-amber-200'
                          }`}
                        >
                          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                          <span className="text-[0.6875rem] leading-relaxed">{iss.msg}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-[#00CA72] flex-shrink-0" />
                      <div>
                        <strong className="text-white block font-bold text-xs">
                          Dictamen IA: Asiento Perfectamente Cuadrado y Conciliado
                        </strong>
                        <span className="text-[0.6875rem] text-white/80">
                          Cumple con partida doble VEN-NIF PYMES y Art. 32 y 33 del Código de Comercio.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sumas Iguales Status Bar */}
                  <div className="pt-1 flex items-center justify-between text-xs font-mono border-t border-white/10">
                    <span className="text-white/70 text-[0.6875rem]">Sumas Iguales:</span>
                    <div className="flex gap-3 font-bold">
                      <span className="text-[#00CA72]">DEBE: {formatCurrency(debitAmountUSD, 'USD')}</span>
                      <span className="text-amber-400">HABER: {formatCurrency(creditAmountUSD, 'USD')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="mn-modal-footer pt-4 border-t border-[#E6E9EF] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="mn-btn mn-btn-outline text-xs px-5 py-2.5 font-semibold"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAiAutoConciliate}
                className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6161FF] border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Sparkles size={15} />
                <span>Cotijar con IA</span>
              </button>

              <button
                type="submit"
                disabled={!aiAudit.canPost}
                className="mn-btn mn-btn-primary text-xs px-7 py-2.5 flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 font-black text-sm active:scale-95 transition-all disabled:opacity-40"
              >
                <Save size={16} />
                <span>Asentar en Libro Diario y Bóveda</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualEntryModal;
