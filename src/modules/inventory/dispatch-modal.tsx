import React, { useState, useEffect, useMemo } from 'react';
import { db, type Product, type DispatchRecord, type DispatchItem, addWithSync, updateWithSync } from '../../db/database';
import { useAuthStore } from '../../auth/auth-store';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import {
  Send,
  Package,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  Printer,
  X,
  Clock,
  ArrowRight,
  ShieldCheck,
  Plus,
  Trash2,
  Share2,
  ShoppingBag,
} from 'lucide-react';

interface DispatchModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialProductId?: number;
  defaultReceiver?: string;
}

interface DraftDeliveryItem {
  productId: number;
  productName: string;
  productPhoto?: string;
  category: Product['category'];
  currentStock: number;
  quantity: number;
  unitPriceUSD: number;
}

const PRESET_RECEIVERS = [
  'Beiker Pérez (Master · Dirección General)',
  'Fabiana Acosta (Administración)',
  'Ruta de Ventas #1 (Distribución Calle)',
  'Ruta de Ventas #2 (Comercial)',
  'Punto de Venta Directo',
  'Cliente Mayorista',
];

export const DispatchModal: React.FC<DispatchModalProps> = ({
  onClose,
  onSuccess,
  initialProductId,
  defaultReceiver,
}) => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  const [products, setProducts] = useState<Product[]>([]);
  
  // Selected product in the selector to add to the batch
  const [selectedProductId, setSelectedProductId] = useState<number>(initialProductId || 0);
  const [addQty, setAddQty] = useState<number>(1);

  // Multi-item delivery draft list
  const [draftItems, setDraftItems] = useState<DraftDeliveryItem[]>([]);

  // Delivery metadata
  const [receiverName, setReceiverName] = useState<string>(
    defaultReceiver || 'Beiker Pérez (Master · Dirección General)'
  );
  const [customReceiver, setCustomReceiver] = useState<string>('');
  const [deliveredBy, setDeliveredBy] = useState<string>(
    currentUser?.name
      ? `${currentUser.name} (${currentUser.role === 'master' ? 'Master' : 'Administradora'})`
      : 'Fabiana Acosta (Administradora)'
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [deliveryTime, setDeliveryTime] = useState<string>(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdRecord, setCreatedRecord] = useState<DispatchRecord | null>(null);

  // Load available products from db
  const loadProducts = async () => {
    const prods = await db.products.toArray();
    setProducts(prods);
    if (!selectedProductId && prods.length > 0) {
      const firstWithStock = prods.find((p) => p.stock > 0) || prods[0];
      setSelectedProductId(firstWithStock.id || 0);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // When initialProductId changes or products are loaded, add initial product if provided
  useEffect(() => {
    if (initialProductId && products.length > 0 && draftItems.length === 0) {
      const prod = products.find((p) => p.id === initialProductId);
      if (prod && prod.stock > 0) {
        setDraftItems([
          {
            productId: prod.id!,
            productName: `${prod.name}${prod.flavor ? ` (${prod.flavor})` : ''}`,
            productPhoto: prod.photo,
            category: prod.category,
            currentStock: prod.stock,
            quantity: 1,
            unitPriceUSD: prod.priceUSD,
          },
        ]);
      }
    }
  }, [initialProductId, products]);

  // Product currently selected in dropdown
  const currentSelectedProd = products.find((p) => p.id === selectedProductId);

  // Add or increment product in draftItems
  const handleAddProduct = () => {
    if (!currentSelectedProd || !currentSelectedProd.id) return;
    if (currentSelectedProd.stock <= 0) {
      alert(`El producto ${currentSelectedProd.name} no cuenta con existencias en almacén.`);
      return;
    }

    const existingIdx = draftItems.findIndex((i) => i.productId === currentSelectedProd.id);
    if (existingIdx >= 0) {
      const existing = draftItems[existingIdx];
      const newTotalQty = existing.quantity + addQty;
      if (newTotalQty > currentSelectedProd.stock) {
        alert(
          `No puedes entregar más de las ${currentSelectedProd.stock} unidades en existencia de ${currentSelectedProd.name}.`
        );
        return;
      }
      const updated = [...draftItems];
      updated[existingIdx] = { ...existing, quantity: newTotalQty };
      setDraftItems(updated);
    } else {
      if (addQty > currentSelectedProd.stock) {
        alert(
          `No puedes entregar más de las ${currentSelectedProd.stock} unidades en existencia de ${currentSelectedProd.name}.`
        );
        return;
      }
      setDraftItems((prev) => [
        ...prev,
        {
          productId: currentSelectedProd.id!,
          productName: `${currentSelectedProd.name}${currentSelectedProd.flavor ? ` (${currentSelectedProd.flavor})` : ''}`,
          productPhoto: currentSelectedProd.photo,
          category: currentSelectedProd.category,
          currentStock: currentSelectedProd.stock,
          quantity: Math.max(1, addQty),
          unitPriceUSD: currentSelectedProd.priceUSD,
        },
      ]);
    }

    setAddQty(1);
  };

  // Modify quantity of item in draft list
  const handleUpdateItemQty = (productId: number, newQty: number) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          const bounded = Math.max(1, Math.min(item.currentStock, newQty));
          return { ...item, quantity: bounded };
        }
        return item;
      })
    );
  };

  // Remove item from draft
  const handleRemoveItem = (productId: number) => {
    setDraftItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Computed totals for the whole batch
  const totalUnits = useMemo(
    () => draftItems.reduce((acc, item) => acc + item.quantity, 0),
    [draftItems]
  );

  const totalUSD = useMemo(
    () => draftItems.reduce((acc, item) => acc + item.quantity * item.unitPriceUSD, 0),
    [draftItems]
  );

  const totalVES = totalUSD * activeRate;
  const effectiveReceiver = receiverName === 'custom' ? customReceiver.trim() : receiverName;

  // Process delivery & stock deduction
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (draftItems.length === 0) {
      alert('Debes agregar al menos un producto a la lista de entrega.');
      return;
    }

    if (!effectiveReceiver) {
      alert('Por favor indica quién recibe la mercancía.');
      return;
    }

    // Verify stock for all items
    for (const item of draftItems) {
      const prod = products.find((p) => p.id === item.productId);
      const stock = prod ? prod.stock : 0;
      if (item.quantity > stock) {
        alert(
          `Stock insuficiente para ${item.productName}. Existencia actual: ${stock}, solicitado: ${item.quantity}.`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const nowTs = new Date(`${deliveryDate}T${deliveryTime}:00`).getTime() || Date.now();

      // Build DispatchItem array
      const itemsList: DispatchItem[] = draftItems.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productPhoto: item.productPhoto,
        category: item.category,
        quantity: item.quantity,
        previousStock: item.currentStock,
        newStock: item.currentStock - item.quantity,
        unitPriceUSD: item.unitPriceUSD,
        totalUSD: item.quantity * item.unitPriceUSD,
      }));

      // Top-level fields (backward compatible with single product views)
      const primaryItem = itemsList[0];
      const multiProductName =
        itemsList.length === 1
          ? primaryItem.productName
          : `${primaryItem.productName} y ${itemsList.length - 1} producto(s) más`;

      const dispatchData: DispatchRecord = {
        productId: primaryItem.productId,
        productName: multiProductName,
        productPhoto: primaryItem.productPhoto,
        category: primaryItem.category,
        quantity: totalUnits,
        previousStock: primaryItem.previousStock,
        newStock: primaryItem.newStock,
        unitPriceUSD: primaryItem.unitPriceUSD,
        totalUSD: totalUSD,
        receiverName: effectiveReceiver,
        deliveredBy: deliveredBy.trim(),
        date: nowTs,
        notes: notes.trim(),
        userId: currentUser?.id || 1,
        items: itemsList,
        totalUnits: totalUnits,
        rateUsed: activeRate,
        totalVES: totalVES,
        status: 'delivered',
      };

      // 1. Add record to Dexie & sync queue
      const recordId = await addWithSync(db.dispatches, 'dispatches', dispatchData);

      // 2. Atomically deduct inventory stock for each product
      for (const item of itemsList) {
        await updateWithSync(db.products, 'products', item.productId, {
          stock: item.newStock,
          updatedAt: Date.now(),
        });
      }

      // 3. Emit real-time delivery notification event across window & BroadcastChannel
      const notificationPayload = {
        type: 'sbm:delivery_notification',
        record: { ...dispatchData, id: recordId },
        deliveredBy: deliveredBy.trim(),
        receiverName: effectiveReceiver,
        itemsCount: itemsList.length,
        totalUnits: totalUnits,
        totalUSD: totalUSD,
        totalVES: totalVES,
        timestamp: Date.now(),
      };

      window.dispatchEvent(
        new CustomEvent('sbm:delivery_notification', { detail: notificationPayload })
      );

      try {
        const channel = new BroadcastChannel('sbm_realtime_bus');
        channel.postMessage(notificationPayload);
        channel.close();
      } catch (err) {
        console.warn('BroadcastChannel not supported or error:', err);
      }

      // 4. Set created record for immediate receipt view
      setCreatedRecord({ ...dispatchData, id: recordId });
      onSuccess();
    } catch (err) {
      console.error('Error al entregar mercancía:', err);
      alert('Hubo un error al procesar la entrega.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!createdRecord) return;
    const itemsText = createdRecord.items
      ? createdRecord.items
          .map(
            (it) =>
              `• ${it.quantity}x ${it.productName} = $${it.totalUSD.toFixed(2)} (Quedan: ${it.newStock} uds)`
          )
          .join('\n')
      : `• ${createdRecord.quantity}x ${createdRecord.productName} = $${createdRecord.totalUSD.toFixed(2)}`;

    const text = `📦 *SAN BENITO MIX - COMPROBANTE OFICIAL DE ENTREGA*\n` +
      `*Nº:* DESP-${String(createdRecord.id || 1).padStart(5, '0')}\n` +
      `*Fecha:* ${new Date(createdRecord.date).toLocaleString('es-VE')}\n\n` +
      `*Entregado Por:* ${createdRecord.deliveredBy}\n` +
      `*Recibido Por:* ${createdRecord.receiverName}\n\n` +
      `*DETALLE DE PRODUCTOS ENTREGADOS:*\n${itemsText}\n\n` +
      `*Total Unidades:* ${createdRecord.totalUnits || createdRecord.quantity} uds\n` +
      `*Monto Total:* $${createdRecord.totalUSD.toFixed(2)} USD (≈ Bs. ${formatCurrency(createdRecord.totalVES || createdRecord.totalUSD * activeRate, 'VES')})\n` +
      `*Estado:* ✅ Mercancía Entregada y Descontada de Inventario\n` +
      (createdRecord.notes ? `*Observación:* ${createdRecord.notes}\n` : '') +
      `\n_San Benito Mix Administración Central 2026_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // ══════════════════════════════════════════════════════════════════
  // VIEW: Printable Receipt Slip (After Successful Delivery)
  // ══════════════════════════════════════════════════════════════════
  if (createdRecord) {
    return (
      <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
        <div className="mn-modal max-w-4xl w-full animate-scale-in bg-white dark:bg-slate-900 p-0 overflow-hidden shadow-2xl rounded-t-[28px] sm:rounded-3xl border border-[#E6E9EF] dark:border-slate-800 my-0 sm:my-auto text-[#323338] dark:text-slate-100">
          {/* Native drag handle on mobile */}
          <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 flex-shrink-0" />

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#00CA72] via-[#0086C9] to-[#6161FF] p-5 sm:p-6 text-white text-center relative">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2 text-white shadow-lg">
              <CheckCircle2 size={32} />
            </div>
            <span className="text-[0.6875rem] font-black uppercase tracking-widest text-white/90 bg-white/20 px-3 py-1 rounded-full">
              Operación Certificada · Stock Descontado
            </span>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
              ¡Entrega Registrada con Éxito!
            </h3>
            <p className="text-xs text-white/90 mt-0.5 font-medium max-w-md mx-auto">
              Todos los productos han sido transferidos y las existencias en almacén se redujeron automáticamente.
            </p>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Receipt Slip Body */}
          <div className="p-5 sm:p-7 space-y-4" id="dispatch-receipt">
            {/* Header of Voucher */}
            <div className="flex items-center justify-between pb-4 border-b border-dashed border-[#E6E9EF] dark:border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src="/san-benito-logo.jpg"
                  alt="San Benito Mix"
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-amber-400 shadow-md"
                />
                <div>
                  <span className="font-black text-base block text-[#323338] dark:text-white">
                    SAN BENITO MIX
                  </span>
                  <span className="text-xs text-[#676879] dark:text-slate-400 font-medium">
                    Acta Oficial de Entrega de Mercancía
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-black text-[#6161FF] bg-[#6161FF]/10 px-3 py-1 rounded-lg border border-[#6161FF]/20">
                  DESP-{String(createdRecord.id || 1).padStart(5, '0')}
                </span>
                <div className="text-xs text-[#676879] dark:text-slate-400 mt-1 font-medium">
                  {new Date(createdRecord.date).toLocaleString('es-VE')}
                </div>
              </div>
            </div>

            {/* Participants */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[0.6875rem] font-bold text-[#676879] dark:text-slate-400 uppercase block mb-1">
                  Entregado Por (Administradora)
                </span>
                <div className="font-bold text-sm text-[#323338] dark:text-white flex items-center gap-2">
                  <User size={15} className="text-[#6161FF]" />
                  <span>{createdRecord.deliveredBy}</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[0.6875rem] font-bold text-[#676879] dark:text-slate-400 uppercase block mb-1">
                  Recibido Por (Destinatario)
                </span>
                <div className="font-bold text-sm text-[#00CA72] flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#00CA72]" />
                  <span>{createdRecord.receiverName}</span>
                </div>
              </div>
            </div>

            {/* Products List Table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-[#676879] dark:text-slate-400 uppercase tracking-wider">
                <span>Productos Entregados ({createdRecord.items ? createdRecord.items.length : 1})</span>
                <span>Impacto en Stock & Subtotal</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {createdRecord.items && createdRecord.items.length > 0 ? (
                  createdRecord.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl flex-shrink-0">{item.productPhoto || '📦'}</span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-[#323338] dark:text-white truncate">
                            {item.productName}
                          </div>
                          <div className="text-[0.6875rem] text-[#676879] dark:text-slate-400">
                            {formatCurrency(item.unitPriceUSD, 'USD')} c/u
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 text-xs font-mono">
                        <div className="text-left sm:text-right">
                          <span className="font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded-lg text-xs">
                            -{item.quantity} uds
                          </span>
                          <div className="text-[0.6875rem] text-[#676879] dark:text-slate-400 mt-0.5">
                            Quedan: {item.newStock} uds
                          </div>
                        </div>

                        <div className="text-right min-w-[80px]">
                          <span className="font-black text-sm text-[#00CA72]">
                            {formatCurrency(item.totalUSD, 'USD')}
                          </span>
                          <div className="text-[0.625rem] text-[#676879] dark:text-slate-400">
                            ≈ {formatCurrency(item.totalUSD * (createdRecord.rateUsed || activeRate), 'VES')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-[#323338] dark:text-white">
                        {createdRecord.productName}
                      </span>
                      <div className="text-xs text-[#676879]">
                        Stock anterior: {createdRecord.previousStock} uds ➔ Restante: {createdRecord.newStock} uds
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-black text-sm text-[#00CA72]">
                        {formatCurrency(createdRecord.totalUSD, 'USD')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Total Valuation Strip */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#6161FF]/10 to-transparent border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-[0.6875rem] font-bold text-[#676879] dark:text-slate-400 uppercase block">
                  Total Entregado ({createdRecord.totalUnits || createdRecord.quantity} unidades físicas)
                </span>
                <span className="text-2xl font-black font-mono text-[#00CA72]">
                  {formatCurrency(createdRecord.totalUSD, 'USD')}
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-[#676879] dark:text-slate-400 block">
                  Equivalente en Bolívares
                </span>
                <span className="text-lg font-black text-[#6161FF]">
                  ≈ {formatCurrency(createdRecord.totalVES || createdRecord.totalUSD * activeRate, 'VES')}
                </span>
              </div>
            </div>

            {createdRecord.notes && (
              <div className="text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-[#676879] dark:text-slate-300">
                <span className="font-bold text-[#323338] dark:text-white">Observación: </span>
                {createdRecord.notes}
              </div>
            )}

            {/* Signatures */}
            <div className="pt-5 border-t border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-8 text-center">
              <div className="pt-8 border-t border-gray-300 dark:border-slate-600">
                <span className="text-xs text-[#323338] dark:text-white font-bold block">
                  Firma Administradora
                </span>
                <span className="text-[0.625rem] text-[#676879] dark:text-slate-400">
                  {createdRecord.deliveredBy}
                </span>
              </div>
              <div className="pt-8 border-t border-gray-300 dark:border-slate-600">
                <span className="text-xs text-[#323338] dark:text-white font-bold block">
                  Firma Receptor / Master
                </span>
                <span className="text-[0.625rem] text-[#676879] dark:text-slate-400">
                  {createdRecord.receiverName}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintSlip}
                className="mn-btn mn-btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5"
              >
                <Printer size={15} />
                <span>Imprimir Comprobante (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="mn-btn text-xs py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 rounded-xl transition-all"
              >
                <Share2 size={15} />
                <span>Enviar por WhatsApp</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mn-btn mn-btn-primary text-xs py-2 px-6 flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} />
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW: Multi-Product Dispatch Creator Form
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
      <div className="mn-modal max-w-4xl w-full animate-scale-in bg-white dark:bg-slate-900 p-0 overflow-hidden shadow-2xl rounded-t-[28px] sm:rounded-3xl border border-[#E6E9EF] dark:border-slate-800 my-0 sm:my-auto flex flex-col max-h-[94dvh] text-[#323338] dark:text-slate-100">
        {/* Mobile native handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-[#E6E9EF] dark:border-slate-800 bg-gradient-to-r from-white via-slate-50 to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
            <div className="w-10 h-10 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-[#6161FF] to-[#A25DDC] text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#6161FF]/20">
              <Send size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                <span className="text-[0.625rem] sm:text-[0.6875rem] font-extrabold uppercase tracking-wider text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded-full">
                  Entrega Multi-Producto
                </span>
                <span className="text-xs text-[#C5C7D0]">·</span>
                <span className="text-xs text-[#00CA72] font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> Descuento Automático de Stock
                </span>
              </div>
              <h2 className="text-base sm:text-2xl font-black text-[#323338] dark:text-white tracking-tight truncate">
                Entregar Mercancía a Dirección
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[#676879] hover:text-[#323338] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[78vh]">
          {/* Section 1: Multi-Product Picker */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#323338] dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-[#6161FF]" />
                1. Seleccionar Productos a Enviar
              </span>
              <span className="text-[0.6875rem] text-[#676879] dark:text-slate-400 font-normal">
                Puedes agregar múltiples productos a esta entrega
              </span>
            </label>

            {/* Picker Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-7">
                <span className="text-[0.6875rem] font-bold text-[#676879] dark:text-slate-400 block mb-1">
                  Producto de Catálogo
                </span>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedProductId(id);
                    setAddQty(1);
                  }}
                  className="mn-input mn-select text-xs font-semibold py-2.5 w-full bg-white dark:bg-slate-800"
                >
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id} disabled={prod.stock <= 0}>
                      {prod.photo || '📦'} {prod.name} {prod.flavor ? `(${prod.flavor})` : ''} · {prod.stock} uds disp. · ${prod.priceUSD.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[0.6875rem] font-bold text-[#676879] dark:text-slate-400">
                    Cantidad
                  </span>
                  {currentSelectedProd && (
                    <button
                      type="button"
                      onClick={() => setAddQty(currentSelectedProd.stock)}
                      className="text-[0.625rem] text-[#6161FF] font-bold hover:underline"
                    >
                      Max: {currentSelectedProd.stock}
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={currentSelectedProd?.stock || 1}
                  value={addQty}
                  onChange={(e) => setAddQty(Math.max(1, Number(e.target.value)))}
                  className="mn-input text-xs font-bold py-2 bg-white dark:bg-slate-800 text-center"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!currentSelectedProd || currentSelectedProd.stock <= 0}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Agregar</span>
                </button>
              </div>
            </div>

            {/* Quick Increment Buttons for selected product */}
            {currentSelectedProd && currentSelectedProd.stock > 0 && (
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[0.625rem] text-slate-500 font-bold uppercase mr-1">Rápido:</span>
                {[1, 5, 10, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setAddQty(Math.min(currentSelectedProd.stock, amt))}
                    className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-[0.625rem] font-bold text-[#6161FF] transition-all cursor-pointer"
                  >
                    {amt} uds
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Items in this Delivery Batch */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#323338] dark:text-slate-200 flex items-center gap-1.5">
                <Package size={14} className="text-[#00CA72]" />
                <span>Productos en esta Entrega ({draftItems.length})</span>
              </span>
              {draftItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftItems([])}
                  className="text-[0.6875rem] text-rose-500 font-bold hover:underline"
                >
                  Vaciar lista
                </button>
              )}
            </div>

            {draftItems.length === 0 ? (
              <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center bg-slate-50/50 dark:bg-slate-800/30">
                <Package size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Ningún producto agregado todavía
                </p>
                <p className="text-[0.6875rem] text-slate-400 mt-0.5">
                  Selecciona un producto arriba y pulsa "Agregar" para armar la entrega de Fabiana a Beiker.
                </p>
              </div>
            ) : (
              <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden p-2 bg-slate-50/40 dark:bg-slate-800/40">
                {draftItems.map((item) => (
                  <div
                    key={item.productId}
                    className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0">{item.productPhoto || '📦'}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.productName}
                        </div>
                        <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                          Stock almacén: <strong className="font-mono text-slate-700 dark:text-slate-300">{item.currentStock}</strong> uds ➔ Restarán:{' '}
                          <strong className="font-mono text-emerald-600">{item.currentStock - item.quantity}</strong> uds
                        </div>
                      </div>
                    </div>

                    {/* Quantity controls & subtotal */}
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(item.productId, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.currentStock}
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemQty(item.productId, Number(e.target.value))}
                          className="w-12 text-center text-xs font-mono font-black bg-transparent text-[#6161FF]"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(item.productId, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-600 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right min-w-[90px] font-mono">
                        <div className="font-black text-sm text-[#00CA72]">
                          {formatCurrency(item.quantity * item.unitPriceUSD, 'USD')}
                        </div>
                        <div className="text-[0.625rem] text-slate-500">
                          ≈ {formatCurrency(item.quantity * item.unitPriceUSD * activeRate, 'VES')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Quitar de la lista"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Live Batch Total Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-[#6161FF]/10 to-purple-500/10 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#00CA72] text-white flex items-center justify-center font-black text-lg shadow-sm">
                $
              </div>
              <div>
                <span className="text-[0.6875rem] font-bold text-[#676879] dark:text-slate-400 uppercase block">
                  Total de la Entrega ({totalUnits} unidades físicas en {draftItems.length} productos)
                </span>
                <span className="text-2xl font-black font-mono text-[#00CA72]">
                  {formatCurrency(totalUSD, 'USD')}
                </span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="text-xs text-[#676879] dark:text-slate-400 block">
                Equivalente en Bolívares
              </span>
              <span className="text-lg font-black text-[#6161FF]">
                ≈ {formatCurrency(totalVES, 'VES')}
              </span>
            </div>
          </div>

          {/* Section 4: Receiver & Sender */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#323338] dark:text-slate-200 flex items-center gap-1.5 mb-2">
              <User size={14} className="text-[#00CA72]" />
              <span>2. Destinatario de la Entrega</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
              {PRESET_RECEIVERS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReceiverName(r)}
                  className={`p-3 rounded-xl text-xs font-bold text-left transition-all border flex items-center justify-between cursor-pointer ${
                    receiverName === r
                      ? 'bg-[#6161FF] text-white border-transparent shadow-sm'
                      : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-slate-200 dark:border-slate-700 text-[#323338] dark:text-slate-200'
                  }`}
                >
                  <span className="truncate">{r}</span>
                  {receiverName === r && <CheckCircle2 size={14} />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setReceiverName('custom')}
              className={`w-full p-2.5 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer ${
                receiverName === 'custom'
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 border-[#6161FF] text-[#6161FF]'
                  : 'bg-transparent border-dashed border-slate-300 dark:border-slate-700 text-[#676879] dark:text-slate-400 hover:border-[#6161FF]'
              }`}
            >
              + Escribir otro destinatario personalizado...
            </button>

            {receiverName === 'custom' && (
              <input
                type="text"
                placeholder="Nombre de la persona o ruta que recibe..."
                value={customReceiver}
                onChange={(e) => setCustomReceiver(e.target.value)}
                required
                className="mn-input text-xs mt-2"
                autoFocus
              />
            )}
          </div>

          {/* Section 5: Date, Time & DeliveredBy */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mn-input-label flex items-center gap-1">
                <Calendar size={13} className="text-[#6161FF]" />
                <span>Fecha de Entrega</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
                className="mn-input text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="mn-input-label flex items-center gap-1">
                <Clock size={13} className="text-[#6161FF]" />
                <span>Hora</span>
              </label>
              <input
                type="time"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                required
                className="mn-input text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="mn-input-label">Entregado Por (Administradora)</label>
              <input
                type="text"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                required
                className="mn-input text-xs font-bold"
              />
            </div>
          </div>

          {/* Section 6: Notes */}
          <div>
            <label className="mn-input-label">Observaciones de la Entrega (Opcional)</label>
            <input
              type="text"
              placeholder="Ej. Entrega matutina de turrones y maní para dirección..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mn-input text-xs"
            />
          </div>

          {/* Action Buttons */}
          <div className="p-4 sm:p-5 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 sm:gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="mn-btn mn-btn-outline text-xs py-2.5 sm:py-3 px-4 sm:px-6 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || draftItems.length === 0}
              className="mn-btn mn-btn-primary text-xs py-2.5 sm:py-3 px-5 sm:px-8 flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 active:scale-95 transition-all text-xs sm:text-sm font-bold truncate cursor-pointer disabled:opacity-50"
            >
              <Send size={15} />
              <span>
                {isSubmitting
                  ? 'Procesando y Descontando...'
                  : `Confirmar Entrega (${totalUnits} uds · $${totalUSD.toFixed(2)})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
