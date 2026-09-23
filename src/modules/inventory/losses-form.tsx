import React, { useState, useEffect, useMemo } from 'react';
import { db, type Loss, type Product, addWithSync, updateWithSync, deleteWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { useAuthStore } from '../../auth/auth-store';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Package,
  DollarSign,
  TrendingDown,
  Calendar,
  X,
  Check,
  Search,
} from 'lucide-react';

export const LossesForm: React.FC = () => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const currentUser = useAuthStore((s) => s.currentUser);

  const [losses, setLosses] = useState<Loss[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();

    const handleSync = () => {
      loadData();
    };
    window.addEventListener('sbm:sync', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
    };
  }, []);

  const loadData = async () => {
    const [l, p] = await Promise.all([
      db.losses.reverse().sortBy('date'),
      db.products.toArray(),
    ]);
    setLosses(l);
    setProducts(p);
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || quantity <= 0) return;

    const lossUSD = selectedProduct.costUnitUSD * quantity;
    const lossVES = lossUSD * activeRate;

    await addWithSync(db.losses, 'losses', {
      productId: selectedProduct.id!,
      productName: selectedProduct.name,
      quantity,
      reason: reason.trim() || 'Merma en almacén / empaque',
      monetaryLossUSD: lossUSD,
      monetaryLossVES: lossVES,
      date: Date.now(),
      userId: currentUser?.id || 0,
    });

    // Deduct from stock with full LAN synchronization
    const newStock = Math.max(0, selectedProduct.stock - quantity);
    await updateWithSync(db.products, 'products', selectedProduct.id!, {
      stock: newStock,
      updatedAt: Date.now(),
    });

    setShowForm(false);
    setSelectedProductId(0);
    setQuantity(1);
    setReason('');
    await loadData();
  };

  const handleDelete = async (loss: Loss) => {
    if (!confirm(`¿Eliminar registro de merma de "${loss.productName}"? (El stock se restituirá automáticamente).`)) return;

    // Restore stock if product still exists with full LAN synchronization
    const prod = products.find((p) => p.id === loss.productId);
    if (prod?.id) {
      await updateWithSync(db.products, 'products', prod.id, {
        stock: prod.stock + loss.quantity,
        updatedAt: Date.now(),
      });
    }

    if (loss.id) {
      await deleteWithSync(db.losses, 'losses', loss.id);
    }
    await loadData();
  };

  const filteredLosses = useMemo(() => {
    if (!search.trim()) return losses;
    const q = search.toLowerCase();
    return losses.filter(
      (l) =>
        l.productName.toLowerCase().includes(q) ||
        l.reason.toLowerCase().includes(q)
    );
  }, [losses, search]);

  const totalLossUSD = losses.reduce((sum, l) => sum + l.monetaryLossUSD, 0);
  const totalUnits = losses.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header & KPI Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#323338]">
            Auditoría de Mermas y Pérdidas
          </h2>
          <p className="text-xs text-[#676879] mt-0.5">
            Control cuantitativo y monetario de productos vencidos, dañados o desechados
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="mn-btn mn-btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm shadow-[#6161FF]/20"
        >
          <Plus size={15} />
          <span>Registrar Merma</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span>Pérdida Monetaria Total</span>
            <DollarSign size={16} className="text-[#E2445C]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#E2445C]">
            -{formatCurrency(totalLossUSD, 'USD')}
          </div>
          <div className="text-xs text-[#676879] font-medium mt-1">
            Equiv: -{formatCurrency(totalLossUSD * activeRate, 'VES')}
          </div>
        </div>

        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span>Unidades Descartadas</span>
            <Package size={16} className="text-[#FDAB3D]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#323338]">
            {totalUnits} unidades
          </div>
          <div className="text-xs text-[#676879] font-medium mt-1">
            Descontadas de inventario activo
          </div>
        </div>

        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase tracking-wider mb-1">
            <span>Asientos de Merma</span>
            <AlertTriangle size={16} className="text-[#6161FF]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#323338]">
            {losses.length} registros
          </div>
          <div className="text-xs text-[#676879] font-medium mt-1">
            Tasa Activa: {activeRate.toFixed(2)} Bs
          </div>
        </div>
      </div>

      {/* Search & Board Table */}
      <div className="mn-card overflow-hidden">
        <div className="mn-group-header bg-white border-b border-[#E6E9EF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="mn-group-color" style={{ background: '#E2445C' }} />
            <span className="text-sm font-bold text-[#323338]">
              Historial de Mermas Contabilizadas
            </span>
            <span className="text-xs text-[#676879] font-normal">
              ({filteredLosses.length} asientos)
            </span>
          </div>

          <div className="relative min-w-[200px]">
            <input
              type="text"
              placeholder="Filtrar por producto o causa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mn-input text-xs py-1"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="mn-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>FECHA</th>
                <th>PRODUCTO AFECTADO</th>
                <th style={{ width: 120, textAlign: 'right' }}>CANTIDAD</th>
                <th>MOTIVO / DESCRIPCIÓN</th>
                <th style={{ width: 130, textAlign: 'right' }}>VALOR USD</th>
                <th style={{ width: 140, textAlign: 'right' }}>VALOR VES</th>
                <th style={{ width: 70, textAlign: 'center' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {filteredLosses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-sm text-[#676879]">
                    No hay mermas registradas en el período.{' '}
                    <button
                      onClick={() => setShowForm(true)}
                      className="text-[#6161FF] font-semibold underline ml-1"
                    >
                      Registrar primera merma
                    </button>
                  </td>
                </tr>
              ) : (
                filteredLosses.map((loss) => (
                  <tr key={loss.id} className="hover:bg-[#F5F6F8] transition-colors">
                    {/* Date */}
                    <td className="mn-table-cell text-xs text-[#676879]">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} className="text-[#A0A4B8]" />
                        <span>{new Date(loss.date).toLocaleDateString('es-VE')}</span>
                      </div>
                    </td>

                    {/* Product Name */}
                    <td className="mn-table-cell font-bold text-xs text-[#323338]">
                      {loss.productName}
                    </td>

                    {/* Quantity */}
                    <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#E2445C]">
                      -{loss.quantity} uds
                    </td>

                    {/* Reason */}
                    <td className="mn-table-cell text-xs text-[#676879]">
                      {loss.reason}
                    </td>

                    {/* Loss USD */}
                    <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#E2445C]">
                      -{formatCurrency(loss.monetaryLossUSD, 'USD')}
                    </td>

                    {/* Loss VES */}
                    <td className="mn-table-cell text-right font-mono font-semibold text-xs text-[#676879]">
                      -{formatCurrency(loss.monetaryLossVES, 'VES')}
                    </td>

                    {/* Action */}
                    <td className="mn-table-cell text-center">
                      <button
                        onClick={() => handleDelete(loss)}
                        className="p-1 rounded text-[#676879] hover:text-[#E2445C] hover:bg-rose-50 transition-colors"
                        title="Eliminar asiento y restituir inventario"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Loss Modal */}
      {showForm && (
        <div className="mn-modal-overlay">
          <div className="mn-modal max-w-lg w-full animate-scale-in">
            <div className="mn-modal-header border-b border-[#E6E9EF]">
              <div>
                <h3 className="text-base font-bold text-[#323338]">
                  Registrar Merma o Pérdida
                </h3>
                <p className="text-xs text-[#676879]">
                  Descuenta del inventario y asienta la pérdida financiera
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="mn-input-label">Producto Afectado</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(Number(e.target.value))}
                  className="mn-input mn-select text-xs"
                >
                  <option value={0}>Seleccionar producto...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.photo} {p.name} {p.flavor ? `(${p.flavor})` : ''} · Stock actual: {p.stock} uds
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mn-input-label">Cantidad a Descartar</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.stock || 9999}
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="mn-input text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="mn-input-label">Pérdida Monetaria Estimada</label>
                  <div className="h-[38px] px-3 bg-[#F6F7FB] rounded-xl border border-[#E6E9EF] flex items-center font-mono font-bold text-xs text-[#E2445C]">
                    {selectedProduct
                      ? `-${formatCurrency(selectedProduct.costUnitUSD * quantity, 'USD')}`
                      : '—'}
                  </div>
                </div>
              </div>

              <div>
                <label className="mn-input-label">Motivo o Justificación</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Empaque roto, fecha límite, merma de tostado..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mn-input text-xs"
                />
              </div>

              <div className="mn-modal-footer pt-3 px-0 pb-0">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="mn-btn mn-btn-outline text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedProduct || quantity <= 0}
                  className="mn-btn mn-btn-danger text-xs flex items-center gap-1.5"
                >
                  <AlertTriangle size={14} />
                  <span>Confirmar Merma</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LossesForm;
