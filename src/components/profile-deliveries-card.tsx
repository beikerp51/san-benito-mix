import React, { useState, useEffect } from 'react';
import { db, type DispatchRecord } from '../db/database';
import { useAuthStore } from '../auth/auth-store';
import { useExchangeRateStore, formatCurrency } from '../services/exchange-rate-service';
import { DispatchModal } from '../modules/inventory/dispatch-modal';
import {
  Send,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  Printer,
  Share2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

export const ProfileDeliveriesCard: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [viewingRecord, setViewingRecord] = useState<DispatchRecord | null>(null);

  const isMaster = currentUser?.role === 'master';

  const loadData = async () => {
    const all = await db.dispatches.reverse().sortBy('date');
    // Filter dispatches involving Fabiana and Beiker
    const relevant = all.filter((d) => {
      const rec = (d.receiverName || '').toLowerCase();
      const del = (d.deliveredBy || '').toLowerCase();
      return rec.includes('beiker') || del.includes('fabiana');
    });
    setDispatches(relevant);
  };

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('sbm:sync', handleSync);
    window.addEventListener('sbm:delivery_notification', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
      window.removeEventListener('sbm:delivery_notification', handleSync);
    };
  }, []);

  const totalDeliveredUSD = dispatches.reduce((sum, d) => sum + d.totalUSD, 0);
  const totalUnits = dispatches.reduce((sum, d) => sum + (d.totalUnits || d.quantity), 0);

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
      `📦 *SAN BENITO MIX - COMPROBANTE OFICIAL DE ENTREGA*\n` +
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
    <div className="mn-card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/50 via-indigo-50/30 to-transparent dark:from-slate-800/60 dark:to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-[#6161FF] text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20">
            <Package size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[0.6875rem] font-black uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {isMaster ? 'Entregas Recibidas' : 'Mis Entregas a Dirección'}
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ShieldCheck size={13} className="text-[#00CA72]" /> Descuento Automático Activo
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
              {isMaster
                ? 'Entregas Recibidas de Fabiana Acosta'
                : 'Entregas Realizadas a Beiker Pérez'}
            </h3>
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="mn-btn mn-btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md shadow-[#6161FF]/20 cursor-pointer self-start sm:self-auto"
        >
          <Send size={14} />
          <span>+ Registrar Entrega Multi-Producto</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800 text-xs">
        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <span className="text-[0.6875rem] font-bold text-slate-500 uppercase block mb-0.5">
            Total Entregas
          </span>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {dispatches.length} actas
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <span className="text-[0.6875rem] font-bold text-slate-500 uppercase block mb-0.5">
            Unidades Físicas
          </span>
          <div className="text-xl font-black text-[#6161FF] font-mono">
            {totalUnits} uds
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <span className="text-[0.6875rem] font-bold text-slate-500 uppercase block mb-0.5">
            Valor Total Acumulado
          </span>
          <div className="text-xl font-black text-[#00CA72] font-mono">
            {formatCurrency(totalDeliveredUSD, 'USD')}
          </div>
          <span className="text-[0.625rem] text-slate-400 font-mono">
            ≈ {formatCurrency(totalDeliveredUSD * activeRate, 'VES')}
          </span>
        </div>
      </div>

      {/* Recent Dispatches List */}
      <div className="p-4 space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
          Historial de Entregas Recientes
        </span>

        {dispatches.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No se han registrado entregas entre Fabiana y Beiker aún.{' '}
            <button
              onClick={() => setShowModal(true)}
              className="text-[#6161FF] font-bold underline ml-1 cursor-pointer"
            >
              Registrar primera entrega
            </button>
          </div>
        ) : (
          dispatches.slice(0, 5).map((record) => {
            const isMulti = record.items && record.items.length > 1;
            return (
              <div
                key={record.id}
                className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-lg flex-shrink-0 shadow-2xs">
                    {record.productPhoto || (isMulti ? '📦' : '🥜')}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span>{record.productName}</span>
                      {isMulti && (
                        <span className="text-[0.625rem] bg-indigo-50 dark:bg-indigo-950/60 text-[#6161FF] px-1.5 py-0.5 rounded font-bold">
                          {record.items!.length} ítems
                        </span>
                      )}
                    </div>
                    <div className="text-[0.6875rem] text-slate-500 flex items-center gap-1.5 mt-0.5">
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

                <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-mono">
                  <span className="font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded-lg">
                    -{record.totalUnits || record.quantity} uds
                  </span>
                  <div className="text-right min-w-[70px]">
                    <span className="font-black text-slate-900 dark:text-white">
                      {formatCurrency(record.totalUSD, 'USD')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewingRecord(record)}
                      className="p-1.5 rounded-lg text-[#6161FF] hover:bg-[#6161FF]/10 transition-colors cursor-pointer"
                      title="Ver Comprobante"
                    >
                      <FileText size={15} />
                    </button>
                    <button
                      onClick={() => handleShareWhatsApp(record)}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                      title="Compartir por WhatsApp"
                    >
                      <Share2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dispatch Modal */}
      {showModal && (
        <DispatchModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            loadData();
          }}
          defaultReceiver="Beiker Pérez (Master · Dirección General)"
        />
      )}

      {/* View Slip Modal */}
      {viewingRecord && (
        <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto z-50">
          <div className="mn-modal max-w-2xl w-full animate-scale-in bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-2xl rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 text-[#323338] dark:text-slate-100 my-0 sm:my-auto">
            {/* Header */}
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

            {/* Slip Content */}
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
