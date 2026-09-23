import React, { useState, useMemo } from 'react';
import { db, type Product, addWithSync, updateWithSync, deleteWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency, formatUnitPlural } from '../../services/exchange-rate-service';
import {
  Package,
  X,
  Save,
  Trash2,
  Calculator,
  Percent,
  Layers,
  TrendingUp,
  Tag,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Boxes,
} from 'lucide-react';

interface VariosFormProps {
  product: Product | null;
  onClose: () => void;
}

const EMOJIS = [
  '📦', '🛍️', '🥤', '🥫', '🍫', '🍬', '🏷️', '🧼',
  '☕', '🧃', '🥪', '🍶', '🧰', '📋', '🎁', '🧂',
  '🍹', '🍿', '🧴', '🥢'
];

const ITEM_CATEGORIES = [
  'Mercancía Comercial',
  'Empaques y Bolsas',
  'Insumos Operativos',
  'Bebidas y Refrescos',
  'Snacks y Golosinas',
  'Materia Prima',
  'Misceláneos',
];

const UNIT_TYPES = [
  { label: 'Unidad (ud)', value: 'Unidad' },
  { label: 'Paquete (paq)', value: 'Paquete' },
  { label: 'Caja (cj)', value: 'Caja' },
  { label: 'Bulto (bto)', value: 'Bulto' },
  { label: 'Docena (doc)', value: 'Docena' },
  { label: 'Bolsa (bls)', value: 'Bolsa' },
  { label: 'Litro (L)', value: 'Litro' },
  { label: 'Kilo (kg)', value: 'Kilo' },
  { label: 'Rollo (rlo)', value: 'Rollo' },
];

const MARGIN_PRESETS = [15, 20, 25, 30, 40, 50, 75, 100];

