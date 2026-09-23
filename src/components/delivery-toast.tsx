import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../auth/auth-store';
import { type DispatchRecord } from '../db/database';
import { formatCurrency } from '../services/exchange-rate-service';
import {
  Package,
  CheckCircle2,
  X,
  FileText,
  Printer,
  ShieldCheck,
  User,
  ArrowRight,
} from 'lucide-react';

interface DeliveryNotificationPayload {
  record: DispatchRecord;
  deliveredBy: string;
  receiverName: string;
  itemsCount: number;
  totalUnits: number;
  totalUSD: number;
  totalVES: number;
  timestamp: number;
}

// Executive Web Audio Chime (gentle 2-tone chime: D5 -> A5)
function playDeliveryChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // First tone (587.33 Hz - D5)
    playTone(587.33, now, 0.25);
    // Second tone (880 Hz - A5)
    playTone(880, now + 0.12, 0.45);

    // Mobile vibration if supported
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 60, 120]);
    }
  } catch (e) {
    console.debug('Web Audio chime ignored:', e);
  }
}

export const DeliveryToast: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [notification, setNotification] = useState<DeliveryNotificationPayload | null>(null);
  const [viewingRecord, setViewingRecord] = useState<DispatchRecord | null>(null);

  useEffect(() => {
    const handleNotification = (data: DeliveryNotificationPayload) => {
      // Check if current user is the receiver or master/admin
      const isForCurrent =
        !currentUser ||
        currentUser.role === 'master' ||
        (data.receiverName && data.receiverName.toLowerCase().includes(currentUser.name.toLowerCase()));

      if (isForCurrent) {
        setNotification(data);
        playDeliveryChime();
      }
    };

    // 1. Listen for local window event
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<DeliveryNotificationPayload>;
      if (customEvent.detail) {
        handleNotification(customEvent.detail);
      }
    };
    window.addEventListener('sbm:delivery_notification', handleCustomEvent);

    // 2. Listen for multi-tab / multi-device BroadcastChannel
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('sbm_realtime_bus');
      channel.onmessage = (event) => {
        if (event.data?.type === 'sbm:delivery_notification' && event.data.record) {
          handleNotification(event.data);
        }
      };
    } catch (e) {
      console.debug('BroadcastChannel error in DeliveryToast:', e);
    }

    return () => {
      window.removeEventListener('sbm:delivery_notification', handleCustomEvent);
      if (channel) {
        channel.close();
      }
    };
  }, [currentUser]);

  // Auto-dismiss notification after 18 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 18000);
    return () => clearTimeout(timer);
  }, [notification]);

  return (
    <>
      {/* Floating Executive Delivery Toast Banner */}
      {notification && (
        <div className="fixed top-3 right-3 sm:top-5 sm:right-5 z-50 max-w-md w-full animate-slide-in pointer-events-auto">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-400 dark:border-emerald-500 rounded-2xl sm:rounded-3xl p-4 shadow-2xl shadow-emerald-500/20 text-[#323338] dark:text-slate-100 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30 animate-pulse">
                  <Package size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.6875rem] font-black uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      ¡Entrega Recibida!
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-[0.6875rem] font-bold text-slate-500">
                      {new Date(notification.timestamp).toLocaleTimeString('es-VE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                    {notification.deliveredBy} te ha entregado mercancía
                  </h4>
                </div>
              </div>

              <button
                onClick={() => setNotification(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                title="Cerrar notificación"
              >
                <X size={16} />
              </button>
            </div>

            {/* Delivery Stats & Auto Stock Deduction Notice */}
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {notification.itemsCount} producto(s) · {notification.totalUnits} unidades
                </span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency(notification.totalUSD, 'USD')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[0.6875rem] text-emerald-700 dark:text-emerald-300 font-bold">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>Stock descontado automáticamente del inventario general</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setNotification(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Entendido
              </button>
              <button
                onClick={() => {
                  setViewingRecord(notification.record);
                  setNotification(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-[#6161FF] text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText size={14} />
                <span>Ver Comprobante</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slip Modal Triggered from Delivery Toast */}
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
                    Comprobante DESP-{String(viewingRecord.id || 1).padStart(5, '0')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Slip Details */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
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

              {/* Items List */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[0.6875rem] font-bold text-slate-600 dark:text-slate-300 uppercase">
                  Detalle de Productos ({viewingRecord.items?.length || 1})
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                  {viewingRecord.items && viewingRecord.items.length > 0 ? (
                    viewingRecord.items.map((it, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">{it.productPhoto || '📦'}</span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {it.productName}
                            </span>
                            <span className="text-[0.6875rem] text-slate-500">
                              Stock: {it.previousStock} ➔ <strong className="text-emerald-600">{it.newStock} uds</strong>
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

              {/* Totals */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-indigo-50 dark:from-emerald-950/30 dark:to-indigo-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between font-mono">
                <div>
                  <span className="text-[0.6875rem] text-slate-500 uppercase block">Total Valorizado</span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatCurrency(viewingRecord.totalUSD, 'USD')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[0.6875rem] text-slate-500 block">Equivalente Bs</span>
                  <span className="text-sm font-black text-[#6161FF]">
                    ≈ {formatCurrency(viewingRecord.totalVES || 0, 'VES')}
                  </span>
                </div>
              </div>

              {viewingRecord.notes && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-500 text-[0.6875rem]">
                  <strong>Observación: </strong> {viewingRecord.notes}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => window.print()}
                className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Imprimir (PDF)</span>
              </button>
              <button
                onClick={() => setViewingRecord(null)}
                className="mn-btn mn-btn-primary text-xs py-2 px-5"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
