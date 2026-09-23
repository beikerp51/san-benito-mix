import React, { useState, useEffect, useMemo } from 'react';
import { db, type DispatchRecord, type Product } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { useAuthStore } from '../../auth/auth-store';
import { DispatchModal } from './dispatch-modal';
import {
  Send,
  Package,
  Search,
  Calendar,
  User,
  ShieldCheck,
  Printer,
  Plus,
  ArrowRight,
  Clock,
  DollarSign,
  FileText,
  X,
  Share2,
  Sparkles,
  Layers,
} from 'lucide-react';

export const DispatchesView: React.FC = () => {
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'fabiana_beiker'>('all');
  const [showModal, setShowModal] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<DispatchRecord | null>(null);

  const currentUser = useAuthStore((s) => s.currentUser);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  useEffect(() => {
    loadDispatches();

    const handleSync = () => {
      loadDispatches();
    };
    window.addEventListener('sbm:sync', handleSync);
    window.addEventListener('sbm:delivery_notification', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
      window.removeEventListener('sbm:delivery_notification', handleSync);
    };
  }, []);

  const loadDispatches = async () => {
    const list = await db.dispatches.reverse().sortBy('date');
    setDispatches(list);
  };

  // Filtered dispatches based on tab & search query
  const filteredDispatches = useMemo(() => {
    let result = dispatches;

    // Filter by Fabiana -> Beiker
    if (activeFilter === 'fabiana_beiker') {
      result = result.filter(
        (d) =>
          d.receiverName.toLowerCase().includes('beiker') ||
          d.deliveredBy.toLowerCase().includes('fabiana')
      );
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.productName.toLowerCase().includes(q) ||
          d.receiverName.toLowerCase().includes(q) ||
          d.deliveredBy.toLowerCase().includes(q) ||
          (d.notes && d.notes.toLowerCase().includes(q)) ||
          (d.items && d.items.some((it) => it.productName.toLowerCase().includes(q)))
      );
    }

    return result;
  }, [dispatches, activeFilter, search]);

  const totalUnitsDelivered = filteredDispatches.reduce(
    (sum, d) => sum + (d.totalUnits || d.quantity),
    0
  );
  const totalValueDeliveredUSD = filteredDispatches.reduce((sum, d) => sum + d.totalUSD, 0);

  const fabianaToBeikerCount = dispatches.filter(
    (d) =>
      d.receiverName.toLowerCase().includes('beiker') ||
      d.deliveredBy.toLowerCase().includes('fabiana')
  ).length;

  const handleShareWhatsApp = (record: DispatchRecord) => {
    const itemsText = record.items
      ? record.items
          .map(
            (it) =>
              `• ${it.quantity}x ${it.productName} = $${it.totalUSD.toFixed(2)} (Quedan: ${it.newStock} uds)`
          )
          .join('\n')
      : `• ${record.quantity}x ${record.productName} = $${record.totalUSD.toFixed(2)}`;

    const text =
      `📦 *SAN BENITO MIX - COMPROBANTE DE ENTREGA*\n` +
      `*Nº:* DESP-${String(record.id || 1).padStart(5, '0')}\n` +
      `*Fecha:* ${new Date(record.date).toLocaleString('es-VE')}\n\n` +
      `*Entregado Por:* ${record.deliveredBy}\n` +
      `*Recibido Por:* ${record.receiverName}\n\n` +
      `*DETALLE DE PRODUCTOS:*\n${itemsText}\n\n` +
      `*Total Unidades:* ${record.totalUnits || record.quantity} uds\n` +
      `*Total Importe:* $${record.totalUSD.toFixed(2)} USD (≈ Bs. ${formatCurrency(record.totalUSD * activeRate, 'VES')})\n` +
      `*Estado:* ✅ Mercancía Entregada y Descontada de Inventario\n` +
      (record.notes ? `*Observación:* ${record.notes}\n` : '') +
      `\n_San Benito Mix Administración Central 2026_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-5 animate-fade-in text-[#323338] dark:text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-md bg-[#6161FF]/10 text-[#6161FF] uppercase tracking-wider">
              Control de Entregas y Salidas
            </span>
            <span className="text-xs text-[#C5C7D0]">·</span>
            <span className="text-xs font-semibold text-[#00CA72] flex items-center gap-1">
              <ShieldCheck size={12} /> Descuento Automático de Stock Activo
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#323338] dark:text-white">
            Entregas de Mercancía de la Administradora
          </h2>
          <p className="text-xs text-[#676879] dark:text-slate-400 mt-0.5">
            Registro cronológico y comprobantes de entrega multi-producto con trazabilidad de stock
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="mn-btn mn-btn-primary text-xs py-2.5 px-4 flex items-center gap-2 shadow-md shadow-[#6161FF]/20 active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Send size={15} />
          <span>+ Nueva Entrega Multi-Producto</span>
        </button>
      </div>

      {/* Filter Tabs: All vs Fabiana -> Beiker */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === 'all'
              ? 'bg-[#6161FF] text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          <Layers size={14} />
          <span>Todos los Despachos ({dispatches.length})</span>
        </button>

        <button
          onClick={() => setActiveFilter('fabiana_beiker')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeFilter === 'fabiana_beiker'
              ? 'bg-gradient-to-r from-emerald-600 to-[#6161FF] text-white shadow-sm'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
          }`}
        >
          <Sparkles size={13} />
          <span>⭐ Entregas Fabiana ➔ Beiker ({fabianaToBeikerCount})</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="mn-card p-4 flex items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-[#6161FF] flex items-center justify-center flex-shrink-0">
            <Package size={22} />
          </div>
          <div>
            <div className="text-xs text-[#676879] dark:text-slate-400 font-medium">
              {activeFilter === 'fabiana_beiker' ? 'Unidades a Beiker' : 'Unidades Entregadas a Dirección'}
            </div>
            <div className="text-2xl font-black text-[#323338] dark:text-white font-mono">
              {totalUnitsDelivered} uds
            </div>
            <div className="text-[0.6875rem] text-[#00CA72] font-semibold mt-0.5">
              Descontadas de inventario
            </div>
          </div>
        </div>

        <div className="mn-card p-4 flex items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00CA72] flex items-center justify-center flex-shrink-0">
            <DollarSign size={22} />
          </div>
          <div>
            <div className="text-xs text-[#676879] dark:text-slate-400 font-medium">
              Valor Total Entregado
            </div>
            <div className="text-2xl font-black text-[#323338] dark:text-white font-mono">
              {formatCurrency(totalValueDeliveredUSD, 'USD')}
            </div>
            <div className="text-[0.6875rem] text-[#676879] dark:text-slate-400 font-mono mt-0.5">
              ≈ {formatCurrency(totalValueDeliveredUSD * activeRate, 'VES')}
            </div>
          </div>
        </div>

        <div className="mn-card p-4 flex items-center gap-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[#0086C9] flex items-center justify-center flex-shrink-0">
            <FileText size={22} />
          </div>
          <div>
            <div className="text-xs text-[#676879] dark:text-slate-400 font-medium">
              Comprobantes Certificados
            </div>
            <div className="text-2xl font-black text-[#323338] dark:text-white font-mono">
              {filteredDispatches.length} actas
            </div>
            <div className="text-[0.6875rem] text-[#6161FF] font-semibold mt-0.5">
              100% Inmutables y auditables
            </div>
          </div>
        </div>
      </div>

      {/* Board Card */}
      <div className="mn-card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="mn-group-header bg-white dark:bg-slate-900 border-b border-[#E6E9EF] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <div className="mn-group-color" style={{ background: '#6161FF' }} />
            <span className="text-sm font-bold text-[#323338] dark:text-white">
              {activeFilter === 'fabiana_beiker'
                ? 'Historial de Entregas Fabiana ➔ Beiker'
                : 'Historial de Mercancía Entregada'}
            </span>
            <span className="text-xs text-[#676879] dark:text-slate-400 font-normal">
              ({filteredDispatches.length} entregas)
            </span>
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Buscar por producto, receptor o nota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mn-input text-xs py-1.5 w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Mobile View: Cards */}
        <div className="md:hidden space-y-3 p-3 bg-slate-50/50 dark:bg-slate-950/30">
          {filteredDispatches.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <Package size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No se encontraron entregas con el criterio seleccionado.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 text-xs font-bold text-[#6161FF] bg-[#6161FF]/10 px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Registrar Nueva Entrega
              </button>
            </div>
          ) : (
            filteredDispatches.map((record) => {
              const isMulti = record.items && record.items.length > 1;
              return (
                <div
                  key={record.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3"
                >
                  {/* Top Bar: Title & Total Units */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl flex-shrink-0 shadow-2xs">
                        {record.productPhoto || (isMulti ? '📦' : '🥜')}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {record.productName}
                          </h4>
                          {isMulti && (
                            <span className="text-[0.625rem] bg-indigo-50 dark:bg-indigo-950/60 text-[#6161FF] font-bold px-1.5 py-0.5 rounded">
                              {record.items!.length} tipos
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[0.6875rem] text-slate-500 mt-0.5">
                          <Calendar size={11} className="text-slate-400" />
                          <span>{new Date(record.date).toLocaleDateString('es-VE')}</span>
                          <span>·</span>
                          <Clock size={11} className="text-slate-400" />
                          <span>
                            {new Date(record.date).toLocaleTimeString('es-VE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-xl bg-[#6161FF]/10 text-[#6161FF] font-black font-mono text-xs flex-shrink-0">
                      -{record.totalUnits || record.quantity} uds
                    </span>
                  </div>

                  {/* Multi-item Preview list if available */}
                  {isMulti && (
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                      <span className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider block">
                        Productos incluidos:
                      </span>
                      {record.items!.slice(0, 3).map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[0.6875rem]">
                          <span className="text-slate-700 dark:text-slate-300 truncate">
                            {it.quantity}x {it.productName}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            ${it.totalUSD.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {record.items!.length > 3 && (
                        <span className="text-[0.625rem] text-slate-400 italic">
                          +{record.items!.length - 3} productos adicionales...
                        </span>
                      )}
                    </div>
                  )}

                  {/* Sender & Receiver + Total Amount */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[0.6875rem] text-slate-600 dark:text-slate-400">
                        <User size={11} className="text-[#6161FF]" />
                        <span>Por: <strong>{record.deliveredBy}</strong></span>
                      </div>
                      <div className="flex items-center gap-1 text-[0.6875rem] text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={11} className="text-[#00CA72]" />
                        <span>Para: <strong>{record.receiverName}</strong></span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black font-mono text-sm text-slate-900 dark:text-white">
                        {formatCurrency(record.totalUSD, 'USD')}
                      </div>
                      <div className="text-[0.625rem] text-slate-500 font-mono">
                        ≈ {formatCurrency(record.totalUSD * activeRate, 'VES')}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setViewingRecord(record)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-[#6161FF]/10 text-[#6161FF] font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98 cursor-pointer"
                    >
                      <FileText size={14} />
                      <span>Ver Comprobante</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(record)}
                      className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors cursor-pointer"
                      title="Compartir por WhatsApp"
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="mn-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>FECHA Y HORA</th>
                <th>PRODUCTOS ENTREGADOS</th>
                <th style={{ width: 120, textAlign: 'right' }}>TOTAL UDS</th>
                <th>ENTREGADO POR</th>
                <th>RECIBIDO POR</th>
                <th style={{ width: 140, textAlign: 'right' }}>VALOR TOTAL</th>
                <th style={{ width: 110, textAlign: 'center' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-[#676879]">
                    No se han registrado entregas en esta sección.{' '}
                    <button
                      onClick={() => setShowModal(true)}
                      className="text-[#6161FF] font-semibold underline ml-1 cursor-pointer"
                    >
                      Registrar primera entrega
                    </button>
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((record) => {
                  const isMulti = record.items && record.items.length > 1;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Date */}
                      <td className="mn-table-cell text-xs text-[#676879] dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-[#A0A4B8]" />
                          <span className="font-semibold text-[#323338] dark:text-white">
                            {new Date(record.date).toLocaleDateString('es-VE')}
                          </span>
                        </div>
                        <div className="text-[0.625rem] text-[#A0A4B8] mt-0.5 ml-4">
                          {new Date(record.date).toLocaleTimeString('es-VE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Product */}
                      <td className="mn-table-cell">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{record.productPhoto || (isMulti ? '📦' : '🥜')}</span>
                          <div>
                            <div className="font-bold text-xs text-[#323338] dark:text-white flex items-center gap-1.5">
                              <span>{record.productName}</span>
                              {isMulti && (
                                <span className="text-[0.625rem] bg-indigo-50 dark:bg-indigo-950/60 text-[#6161FF] px-1.5 py-0.5 rounded font-bold">
                                  {record.items!.length} ítems
                                </span>
                              )}
                            </div>
                            {record.notes && (
                              <div className="text-[0.6875rem] text-[#676879] dark:text-slate-400 italic truncate max-w-xs">
                                "{record.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="mn-table-cell text-right">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-[#6161FF]/10 text-[#6161FF] font-black font-mono text-xs">
                          -{record.totalUnits || record.quantity} uds
                        </span>
                      </td>

                      {/* Delivered By */}
                      <td className="mn-table-cell text-xs text-[#323338] dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-[#6161FF]" />
                          <span className="font-semibold">{record.deliveredBy}</span>
                        </div>
                      </td>

                      {/* Receiver */}
                      <td className="mn-table-cell text-xs text-[#323338] dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck size={12} className="text-[#00CA72]" />
                          <span className="font-bold text-[#00CA72]">{record.receiverName}</span>
                        </div>
                      </td>

                      {/* Value */}
                      <td className="mn-table-cell text-right font-mono text-xs">
                        <div className="font-black text-[#323338] dark:text-white">
                          {formatCurrency(record.totalUSD, 'USD')}
                        </div>
                        <div className="text-[0.625rem] text-[#676879] dark:text-slate-400">
                          ≈ {formatCurrency(record.totalUSD * activeRate, 'VES')}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="mn-table-cell text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setViewingRecord(record)}
                            className="p-1.5 rounded-lg text-[#6161FF] hover:bg-[#6161FF]/10 transition-colors cursor-pointer"
                            title="Ver Comprobante de Entrega"
                          >
                            <FileText size={16} />
                          </button>
                          <button
                            onClick={() => handleShareWhatsApp(record)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                            title="Enviar Comprobante por WhatsApp"
                          >
                            <Share2 size={16} />
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

      {/* Floating Action Button (FAB) Mobile */}
      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed bottom-24 right-4 z-40 bg-gradient-to-r from-[#6161FF] to-[#7B51EC] text-white px-4 py-3 rounded-2xl shadow-xl shadow-indigo-500/35 flex items-center gap-2 active:scale-95 transition-all font-black text-xs cursor-pointer border border-white/20"
        title="Registrar Nueva Entrega"
      >
        <Send size={16} />
        <span>Nueva Entrega</span>
      </button>

      {/* Modal for New Dispatch */}
      {showModal && (
        <DispatchModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            loadDispatches();
          }}
        />
      )}

      {/* Modal to View / Print Existing Slip */}
      {viewingRecord && (
        <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto z-50">
          <div className="mn-modal max-w-2xl w-full animate-scale-in bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 text-[#323338] dark:text-slate-100 my-0 sm:my-auto">
            {/* Native drag handle on mobile */}
            <div className="md:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-3 flex-shrink-0" />

            {/* Slip Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <img
                  src="/san-benito-logo.jpg"
                  alt="San Benito Mix"
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-amber-400 shadow-md"
                />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">SAN BENITO MIX</h3>
                  <span className="text-[0.625rem] text-slate-500 font-mono">
                    Comprobante DESP-{String(viewingRecord.id || 1).padStart(5, '0')} · {new Date(viewingRecord.date).toLocaleString('es-VE')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Slip Body */}
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[0.6875rem] text-slate-500 uppercase block mb-0.5">Entregado Por</span>
                  <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User size={14} className="text-[#6161FF]" />
                    {viewingRecord.deliveredBy}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[0.6875rem] text-slate-500 uppercase block mb-0.5">Recibido Por</span>
                  <span className="font-bold text-sm text-emerald-600 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    {viewingRecord.receiverName}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[0.6875rem] font-bold text-slate-600 dark:text-slate-300 uppercase flex items-center justify-between">
                  <span>Productos Entregados ({viewingRecord.items?.length || 1})</span>
                  <span>Cantidad & Subtotal</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
                  {viewingRecord.items && viewingRecord.items.length > 0 ? (
                    viewingRecord.items.map((it, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{it.productPhoto || '📦'}</span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {it.productName}
                            </span>
                            <span className="text-[0.6875rem] text-slate-500">
                              Stock anterior: {it.previousStock} ➔ Restaron: <strong className="text-emerald-600">{it.newStock} uds</strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <span className="font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded-lg text-xs inline-block mb-0.5">
                            {it.quantity} uds
                          </span>
                          <div className="font-black text-xs text-slate-900 dark:text-white">
                            {formatCurrency(it.totalUSD, 'USD')}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 flex items-center justify-between">
                      <span className="font-bold">{viewingRecord.productName}</span>
                      <span className="font-mono text-emerald-600 font-bold">{viewingRecord.quantity} uds</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Valuation Summary */}
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-[#6161FF]/10 to-transparent border border-emerald-300 dark:border-emerald-800 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[0.6875rem] text-slate-500 uppercase block">
                    Total Entregado ({viewingRecord.totalUnits || viewingRecord.quantity} unidades físicas)
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    {formatCurrency(viewingRecord.totalUSD, 'USD')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[0.6875rem] text-slate-500 block">Equivalente en Bolívares</span>
                  <span className="text-base font-black text-[#6161FF]">
                    ≈ {formatCurrency(viewingRecord.totalVES || viewingRecord.totalUSD * activeRate, 'VES')}
                  </span>
                </div>
              </div>

              {viewingRecord.notes && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 text-[0.6875rem]">
                  <strong>Observación: </strong> {viewingRecord.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-4 border-t border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-6 text-center">
                <div className="pt-6 border-t border-gray-300 dark:border-slate-700">
                  <span className="text-[0.6875rem] text-slate-700 dark:text-slate-300 font-bold block">
                    Firma Administradora
                  </span>
                  <span className="text-[0.625rem] text-slate-400">{viewingRecord.deliveredBy}</span>
                </div>
                <div className="pt-6 border-t border-gray-300 dark:border-slate-700">
                  <span className="text-[0.6875rem] text-slate-700 dark:text-slate-300 font-bold block">
                    Firma Receptor / Master
                  </span>
                  <span className="text-[0.625rem] text-slate-400">{viewingRecord.receiverName}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Imprimir</span>
                </button>
                <button
                  onClick={() => handleShareWhatsApp(viewingRecord)}
                  className="mn-btn text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 rounded-xl transition-all cursor-pointer"
                >
                  <Share2 size={14} />
                  <span>WhatsApp</span>
                </button>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="mn-btn mn-btn-primary text-xs py-2 px-5 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
