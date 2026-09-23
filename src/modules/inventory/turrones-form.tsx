import React, { useState, useMemo } from 'react';
import { db, type Product, addWithSync, updateWithSync, deleteWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { Calculator, Gift, X, Save, Trash2, CheckCircle2, TrendingUp, Sparkles, Package } from 'lucide-react';

interface TurronesFormProps {
  product: Product | null;
  onClose: () => void;
}

const EMOJIS = ['🍫', '🍬', '🧁', '🍭', '🧇', '🥞', '🍪', '🍯'];
const MARGIN_PRESETS = [20, 25, 30, 35, 40, 50, 75];

export const TurronesForm: React.FC<TurronesFormProps> = ({ product, onClose }) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  const [name, setName] = useState(product?.name || 'Turrón Artesanal San Benito');
  const [photo, setPhoto] = useState(product?.photo || '🍫');
  const [costTotalUSD, setCostTotalUSD] = useState(product?.costTotalUSD || 0);
  const [bulkQuantity, setBulkQuantity] = useState(product?.bulkQuantity || 24);
  const [marginPercent, setMarginPercent] = useState(product?.marginPercent || 30);
  const [comboUnits, setComboUnits] = useState(product?.comboUnits || 3);
  const [stock, setStock] = useState(product?.stock ?? (product?.bulkQuantity || 24));

  const calculations = useMemo(() => {
    const costoUnitarioUSD = bulkQuantity > 0 ? costTotalUSD / bulkQuantity : 0;
    const costTotalVES = Number((costTotalUSD * activeRate).toFixed(2));
    const costoUnitarioVES = costoUnitarioUSD * activeRate;
    const precioUnitVentaUSD = Number((costoUnitarioUSD * (1 + marginPercent / 100)).toFixed(2));
    const precioUnitVentaVES = Number((precioUnitVentaUSD * activeRate).toFixed(2));
    const precioComboUSD = Number((precioUnitVentaUSD * comboUnits).toFixed(2));
    const precioComboVES = Number((precioComboUSD * activeRate).toFixed(2));
    const totalCombos = comboUnits > 0 ? Math.floor(bulkQuantity / comboUnits) : 0;
    const gananciaUnitariaUSD = Number((precioUnitVentaUSD - costoUnitarioUSD).toFixed(2));
    const totalVentaLoteUSD = Number((precioUnitVentaUSD * bulkQuantity).toFixed(2));
    const totalGananciaLoteUSD = Number((totalVentaLoteUSD - costTotalUSD).toFixed(2));

    return {
      costoUnitarioUSD,
      costoUnitarioVES,
      costTotalVES,
      precioUnitVentaUSD,
      precioUnitVentaVES,
      precioComboUSD,
      precioComboVES,
      totalCombos,
      gananciaUnitariaUSD,
      totalVentaLoteUSD,
      totalGananciaLoteUSD,
    };
  }, [costTotalUSD, bulkQuantity, marginPercent, comboUnits, activeRate]);

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm(`¿Estás seguro de eliminar "${product.name}"?`)) return;
    await deleteWithSync(db.products, 'products', product.id);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor ingresa el nombre del turrón o dulce para guardarlo.');
      return;
    }

    const data: Product = {
      category: 'turrones',
      name: name.trim(),
      photo,
      costTotalUSD,
      costTotalVES: calculations.costTotalVES,
      bulkQuantity,
      marginPercent,
      comboUnits,
      comboPrice: calculations.precioComboUSD,
      costUnitUSD: calculations.costoUnitarioUSD,
      costUnitVES: calculations.costoUnitarioVES,
      priceUSD: calculations.precioUnitVentaUSD,
      priceVES: calculations.precioUnitVentaVES,
      stock,
      createdAt: product?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (product?.id) {
      await updateWithSync(db.products, 'products', product.id, data);
    } else {
      await addWithSync(db.products, 'products', data);
    }
    onClose();
  };

  return (
    <div className="mn-modal-overlay p-2 sm:p-6 overflow-y-auto">
      <div className="mn-modal max-w-4xl w-full animate-scale-in my-auto bg-white rounded-3xl shadow-2xl border border-[#E6E9EF] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Always Visible */}
        <div className="mn-modal-header border-b border-[#E6E9EF] bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] px-4 sm:px-7 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[0.6875rem] font-extrabold uppercase tracking-wider text-[#6161FF] bg-[#6161FF]/10 px-2.5 py-0.5 rounded-full">
                Línea Turrones y Dulcería
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-[#323338] tracking-tight flex items-center gap-2 truncate">
              <span>🍫</span>
              <span className="truncate">{product ? `Editar: ${product.name}` : 'Nuevo Turrón / Dulce'}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="submit"
              form="turrones-form"
              className="py-2 px-3 sm:px-4 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-95 transition-all cursor-pointer"
              title="Guardar turrón en inventario"
            >
              <Save size={15} />
              <span>Guardar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 text-[#676879] hover:text-[#323338] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form id="turrones-form" onSubmit={handleSave} className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── COLUMNA IZQUIERDA: IDENTIFICACIÓN Y COMBOS ── */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-[#323338] block border-b border-[#E6E9EF] pb-2">
                  1. Presentación y Promociones
                </span>

                {/* Nombre e Icono */}
                <div>
                  <label className="mn-input-label">Icono y Nombre del Turrón</label>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      className="w-12 h-11 rounded-xl bg-white border border-[#E6E9EF] hover:border-[#6161FF] flex items-center justify-center text-2xl flex-shrink-0 transition-all shadow-sm active:scale-95"
                      onClick={() => {
                        const idx = EMOJIS.indexOf(photo);
                        setPhoto(EMOJIS[(idx + 1) % EMOJIS.length]);
                      }}
                      title="Cambiar icono"
                    >
                      {photo}
                    </button>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mn-input text-xs font-bold flex-1"
                    />
                  </div>
                </div>

                {/* Iconos Rápidos */}
                <div>
                  <span className="text-[0.6875rem] text-[#676879] font-medium block mb-1.5">
                    Seleccionar Icono:
                  </span>
                  <div className="flex flex-wrap gap-2 p-2 bg-white rounded-xl border border-[#E6E9EF]">
                    {EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setPhoto(em)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                          photo === em ? 'bg-[#6161FF]/15 ring-2 ring-[#6161FF]' : 'hover:bg-gray-100'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unidades por Caja y Combo */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mn-input-label">Unidades por Caja / Lote</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        required
                        placeholder="24"
                        value={bulkQuantity || ''}
                        onChange={(e) => setBulkQuantity(Number(e.target.value))}
                        className="mn-input text-sm font-mono font-black pl-3 pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879]">
                        uds
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="mn-input-label">Unidades por Combo Promoción</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="3"
                        value={comboUnits || ''}
                        onChange={(e) => setComboUnits(Number(e.target.value))}
                        className="mn-input text-sm font-mono font-bold pl-3 pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879]">
                        uds
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock Actual */}
                <div>
                  <label className="mn-input-label">Existencia Actual en Almacén (Unidades)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="24"
                    value={stock || ''}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="mn-input text-sm font-mono font-black"
                  />
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: COSTOS Y RENTABILIDAD ── */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E6E9EF] pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#323338]">
                    2. Costos, Margen y Precios
                  </span>
                  <span className="text-[0.6875rem] font-mono font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded">
                    Tasa: {activeRate.toFixed(2)} Bs
                  </span>
                </div>

                {/* Costo del Lote */}
                <div>
                  <label className="mn-input-label">Costo Total de la Caja / Lote de Turrones</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={costTotalUSD || ''}
                        onChange={(e) => setCostTotalUSD(Number(e.target.value))}
                        className="mn-input text-sm font-mono font-black pl-7"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879]">
                        $
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-[#E6E9EF] flex items-center justify-between">
                      <span className="text-[0.6875rem] text-[#676879]">Costo Lote Bs:</span>
                      <span className="text-xs font-mono font-bold text-[#323338]">
                        {formatCurrency(calculations.costTotalVES, 'VES')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Margen */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="mn-input-label mb-0">Margen de Rentabilidad Deseado</label>
                    <span className="text-xs font-black font-mono text-[#00CA72] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      +{marginPercent}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {MARGIN_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMarginPercent(m)}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                          marginPercent === m
                            ? 'bg-[#00CA72] text-white shadow-sm'
                            : 'bg-white text-[#323338] border border-[#E6E9EF] hover:border-[#00CA72]'
                        }`}
                      >
                        +{m}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(Number(e.target.value))}
                    className="w-full accent-[#00CA72] cursor-pointer"
                  />
                </div>

                {/* Precios Unitarios y Combos */}
                <div className="p-4 rounded-xl bg-white border border-[#E6E9EF] space-y-3 shadow-sm">
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#E6E9EF]">
                    <div className="p-3 bg-gradient-to-br from-[#6161FF]/10 to-[#6161FF]/5 rounded-xl border border-[#6161FF]/20">
                      <span className="text-[0.625rem] font-bold text-[#6161FF] uppercase tracking-wider block">
                        Precio Unitario USD
                      </span>
                      <div className="text-xl font-black font-mono text-[#6161FF] mt-0.5">
                        {formatCurrency(calculations.precioUnitVentaUSD, 'USD')}
                      </div>
                      <span className="text-[0.6875rem] text-[#676879] block mt-0.5">
                        ≈ {formatCurrency(calculations.precioUnitVentaVES, 'VES')}
                      </span>
                    </div>

                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60">
                      <span className="text-[0.625rem] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
                        <Gift size={11} /> Combo ({comboUnits} uds)
                      </span>
                      <div className="text-xl font-black font-mono text-amber-600 mt-0.5">
                        {formatCurrency(calculations.precioComboUSD, 'USD')}
                      </div>
                      <span className="text-[0.6875rem] text-[#676879] block mt-0.5">
                        ≈ {formatCurrency(calculations.precioComboVES, 'VES')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
                    <div className="flex justify-between text-[#676879]">
                      <span>Costo por Unidad:</span>
                      <span className="text-[#323338] font-bold">
                        {formatCurrency(calculations.costoUnitarioUSD, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#676879]">
                      <span>Ganancia / Unidad:</span>
                      <span className="text-[#00CA72] font-bold">
                        +{formatCurrency(calculations.gananciaUnitariaUSD, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#676879]">
                      <span>Venta Total Caja:</span>
                      <span className="text-[#6161FF] font-bold">
                        {formatCurrency(calculations.totalVentaLoteUSD, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#676879]">
                      <span>Ganancia Neta Caja:</span>
                      <span className="text-[#00CA72] font-bold">
                        +{formatCurrency(calculations.totalGananciaLoteUSD, 'USD')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer - Always Visible Pinned at Bottom */}
        <div className="mn-modal-footer flex-shrink-0 bg-white border-t border-[#E6E9EF] p-3 sm:p-4 flex items-center justify-between shadow-[0_-4px_16px_rgba(0,0,0,0.06)] z-10">
          {product?.id ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs font-bold text-[#E2445C] hover:underline flex items-center gap-1.5 p-2 rounded-lg hover:bg-rose-50 transition-colors"
            >
              <Trash2 size={15} />
              <span className="hidden xs:inline">Eliminar Turrón</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="mn-btn mn-btn-outline text-xs px-4 py-2 font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="turrones-form"
              className="py-2.5 px-5 sm:px-6 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 active:scale-95 transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>{product ? 'Actualizar Turrón' : 'Guardar en Inventario'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TurronesForm;