export const VariosForm: React.FC<VariosFormProps> = ({ product, onClose }) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  // Form states
  const [name, setName] = useState(product?.name || '');
  const [photo, setPhoto] = useState(product?.photo || '📦');
  const [itemCategory, setItemCategory] = useState(product?.itemCategory || 'Mercancía Comercial');
  const [unitType, setUnitType] = useState(product?.unitType || 'Unidad');
  const [sku, setSku] = useState(product?.sku || '');
  const [costUnitUSD, setCostUnitUSD] = useState<number>(product?.costUnitUSD || 0);
  const [stock, setStock] = useState<number>(product?.stock || 0);
  const [minStock, setMinStock] = useState<number>(product?.minStock || 5);
  const [marginPercent, setMarginPercent] = useState<number>(product?.marginPercent || 30);
  
  // Custom manual selling price override mode
  const [priceMode, setPriceMode] = useState<'margin' | 'direct'>('margin');
  const [directPriceUSD, setDirectPriceUSD] = useState<number>(product?.priceUSD || 0);

  // Financial Calculations in Real-time
  const calculations = useMemo(() => {
    let finalPriceUSD = 0;
    let finalMargin = marginPercent;

    if (priceMode === 'direct') {
      finalPriceUSD = directPriceUSD;
      if (costUnitUSD > 0) {
        finalMargin = Math.round(((directPriceUSD - costUnitUSD) / costUnitUSD) * 100);
      }
    } else {
      finalPriceUSD = Number((costUnitUSD * (1 + marginPercent / 100)).toFixed(2));
      finalMargin = marginPercent;
    }

    const priceVES = Number((finalPriceUSD * activeRate).toFixed(2));
    const costUnitVES = Number((costUnitUSD * activeRate).toFixed(2));
    const profitUnitUSD = Number((finalPriceUSD - costUnitUSD).toFixed(2));
    const profitUnitVES = Number((profitUnitUSD * activeRate).toFixed(2));

    const totalCostUSD = Number((costUnitUSD * stock).toFixed(2));
    const totalCostVES = Number((totalCostUSD * activeRate).toFixed(2));
    const totalRevenueUSD = Number((finalPriceUSD * stock).toFixed(2));
    const totalRevenueVES = Number((totalRevenueUSD * activeRate).toFixed(2));
    const totalProfitUSD = Number((profitUnitUSD * stock).toFixed(2));
    const totalProfitVES = Number((totalProfitUSD * activeRate).toFixed(2));

    return {
      finalPriceUSD,
      finalMargin,
      priceVES,
      costUnitVES,
      profitUnitUSD,
      profitUnitVES,
      totalCostUSD,
      totalCostVES,
      totalRevenueUSD,
      totalRevenueVES,
      totalProfitUSD,
      totalProfitVES,
    };
  }, [costUnitUSD, marginPercent, priceMode, directPriceUSD, stock, activeRate]);

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm(`¿Estás seguro de eliminar el artículo "${product.name}"?`)) return;
    await deleteWithSync(db.products, 'products', product.id);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor ingresa el nombre del artículo para guardarlo.');
      return;
    }

    const data: Product = {
      category: 'varios',
      name: name.trim(),
      photo,
      itemCategory,
      unitType,
      sku: sku.trim() || undefined,
      minStock,
      costUnitUSD,
      costUnitVES: calculations.costUnitVES,
      marginPercent: calculations.finalMargin,
      priceUSD: calculations.finalPriceUSD,
      priceVES: calculations.priceVES,
      costTotalUSD: calculations.totalCostUSD,
      costTotalVES: calculations.totalCostVES,
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
        {/* Executive Header - Always Visible */}
        <div className="mn-modal-header border-b border-[#E6E9EF] bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] px-4 sm:px-7 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[0.625rem] sm:text-[0.6875rem] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#6161FF]/10 text-[#6161FF]">
                Inventario General & Artículos Diversos
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-[#323338] tracking-tight flex items-center gap-2 truncate">
              <Boxes size={22} className="text-[#6161FF] flex-shrink-0" />
              <span className="truncate">{product ? 'Editar Artículo' : 'Nuevo Artículo / Mercancía'}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="submit"
              form="varios-form"
              className="py-2 px-3 sm:px-4 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-95 transition-all cursor-pointer"
              title="Guardar artículo en inventario"
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

        <form id="varios-form" onSubmit={handleSave} className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── COLUMNA IZQUIERDA: IDENTIFICACIÓN Y RUBRO ── */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                <span className="text-xs font-black uppercase tracking-wider text-[#323338] block border-b border-[#E6E9EF] pb-2">
                  1. Clasificación y Presentación
                </span>

                {/* Name & Emoji selector */}
                <div>
                  <label className="mn-input-label">Icono y Nombre del Artículo</label>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      className="w-12 h-11 rounded-xl bg-white border border-[#E6E9EF] hover:border-[#6161FF] flex items-center justify-center text-2xl flex-shrink-0 transition-all shadow-sm active:scale-95"
                      onClick={() => {
                        const idx = EMOJIS.indexOf(photo);
                        setPhoto(EMOJIS[(idx + 1) % EMOJIS.length]);
                      }}
                      title="Haz clic para cambiar el icono"
                    >
                      {photo}
                    </button>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Bolsas Kraft 15x22 con Ventana / Cajas Master"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mn-input text-xs font-bold flex-1"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Emoji Bar Picker */}
                <div>
                  <span className="text-[0.6875rem] text-[#676879] font-medium block mb-1.5">
                    Iconos Rápidos:
                  </span>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-[#E6E9EF]">
                    {EMOJIS.slice(0, 10).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setPhoto(em)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-base transition-all ${
                          photo === em ? 'bg-[#6161FF]/15 ring-2 ring-[#6161FF]' : 'hover:bg-gray-100'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Categoría / Rubro */}
                <div>
                  <label className="mn-input-label">Rubro o Tipo de Mercancía</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ITEM_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setItemCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                          itemCategory === cat
                            ? 'bg-[#6161FF] text-white shadow-sm font-bold'
                            : 'bg-white text-[#676879] border border-[#E6E9EF] hover:border-[#6161FF]/40'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Unidad de Medida / Presentación */}
                <div>
                  <label className="mn-input-label">Unidad de Presentación / Medida</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {UNIT_TYPES.map((u) => (
                      <button
                        key={u.value}
                        type="button"
                        onClick={() => setUnitType(u.value)}
                        className={`px-2 py-1.5 rounded-lg text-[0.6875rem] font-semibold transition-all text-center ${
                          unitType === u.value
                            ? 'bg-[#1D2132] text-white font-bold shadow-sm'
                            : 'bg-white text-[#676879] border border-[#E6E9EF] hover:bg-gray-50'
                        }`}
                      >
                        {u.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SKU & Código Interno */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mn-input-label">Código SKU / Referencia</label>
                    <input
                      type="text"
                      placeholder="Ej: EMP-001"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="mn-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="mn-input-label">Stock Mínimo (Alerta)</label>
                    <input
                      type="number"
                      min="0"
                      value={minStock || ''}
                      onChange={(e) => setMinStock(Number(e.target.value))}
                      className="mn-input text-xs font-mono font-bold"
                      placeholder="5"
                    />
                  </div>
                </div>

                {/* Stock Actual Disponible */}
                <div>
                  <label className="mn-input-label">Existencia Actual en Almacén ({unitType})</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      required
                      placeholder="0"
                      value={stock || ''}
                      onChange={(e) => setStock(Number(e.target.value))}
                      className="mn-input text-sm font-mono font-black pl-3 pr-16"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879] pointer-events-none">
                      {formatUnitPlural(unitType, stock || 2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── COLUMNA DERECHA: ESTRUCTURA FINANCIERA Y PRECIOS ── */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E6E9EF] pb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#323338]">
                    2. Costos, Márgenes y Precios
                  </span>
                  <span className="text-[0.6875rem] font-mono font-bold text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded">
                    Tasa: {activeRate.toFixed(2)} Bs
                  </span>
                </div>

                {/* Costo Unitario de Compra */}
                <div>
                  <label className="mn-input-label">Costo de Compra / Adquisición Unitario</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={costUnitUSD || ''}
                        onChange={(e) => setCostUnitUSD(Number(e.target.value))}
                        className="mn-input text-sm font-mono font-black pl-7"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879]">
                        $
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-[#E6E9EF] flex items-center justify-between">
                      <span className="text-[0.6875rem] text-[#676879]">Costo en Bs:</span>
                      <span className="text-xs font-mono font-bold text-[#323338]">
                        {formatCurrency(calculations.costUnitVES, 'VES')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Modalidad de Margen / Precio */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="mn-input-label mb-0">Determinación de Precio</label>
                    <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-[#E6E9EF] text-[0.6875rem]">
                      <button
                        type="button"
                        onClick={() => setPriceMode('margin')}
                        className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                          priceMode === 'margin' ? 'bg-[#6161FF] text-white' : 'text-[#676879]'
                        }`}
                      >
                        Por Margen %
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPriceMode('direct');
                          if (directPriceUSD === 0 && calculations.finalPriceUSD > 0) {
                            setDirectPriceUSD(calculations.finalPriceUSD);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                          priceMode === 'direct' ? 'bg-[#6161FF] text-white' : 'text-[#676879]'
                        }`}
                      >
                        Precio Fijo $
                      </button>
                    </div>
                  </div>

                  {priceMode === 'margin' ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#676879]">Margen de Rentabilidad Deseado:</span>
                        <span className="text-xs font-black font-mono text-[#00CA72] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          +{marginPercent}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
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
                        className="w-full accent-[#00CA72] cursor-pointer mt-1"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs text-[#676879] block mb-1">
                        Ingresa el Precio de Venta en Dólares ($ USD):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={directPriceUSD || ''}
                          onChange={(e) => setDirectPriceUSD(Number(e.target.value))}
                          className="mn-input text-sm font-mono font-black pl-7"
                          placeholder="0.00"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879]">
                          $
                        </span>
                      </div>
                      <span className="text-[0.6875rem] text-[#00CA72] font-semibold mt-1 block">
                        Margen resultante: +{calculations.finalMargin}% de rentabilidad
                      </span>
                    </div>
                  )}
                </div>

                {/* Tarjetas Ejecutivas de Resultados Financieros */}
                <div className="p-4 rounded-xl bg-white border border-[#E6E9EF] space-y-3 shadow-sm">
                  {/* Precio de Venta Destacado */}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#E6E9EF]">
                    <div className="p-3 bg-gradient-to-br from-[#6161FF]/10 to-[#6161FF]/5 rounded-xl border border-[#6161FF]/20">
                      <span className="text-[0.625rem] font-bold text-[#6161FF] uppercase tracking-wider block">
                        Precio Venta USD
                      </span>
                      <div className="text-xl font-black font-mono text-[#6161FF] mt-0.5">
                        {formatCurrency(calculations.finalPriceUSD, 'USD')}
                      </div>
                    </div>
                    <div className="p-3 bg-[#F6F7FB] rounded-xl border border-[#E6E9EF]">
                      <span className="text-[0.625rem] font-bold text-[#676879] uppercase tracking-wider block">
                        Precio en Bolívares
                      </span>
                      <div className="text-xl font-black font-mono text-[#323338] mt-0.5">
                        {formatCurrency(calculations.priceVES, 'VES')}
                      </div>
                    </div>
                  </div>

                  {/* Detalle Unitario y Total */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono">
                    <div className="flex justify-between text-[#676879]">
                      <span>Ganancia Unitaria:</span>
                      <span className="text-[#00CA72] font-bold">
                        +{formatCurrency(calculations.profitUnitUSD, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#676879]">
                      <span>Margen Aplicado:</span>
                      <span className="text-[#323338] font-bold">
                        +{calculations.finalMargin}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[#676879]">
                      <span>Inversión Stock ({stock} {formatUnitPlural(unitType, stock)}):</span>
                      <span className="text-[#323338] font-bold">
                        {formatCurrency(calculations.totalCostUSD, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#676879]">
                      <span>Venta Bruta Total:</span>
                      <span className="text-[#6161FF] font-bold">
                        {formatCurrency(calculations.totalRevenueUSD, 'USD')}
                      </span>
                    </div>
                  </div>

                  {/* Utilidad Neta Proyectada */}
                  <div className="pt-2 border-t border-[#E6E9EF] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#323338] flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-[#00CA72]" />
                      Utilidad Neta Total del Lote:
                    </span>
                    <span className="font-mono font-black text-sm text-[#00CA72]">
                      +{formatCurrency(calculations.totalProfitUSD, 'USD')}
                    </span>
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
              <span className="hidden xs:inline">Eliminar Artículo</span>
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
              form="varios-form"
              className="py-2.5 px-5 sm:px-6 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 active:scale-95 transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>{product ? 'Actualizar Artículo' : 'Guardar Artículo en Inventario'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VariosForm;
