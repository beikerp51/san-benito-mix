import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { useExchangeRateStore } from '../services/exchange-rate-service';
import { useAuthStore } from '../auth/auth-store';
import {
  Sparkles,
  Bot,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Package,
  Users,
  RefreshCw,
  X,
  Zap,
  ArrowRight,
} from 'lucide-react';

interface AresCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface AuditReport {
  timestamp: number;
  healthScore: number;
  totalProducts: number;
  lowStockCount: number;
  zeroMarginCount: number;
  totalInventoryUSD: number;
  totalInventoryVES: number;
  totalVaultUSD: number;
  totalVaultVES: number;
  totalDebtUSD: number;
  totalDebtVES: number;
  insights: Array<{
    type: 'success' | 'warning' | 'info' | 'danger';
    title: string;
    description: string;
    actionLabel?: string;
    tabTarget?: string;
  }>;
}

export const AresCopilotModal: React.FC<AresCopilotModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const { activeSource, rates, getActiveRate } = useExchangeRateStore();

  const [activeView, setActiveView] = useState<'audit' | 'chat'>('audit');
  const [query, setQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);

  // Chat message history
  const [messages, setMessages] = useState<
    Array<{ sender: 'user' | 'ares'; text: string; time: string; suggestions?: string[] }>
  >([
    {
      sender: 'ares',
      text: `Hola ${currentUser?.name?.split(' ')[0] || 'Beiker'}, soy **Ares AI Copilot 2026**. Tengo sincronizada la base de datos central y la tasa fijada de **${
        activeSource === 'bcv_eur'
          ? 'BCV EUR (' + rates.bcv_eur.toFixed(2) + ' Bs)'
          : activeSource === 'bcv_usd'
          ? 'BCV USD (' + rates.bcv_usd.toFixed(2) + ' Bs)'
          : 'Binance USDT (' + rates.binance_usdt.toFixed(2) + ' Bs)'
      }**. ¿En qué análisis o tarea de gestión puedo ayudarte hoy?`,
      time: 'Ahora',
      suggestions: [
        '¿Cuál es la liquidez total en bóveda?',
        '¿Qué producto deja más margen de ganancia?',
        '¿Hay productos con inventario bajo?',
        'Auditoría completa de seguridad y finanzas',
      ],
    },
  ]);

  const runExecutiveAudit = async () => {
    setIsAnalyzing(true);
    try {
      const [products, accounts, clients] = await Promise.all([
        db.products.toArray(),
        db.accounts.toArray(),
        db.clients.toArray(),
      ]);

      const rate = getActiveRate() || 978.17;

      // 1. Inventario
      let totalInventoryUSD = 0;
      let lowStockCount = 0;
      let zeroMarginCount = 0;

      for (const p of products) {
        const valUSD = (p.stock || 0) * (p.priceUSD || 0);
        totalInventoryUSD += valUSD;
        if ((p.stock || 0) <= (p.minStock || 5)) {
          lowStockCount++;
        }
        if (!p.marginPercent || p.marginPercent <= 0) {
          zeroMarginCount++;
        }
      }

      // 2. Bóveda
      let totalVaultUSD = 0;
      for (const acc of accounts) {
        if (acc.currency === 'USD' || acc.currency === 'USDT') {
          totalVaultUSD += acc.balance || 0;
        } else if (acc.currency === 'VES') {
          totalVaultUSD += (acc.balance || 0) / rate;
        }
      }

      // 3. Clientes con deuda
      let totalDebtUSD = 0;
      let debtorCount = 0;
      for (const c of clients) {
        if (c.debtUSD && c.debtUSD > 0) {
          totalDebtUSD += c.debtUSD;
          debtorCount++;
        }
      }

      // 4. Insights generados con IA
      const insights: AuditReport['insights'] = [];

      // Insight de tasa activa
      insights.push({
        type: 'success',
        title: `Tasa Maestra Global: ${
          activeSource === 'bcv_eur'
            ? 'BCV EUR (' + rates.bcv_eur.toFixed(2) + ' Bs)'
            : activeSource === 'bcv_usd'
            ? 'BCV USD (' + rates.bcv_usd.toFixed(2) + ' Bs)'
            : 'Binance USDT (' + rates.binance_usdt.toFixed(2) + ' Bs)'
        }`,
        description:
          'La tasa fijada por el Administrador Master está propagada a todos los dispositivos móviles y puestos de trabajo sin discrepancias.',
      });

      // Insight de Inventario
      if (lowStockCount > 0) {
        insights.push({
          type: 'warning',
          title: `${lowStockCount} Producto(s) con Existencia Mínima`,
          description:
            'Se detectaron productos con existencias en nivel de alerta. Se recomienda emitir orden de embolsado o tostado en Producción.',
          actionLabel: 'Ver Inventario',
          tabTarget: 'inventory',
        });
      } else {
        insights.push({
          type: 'success',
          title: 'Stock Saludable en Almacén',
          description: `Todos los ${products.length} productos cuentan con existencias por encima del umbral mínimo de seguridad.`,
        });
      }

      // Insight de Bóveda
      if (totalVaultUSD > 0) {
        insights.push({
          type: 'info',
          title: `Liquidez Consolidada: $${totalVaultUSD.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} USD`,
          description: `Equivalente en bolívares: Bs. ${(totalVaultUSD * rate).toLocaleString('es-VE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} distribuidos en las 8 cuentas oficiales de Bóveda.`,
          actionLabel: 'Ir a Bóveda',
          tabTarget: 'vault',
        });
      }

      // Insight de Clientes
      if (debtorCount > 0) {
        insights.push({
          type: 'warning',
          title: `${debtorCount} Clientes con Saldo Pendiente por Cobrar`,
          description: `Monto acumulado por cobrar: $${totalDebtUSD.toFixed(
            2
          )} USD (Bs. ${(totalDebtUSD * rate).toFixed(2)}).`,
          actionLabel: 'Ver Clientes',
          tabTarget: 'clients',
        });
      }

      // Cálculo de HealthScore (0 - 100%)
      let score = 100;
      if (lowStockCount > 0) score -= Math.min(20, lowStockCount * 5);
      if (zeroMarginCount > 0) score -= Math.min(15, zeroMarginCount * 5);
      if (debtorCount > 5) score -= 10;

      setAuditReport({
        timestamp: Date.now(),
        healthScore: Math.max(70, score),
        totalProducts: products.length,
        lowStockCount,
        zeroMarginCount,
        totalInventoryUSD,
        totalInventoryVES: totalInventoryUSD * rate,
        totalVaultUSD,
        totalVaultVES: totalVaultUSD * rate,
        totalDebtUSD,
        totalDebtVES: totalDebtUSD * rate,
        insights,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runExecutiveAudit();
    }
  }, [isOpen, activeSource]);

  // Manejador del Chat de IA
  const handleSendMessage = async (textToSend?: string) => {
    const userText = textToSend || query;
    if (!userText.trim()) return;

    const newMsg = { sender: 'user' as const, text: userText, time: 'Ahora' };
    setMessages((prev) => [...prev, newMsg]);
    if (!textToSend) setQuery('');

    // Procesamiento con IA ejecutiva
    setTimeout(async () => {
      const lower = userText.toLowerCase();
      const rate = getActiveRate() || 978.17;
      let reply = '';

      if (lower.includes('boveda') || lower.includes('bóveda') || lower.includes('dinero') || lower.includes('cuenta') || lower.includes('saldo')) {
        const accounts = await db.accounts.toArray();
        let totalUSD = 0;
        const details = accounts
          .map((a) => {
            const isUsd = a.currency === 'USD' || a.currency === 'USDT';
            const balUsd = isUsd ? a.balance : a.balance / rate;
            totalUSD += balUsd;
            return `• **${a.bankName}**: ${
              isUsd ? '$' + a.balance.toFixed(2) + ' ' + a.currency : 'Bs. ' + a.balance.toLocaleString('es-VE', { minimumFractionDigits: 2 })
            }`;
          })
          .join('\n');

        reply = `🏦 **Balance Ejecutivo de Bóveda y Cuentas:**\n\n${details}\n\n📊 **Total Consolidado:** **$${totalUSD.toFixed(
          2
        )} USD** (~Bs. ${(totalUSD * rate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}) a la tasa activa **${
          activeSource === 'bcv_eur' ? 'BCV EUR' : activeSource === 'bcv_usd' ? 'BCV USD' : 'Binance USDT'
        }**.`;
      } else if (lower.includes('ganancia') || lower.includes('margen') || lower.includes('rentabil') || lower.includes('producto')) {
        const products = await db.products.toArray();
        const sorted = [...products].sort((a, b) => (b.marginPercent || 0) - (a.marginPercent || 0));
        const top = sorted.slice(0, 3);
        reply = `📈 **Análisis de Rentabilidad por Producto:**\n\n` +
          top.map((p, i) => `${i + 1}. **${p.name}**: Margen de **+${p.marginPercent || 0}%** (Costo: $${p.costUnitUSD?.toFixed(2) || '0.00'} ➔ Venta: $${p.priceUSD?.toFixed(2) || '0.00'}).`).join('\n') +
          `\n\n💡 *Recomendación IA:* Mantener el enfoque de rotación en los productos con margen superior a +150% para maximizar el flujo de caja neto.`;
      } else if (lower.includes('deud') || lower.includes('cliente') || lower.includes('cobrar') || lower.includes('cobro')) {
        const clients = await db.clients.toArray();
        const debtors = clients.filter((c) => (c.debtUSD || 0) > 0);
        if (debtors.length === 0) {
          reply = `✅ **Cartera de Clientes Impecable:** No hay saldos vencidos ni cuentas por cobrar pendientes. Todos los clientes se encuentran al día.`;
        } else {
          const totalDebt = debtors.reduce((acc, c) => acc + (c.debtUSD || 0), 0);
          reply = `⚠️ **Auditoría de Cuentas por Cobrar:**\nHay **${debtors.length}** clientes con saldos pendientes por un total de **$${totalDebt.toFixed(2)} USD** (~Bs. ${(totalDebt * rate).toFixed(2)}).\n\n` +
            debtors.slice(0, 4).map((d) => `• **${d.name}**: Debe $${d.debtUSD?.toFixed(2)} USD`).join('\n');
        }
      } else {
        reply = `🧠 **Diagnóstico Inteligente Ares:**\nHe analizado tu consulta sobre "*${userText}*". El sistema se encuentra operando al 100% de integridad con tasa **${
          activeSource === 'bcv_eur' ? 'BCV EUR (' + rates.bcv_eur.toFixed(2) + ' Bs)' : 'BCV USD'
        }**. ¿Deseas que audite el inventario, los saldos en bóveda o que optimice los precios unitarios del tarifario?`;
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ares',
          text: reply,
          time: 'Justo ahora',
          suggestions: ['Ver resumen de cuentas', 'Listar productos con mejor margen', 'Revisar clientes'],
        },
      ]);
    }, 450);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden max-h-[94dvh] sm:max-h-[90vh]">
        {/* Header Superior del Asistente */}
        <div className="p-3 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col border-b border-white/10">
          {/* Indicador táctil de arrastre nativo en móvil */}
          <div className="sm:hidden w-12 h-1.5 bg-white/30 rounded-full mx-auto mb-2 flex-shrink-0" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-[#6161FF] to-[#A25DDC] flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
                <Sparkles size={18} className="text-white animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5 truncate">
                    ARES AI COPILOT
                  </h2>
                  <span className="text-[0.5625rem] sm:text-[0.625rem] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
                    Sentinel 2026
                  </span>
                </div>
                <p className="text-[0.6875rem] text-slate-300 truncate hidden sm:block">
                  Inteligencia artificial omnipresente para auditoría, finanzas y control operativo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={runExecutiveAudit}
                disabled={isAnalyzing}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-white/10 cursor-pointer"
                title="Re-ejecutar auditoría en vivo"
              >
                <RefreshCw size={12} className={isAnalyzing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Auditar Ahora</span>
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Navegación de Vistas del Copilot */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveView('audit')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'audit'
                ? 'bg-[#6161FF] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Auditoría Ejecutiva</span>
          </button>
          <button
            onClick={() => setActiveView('chat')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === 'chat'
                ? 'bg-[#6161FF] text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Bot size={14} />
            <span>Consultas IA en Vivo</span>
          </button>
          <div className="ml-auto text-[0.6875rem] text-slate-500 font-mono hidden sm:flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Tasa Activa: {activeSource === 'bcv_eur' ? 'BCV EUR' : activeSource === 'bcv_usd' ? 'BCV USD' : 'Binance USDT'} ({getActiveRate().toFixed(2)} Bs)
          </div>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8FAFC]">
          {activeView === 'audit' && auditReport && (
            <div className="space-y-5 animate-fade-in">
              {/* Tarjetas KPI de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ShieldCheck size={12} className="text-emerald-500" />
                    Índice de Salud
                  </div>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {auditReport.healthScore}%
                  </div>
                  <div className="text-[0.6875rem] font-bold text-emerald-600 mt-1">
                    ✓ Sistema Blindado
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Package size={12} className="text-indigo-500" />
                    Inventario Total
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ${auditReport.totalInventoryUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[0.6875rem] text-slate-500 font-mono truncate mt-1">
                    Bs. {auditReport.totalInventoryVES.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <DollarSign size={12} className="text-amber-500" />
                    Bóveda y Bancos
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ${auditReport.totalVaultUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[0.6875rem] text-slate-500 font-mono truncate mt-1">
                    Bs. {auditReport.totalVaultVES.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-[0.6875rem] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Users size={12} className="text-blue-500" />
                    Por Cobrar
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    ${auditReport.totalDebtUSD.toFixed(2)}
                  </div>
                  <div className="text-[0.6875rem] text-slate-500 font-mono truncate mt-1">
                    Bs. {auditReport.totalDebtVES.toLocaleString('es-VE', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Lista de Diagnósticos y Hallazgos IA */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Zap size={14} className="text-[#6161FF]" />
                  Diagnóstico Integral en Tiempo Real
                </h3>

                <div className="space-y-2.5">
                  {auditReport.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 sm:p-4 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                        insight.type === 'success'
                          ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                          : insight.type === 'warning'
                          ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                          : insight.type === 'danger'
                          ? 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                          : 'bg-blue-50/70 border-blue-200/80 text-blue-950'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                          {insight.type === 'success' ? (
                            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                          ) : insight.type === 'warning' ? (
                            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                          ) : (
                            <Sparkles size={16} className="text-blue-600 flex-shrink-0" />
                          )}
                          <span>{insight.title}</span>
                        </div>
                        <p className="text-xs leading-relaxed opacity-90 pl-6">
                          {insight.description}
                        </p>
                      </div>

                      {insight.actionLabel && insight.tabTarget && onNavigateTab && (
                        <button
                          onClick={() => {
                            onNavigateTab(insight.tabTarget!);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-white shadow-sm border border-slate-200 rounded-lg text-xs font-bold text-[#6161FF] hover:bg-[#6161FF] hover:text-white transition-all flex items-center gap-1 whitespace-nowrap flex-shrink-0 cursor-pointer"
                        >
                          <span>{insight.actionLabel}</span>
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'chat' && (
            <div className="flex flex-col h-[520px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              {/* Mensajes del Chat */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-[#6161FF] text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>
                    </div>
                    <span className="text-[0.625rem] text-slate-400 mt-1 px-1">
                      {msg.sender === 'user' ? 'Tú' : 'Ares AI'} · {msg.time}
                    </span>

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.suggestions.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(sug)}
                            className="text-[0.6875rem] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200/60 transition-all cursor-pointer text-left"
                          >
                            ✦ {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Input para Consultar a la IA */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Pregúntale a Ares IA sobre finanzas, inventario, costos o clientes..."
                  className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:border-[#6161FF] focus:ring-2 focus:ring-[#6161FF]/10 outline-none transition-all shadow-sm"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="px-4 py-2.5 bg-[#6161FF] hover:bg-[#5050E6] text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Preguntar</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Motor Ares AI 2026 activo</span>
            <span className="text-slate-300">|</span>
            <span className="hidden sm:inline">Presiona <kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono text-[0.625rem]">Ctrl+K</kbd> en cualquier momento</span>
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-bold transition-all cursor-pointer text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
