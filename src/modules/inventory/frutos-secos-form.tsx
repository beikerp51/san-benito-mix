import React, { useState, useEffect, useMemo } from 'react';
import { db, type Product, addWithSync, updateWithSync, deleteWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import {
  Calculator,
  Scale,
  X,
  Save,
  Trash2,
  Package,
  DollarSign,
  Layers,
} from 'lucide-react';

interface FrutosSecosFormProps {
  product: Product | null;
  onClose: () => void;
}

const PACK_PRESETS = [40, 50, 80, 90, 100, 150, 250, 500, 1000];
const MARGIN_PRESETS = [20, 25, 30, 35, 40, 50, 70];
const EMOJIS = ['🥜', '🥣', '🌰', '🫘', '🧋', '🍯', '🥥', '🍿'];

export const FrutosSecosForm: React.FC<FrutosSecosFormProps> = ({ product, onClose }) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  // Packaging Mode: 'gramaje' (Lote por gramos fraccionado en bolsas) vs 'unidad' (Paquetes o unidades directas)
  const [packMode, setPackMode] = useState<'gramaje' | 'unidad'>(
    product?.packWeightGrams ? 'gramaje' : 'gramaje'
  );

  const [name, setName] = useState(product?.name || '');
  const [photo, setPhoto] = useState(product?.photo || '🥜');
  const [costTotalUSD, setCostTotalUSD] = useState<number>(product?.costTotalUSD || 0);

  // Gramaje mode fields
  const [totalWeightGrams, setTotalWeightGrams] = useState<number>(product?.totalWeightGrams || 1000);
  const [packWeightGrams, setPackWeightGrams] = useState<number>(product?.packWeightGrams || 90);
  const [customPack, setCustomPack] = useState('');

  // Direct Unit mode fields
  const [unitCount, setUnitCount] = useState<number>(product?.packCount || 10);

  // Pricing & Margin (Bidirectional)
  const [marginPercent, setMarginPercent] = useState<number>(product?.marginPercent || 30);
  const [priceUSD, setPriceUSD] = useState<number>(product?.priceUSD || 0);
  const [priceVES, setPriceVES] = useState<number>(product?.priceVES || 0);
  const [stockInput, setStockInput] = useState<number | ''>(product?.stock !== undefined ? product.stock : '');

  // ─── Executive Financial & Kilo Calculations ───────────────────
  const calc = useMemo(() => {
    // Weight in Kg
    const totalWeightKg = totalWeightGrams > 0 ? totalWeightGrams / 1000 : 0;

    // Total bags or units
    let totalUnits = 0;
    if (packMode === 'gramaje') {
      totalUnits = packWeightGrams > 0 ? Math.floor(totalWeightGrams / packWeightGrams) : 0;
    } else {
      totalUnits = unitCount > 0 ? unitCount : 1;
    }

    // Cost per unit / bag
    const costUnitUSD = totalUnits > 0 && costTotalUSD > 0 ? costTotalUSD / totalUnits : 0;
    const costUnitVES = costUnitUSD * activeRate;
    const costTotalVES = costTotalUSD * activeRate;

    // Yield: Bags per Kilo (1,000g)
    const bagsPerKg = packWeightGrams > 0 ? 1000 / packWeightGrams : 0;

    // Cost per Kilo
    const costPerKgUSD = totalWeightKg > 0 && costTotalUSD > 0 ? costTotalUSD / totalWeightKg : 0;
    const costPerKgVES = costPerKgUSD * activeRate;

    // Sale Price per Kilo (when selling bags of packWeightGrams at priceUSD)
    const pricePerKgUSD = packMode === 'gramaje' && bagsPerKg > 0 ? bagsPerKg * priceUSD : (totalWeightKg > 0 ? (totalUnits * priceUSD) / totalWeightKg : priceUSD);
    const pricePerKgVES = pricePerKgUSD * activeRate;

    // Profit per Kilo
    const profitPerKgUSD = pricePerKgUSD - costPerKgUSD;
    const profitPerKgVES = profitPerKgUSD * activeRate;

    // Profit per Unit / Bag
    const profitUnitUSD = priceUSD - costUnitUSD;
    const profitUnitVES = profitUnitUSD * activeRate;

    // Total Batch Revenue & Profit
    const totalRevenueUSD = totalUnits * priceUSD;
    const totalRevenueVES = totalRevenueUSD * activeRate;
    const totalProfitUSD = totalRevenueUSD - costTotalUSD;
    const totalProfitVES = totalProfitUSD * activeRate;

    // Return on Investment (ROI %)
    const roiPercent = costTotalUSD > 0 ? (totalProfitUSD / costTotalUSD) * 100 : 0;

    return {
      totalWeightKg,
      totalUnits,
      costUnitUSD,
      costUnitVES,
      costTotalVES,
      bagsPerKg,
      costPerKgUSD,
      costPerKgVES,
      pricePerKgUSD,
      pricePerKgVES,
      profitPerKgUSD,
      profitPerKgVES,
      profitUnitUSD,
      profitUnitVES,
      totalRevenueUSD,
      totalRevenueVES,
      totalProfitUSD,
      totalProfitVES,
      roiPercent,
    };
  }, [packMode, totalWeightGrams, packWeightGrams, unitCount, costTotalUSD, priceUSD, activeRate]);

  // Initial calculation or sync when costUnitUSD changes with default margin (only if priceUSD is not already set)
  useEffect(() => {
    if (product || priceUSD > 0) return;
    if (calc.costUnitUSD > 0) {
      const calculatedUSD = Number((calc.costUnitUSD * (1 + marginPercent / 100)).toFixed(2));
      setPriceUSD(calculatedUSD);
      setPriceVES(Number((calculatedUSD * activeRate).toFixed(2)));
    }
  }, [calc.costUnitUSD, marginPercent, activeRate, product, priceUSD]);

  // When margin changes via slider or preset buttons
  const handleMarginChange = (newMargin: number) => {
    setMarginPercent(newMargin);
    if (calc.costUnitUSD > 0) {
      const newUSD = Number((calc.costUnitUSD * (1 + newMargin / 100)).toFixed(2));
      setPriceUSD(newUSD);
      setPriceVES(Number((newUSD * activeRate).toFixed(2)));
    }
  };

  // When user directly types Selling Price in USD
  const handlePriceUSDChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setPriceUSD(val);
    setPriceVES(Number((val * activeRate).toFixed(2)));

    if (calc.costUnitUSD > 0 && val > 0) {
      const computedMargin = Number((((val - calc.costUnitUSD) / calc.costUnitUSD) * 100).toFixed(1));
      setMarginPercent(computedMargin);
    }
  };

  // When user directly types Selling Price in VES (Bs)
  const handlePriceVESChange = (valStr: string) => {
    const valVES = parseFloat(valStr) || 0;
    setPriceVES(valVES);
    const valUSD = activeRate > 0 ? Number((valVES / activeRate).toFixed(2)) : 0;
    setPriceUSD(valUSD);

    if (calc.costUnitUSD > 0 && valUSD > 0) {
      const computedMargin = Number((((valUSD - calc.costUnitUSD) / calc.costUnitUSD) * 100).toFixed(1));
      setMarginPercent(computedMargin);
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    if (!confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) return;
    await deleteWithSync(db.products, 'products', product.id);
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor ingresa el nombre del producto.');
      return;
    }

    const data: Product = {
      category: 'frutos_secos',
      name: name.trim(),
      photo,
      costTotalUSD,
      costTotalVES: calc.costTotalVES,
      totalWeightGrams: packMode === 'gramaje' ? totalWeightGrams : undefined,
      packWeightGrams: packMode === 'gramaje' ? packWeightGrams : undefined,
      packCount: calc.totalUnits,
      marginPercent,
      costUnitUSD: calc.costUnitUSD,
      costUnitVES: calc.costUnitVES,
      priceUSD,
      priceVES: activeRate > 0 ? priceUSD * activeRate : priceVES,
      stock: stockInput !== '' ? Number(stockInput) : (product?.stock ?? calc.totalUnits),
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
      <div className="mn-modal max-w-5xl w-full animate-scale-in my-auto bg-white rounded-3xl shadow-2xl border border-[#E6E9EF] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Grand Executive Modal Header - Always Visible */}
        <div className="mn-modal-header border-b border-[#E6E9EF] bg-gradient-to-r from-white via-[#F8F9FA] to-[#F0F2F8] px-4 sm:px-7 py-3 sm:py-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[0.625rem] sm:text-[0.6875rem] font-extrabold text-[#6161FF] bg-[#6161FF]/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                San Benito Mix · Frutos Secos
              </span>
              <span className="text-xs text-[#C5C7D0] hidden xs:inline">/</span>
              <span className="text-xs font-semibold text-[#676879] hidden xs:inline">
                Costos y Precios
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-[#323338] tracking-tight truncate">
              {product ? `Editar: ${product.name}` : 'Nuevo Fruto Seco / Mezcla'}
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="submit"
              form="frutos-secos-form"
              className="py-2 px-3 sm:px-4 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-95 transition-all cursor-pointer"
              title="Guardar producto en inventario"
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

        <form id="frutos-secos-form" onSubmit={handleSave} className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* Top Section: Basic Info & Packaging Mode */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Name and Icon (7 cols) */}
            <div className="md:col-span-7 flex items-center gap-3">
              <button
                type="button"
                className="w-14 h-14 rounded-2xl bg-[#F6F7FB] border border-[#E6E9EF] hover:border-[#6161FF] flex items-center justify-center text-3xl flex-shrink-0 transition-all shadow-sm active:scale-95"
                onClick={() => {
                  const current = EMOJIS.indexOf(photo);
                  setPhoto(EMOJIS[(current + 1) % EMOJIS.length]);
                }}
                title="Toca para alternar icono de fruto seco"
              >
                {photo}
              </button>
              <div className="flex-1">
                <label className="mn-input-label font-bold">Nombre del Fruto Seco o Mezcla</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Maní Especial con Pasas, Almendras Tostadas..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mn-input text-sm font-bold"
                  autoFocus
                />
              </div>
            </div>

            {/* Packaging Mode (5 cols) */}
            <div className="md:col-span-5">
              <label className="mn-input-label font-bold">Modalidad de Fraccionamiento</label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F0F1F3] rounded-xl border border-[#E6E9EF]">
                <button
                  type="button"
                  onClick={() => setPackMode('gramaje')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    packMode === 'gramaje'
                      ? 'bg-white text-[#6161FF] shadow-sm font-black'
                      : 'text-[#676879] hover:text-[#323338]'
                  }`}
                >
                  <Scale size={14} />
                  <span>A Granel (g / Kg)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPackMode('unidad')}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    packMode === 'unidad'
                      ? 'bg-white text-[#6161FF] shadow-sm font-black'
                      : 'text-[#676879] hover:text-[#323338]'
                  }`}
                >
                  <Package size={14} />
                  <span>Unidades / Paquetes</span>
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Box: Batch Cost & Grams / Presets */}
          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E6E9EF] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="mn-input-label font-bold flex items-center justify-between">
                  <span>Costo Total del Lote ($ USD)</span>
                  <span className="text-[0.6875rem] text-[#6161FF] font-mono font-bold">
                    ≈ {formatCurrency(costTotalUSD * activeRate, 'VES')}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#676879] font-bold text-xs">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={costTotalUSD || ''}
                    onChange={(e) => setCostTotalUSD(Number(e.target.value))}
                    className="mn-input pl-7 text-xs font-mono font-black text-[#323338]"
                  />
                </div>
              </div>

              {packMode === 'gramaje' ? (
                <>
                  <div>
                    <label className="mn-input-label font-bold flex items-center justify-between">
                      <span>Peso Total del Lote (Gramos)</span>
                      <span className="text-[0.6875rem] text-[#00CA72] font-mono font-bold">
                        = {calc.totalWeightKg.toFixed(2)} Kg
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="1000"
                      value={totalWeightGrams || ''}
                      onChange={(e) => setTotalWeightGrams(Number(e.target.value))}
                      className="mn-input text-xs font-mono font-black"
                    />
                  </div>

                  <div>
                    <label className="mn-input-label font-bold flex items-center justify-between">
                      <span>Gramaje por Bolsa Individual</span>
                      <span className="text-[0.6875rem] text-[#6161FF] font-mono font-bold">
                        {calc.bagsPerKg.toFixed(1)} bolsas / Kg
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="90"
                      value={packWeightGrams || ''}
                      onChange={(e) => setPackWeightGrams(Number(e.target.value))}
                      className="mn-input text-xs font-mono font-black"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mn-input-label font-bold">Cantidad Total de Paquetes / Bolsas</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="24"
                    value={unitCount || ''}
                    onChange={(e) => setUnitCount(Number(e.target.value))}
                    className="mn-input text-xs font-mono font-black"
                  />
                </div>
              )}
            </div>

            {/* Quick Gramage Presets Bar */}
            {packMode === 'gramaje' && (
              <div className="pt-2 border-t border-[#E6E9EF]/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[0.6875rem] font-bold text-[#676879] uppercase tracking-wider">
                    Pesos de empaque estándar San Benito Mix:
                  </span>
                  <span className="text-[0.6875rem] font-semibold text-[#6161FF]">
                    Seleccionado: {packWeightGrams} gramos por bolsa
                  </span>
                </div>
                <div className="flex gap-1.5 flex-wrap items-center">
                  {PACK_PRESETS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setPackWeightGrams(g);
                        setCustomPack('');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        packWeightGrams === g && !customPack
                          ? 'bg-[#6161FF] text-white border-[#6161FF] shadow-sm ring-1 ring-[#6161FF]'
                          : 'border-[#E6E9EF] bg-white text-[#676879] hover:bg-[#EBECEF]'
                      }`}
                    >
                      {g >= 1000 ? `${g / 1000} Kg` : `${g}g`}
                    </button>
                  ))}
                  <input
                    type="number"
                    className="mn-input w-24 text-center text-xs font-mono py-1.5"
                    placeholder="Otro (g)"
                    value={customPack}
                    onChange={(e) => {
                      setCustomPack(e.target.value);
                      const val = Number(e.target.value);
                      if (val > 0) setPackWeightGrams(val);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Direct Stock / Existencia Input */}
            <div className="pt-3 border-t border-[#E6E9EF]/80">
              <label className="mn-input-label text-xs font-bold text-[#323338]">
                Existencia Actual en Almacén (Bolsas Disponibles)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  placeholder={String(calc.totalUnits)}
                  value={stockInput === '' ? (product ? product.stock : calc.totalUnits) : stockInput}
                  onChange={(e) => setStockInput(e.target.value === '' ? '' : Number(e.target.value))}
                  className="mn-input text-sm font-mono font-black"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#676879]">
                  bolsas
                </span>
              </div>
              <span className="text-[0.625rem] text-[#676879] mt-0.5 block">
                Calculado del lote actual: {calc.totalUnits} bolsas. Puedes ajustar este valor si posees existencias previas.
              </span>
            </div>
          </div>

          {/* ─── EXECUTIVE DASHBOARD: ANÁLISIS POR KILO Y POR BOLSA ─── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#00CA72] flex items-center justify-center font-bold">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#323338] tracking-tight">
                    Análisis Ejecutivo de Costos y Rendimiento (Por Kilo y Por Bolsa)
                  </h3>
                  <p className="text-[0.6875rem] text-[#676879]">
                    Información detallada sobre el valor real del producto antes y después del empaque
                  </p>
                </div>
              </div>
              <span className="text-xs font-extrabold text-[#6161FF] bg-[#6161FF]/10 px-3 py-1 rounded-lg">
                Tasa Activa: {activeRate.toFixed(2)} Bs/$
              </span>
            </div>

            {/* 4 Large Highlight Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Card 1: Costo Por Kilo */}
              <div className="mn-card p-4 bg-gradient-to-br from-white to-[#F8F9FA] border border-[#E6E9EF] shadow-sm">
                <div className="text-[0.6875rem] font-extrabold text-[#676879] uppercase tracking-wider mb-1">
                  Costo por Kilo (1,000g)
                </div>
                <div className="text-xl font-black font-mono text-[#323338] tracking-tight">
                  {formatCurrency(calc.costPerKgUSD, 'USD')} <span className="text-xs font-medium text-[#676879]">/ Kg</span>
                </div>
                <div className="text-xs font-bold text-[#6161FF] font-mono mt-1">
                  {formatCurrency(calc.costPerKgVES, 'VES')} / Kg
                </div>
                <div className="text-[0.625rem] text-[#676879] mt-2 pt-2 border-t border-[#E6E9EF]">
                  Lote base: {calc.totalWeightKg.toFixed(2)} Kg en almacén
                </div>
              </div>

              {/* Card 2: Precio de Venta por Kilo */}
              <div className="mn-card p-4 bg-gradient-to-br from-white to-[#F8F9FA] border border-[#E6E9EF] shadow-sm">
                <div className="text-[0.6875rem] font-extrabold text-[#676879] uppercase tracking-wider mb-1">
                  Precio Venta por Kilo
                </div>
                <div className="text-xl font-black font-mono text-[#6161FF] tracking-tight">
                  {formatCurrency(calc.pricePerKgUSD, 'USD')} <span className="text-xs font-medium text-[#676879]">/ Kg</span>
                </div>
                <div className="text-xs font-bold text-[#323338] font-mono mt-1">
                  {formatCurrency(calc.pricePerKgVES, 'VES')} / Kg
                </div>
                <div className="text-[0.625rem] text-[#676879] mt-2 pt-2 border-t border-[#E6E9EF]">
                  Rinde {calc.bagsPerKg.toFixed(1)} bolsas por cada Kilo
                </div>
              </div>

              {/* Card 3: Ganancia Neta por Kilo */}
              <div className="mn-card p-4 bg-gradient-to-br from-white to-emerald-50/30 border border-emerald-200/60 shadow-sm">
                <div className="text-[0.6875rem] font-extrabold text-[#00CA72] uppercase tracking-wider mb-1">
                  Ganancia Neta por Kilo
                </div>
                <div className="text-xl font-black font-mono text-[#00CA72] tracking-tight">
                  +{formatCurrency(calc.profitPerKgUSD, 'USD')} <span className="text-xs font-medium text-[#00CA72]/80">/ Kg</span>
                </div>
                <div className="text-xs font-bold text-[#00CA72] font-mono mt-1">
                  +{formatCurrency(calc.profitPerKgVES, 'VES')} / Kg
                </div>
                <div className="text-[0.625rem] text-[#676879] mt-2 pt-2 border-t border-emerald-100">
                  Margen: +{marginPercent.toFixed(1)}% sobre costo
                </div>
              </div>

              {/* Card 4: Rendimiento del Lote */}
              <div className="mn-card p-4 bg-gradient-to-br from-white to-[#F8F9FA] border border-[#E6E9EF] shadow-sm">
                <div className="text-[0.6875rem] font-extrabold text-[#A25DDC] uppercase tracking-wider mb-1">
                  Rendimiento del Lote
                </div>
                <div className="text-xl font-black font-mono text-[#323338] tracking-tight">
                  {calc.totalUnits} <span className="text-xs font-bold text-[#676879]">{packMode === 'gramaje' ? 'Bolsas' : 'Paquetes'}</span>
                </div>
                <div className="text-xs font-bold text-[#00CA72] font-mono mt-1">
                  Ganancia Lote: +{formatCurrency(calc.totalProfitUSD, 'USD')}
                </div>
                <div className="text-[0.625rem] text-[#676879] mt-2 pt-2 border-t border-[#E6E9EF]">
                  Retorno de Inversión: +{calc.roiPercent.toFixed(0)}% ROI
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Margin Control Area (Bidirectional & Interactive) */}
          <div className="p-5 rounded-2xl bg-white border-2 border-[#6161FF]/30 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E9EF] pb-3">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-[#6161FF]" />
                <span className="text-sm font-extrabold text-[#323338] uppercase tracking-wide">
                  Fijación de Precios de Venta & Margen de Rentabilidad
                </span>
              </div>
              <span className="text-xs font-black text-[#00CA72] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Margen Aplicado: +{marginPercent.toFixed(1)}%
              </span>
            </div>

            {/* Quick Presets & Margin Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#676879]">
                  Ajustar Margen de Ganancia Deseado (%):
                </span>
                <div className="flex gap-1 flex-wrap">
                  {MARGIN_PRESETS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMarginChange(m)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                        Math.round(marginPercent) === m
                          ? 'bg-[#00CA72] text-white border-[#00CA72] shadow-sm'
                          : 'border-[#E6E9EF] bg-[#F5F6F8] text-[#676879] hover:bg-[#EBECEF]'
                      }`}
                    >
                      +{m}%
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                step="1"
                value={Math.max(5, Math.min(150, marginPercent))}
                onChange={(e) => handleMarginChange(Number(e.target.value))}
                className="w-full accent-[#6161FF] cursor-pointer"
              />
            </div>

            {/* Direct Inputs: Selling Price in USD and in Bolívares */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="mn-input-label font-bold flex items-center justify-between">
                  <span>Precio de Venta ($ USD / Bolsa Individual)</span>
                  <span className="text-[0.625rem] text-[#6161FF] font-bold bg-[#6161FF]/10 px-2 py-0.5 rounded">
                    Editable Directo
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6161FF] font-black text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={priceUSD || ''}
                    onChange={(e) => handlePriceUSDChange(e.target.value)}
                    className="mn-input pl-8 text-sm font-mono font-black text-[#6161FF] border-[#6161FF]/40 focus:border-[#6161FF] shadow-sm"
                  />
                </div>
                <div className="text-[0.6875rem] text-[#676879] mt-1 flex justify-between font-medium">
                  <span>Costo por bolsa: {formatCurrency(calc.costUnitUSD, 'USD')}</span>
                  <span className="text-[#00CA72] font-bold">
                    Ganancia: +{formatCurrency(calc.profitUnitUSD, 'USD')} / bolsa
                  </span>
                </div>
              </div>

              <div>
                <label className="mn-input-label font-bold flex items-center justify-between">
                  <span>Precio de Venta (Bs / Bolsa Individual)</span>
                  <span className="text-[0.625rem] text-[#00CA72] font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    Calculado a BCV
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={priceVES || ''}
                    onChange={(e) => handlePriceVESChange(e.target.value)}
                    className="mn-input pr-9 text-sm font-mono font-black text-[#323338] shadow-sm"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#676879] font-bold text-xs">
                    Bs
                  </span>
                </div>
                <div className="text-[0.6875rem] text-[#676879] mt-1 flex justify-between font-medium">
                  <span>Costo en Bs: {formatCurrency(calc.costUnitVES, 'VES')}</span>
                  <span className="text-[#00CA72] font-bold">
                    Ganancia: +{formatCurrency(calc.profitUnitVES, 'VES')} / bolsa
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── COMPLETE FINANCIAL SUMMARY TABLE (UNIDAD vs KILO vs LOTE) ─── */}
          <div className="rounded-2xl border border-[#E6E9EF] overflow-hidden bg-white shadow-sm">
            <div className="bg-[#F8F9FA] px-4 py-3 border-b border-[#E6E9EF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-[#6161FF]" />
                <span className="text-xs font-bold text-[#323338] uppercase tracking-wider">
                  Tabla Comparativa Integral de Rentabilidad
                </span>
              </div>
              <span className="text-[0.6875rem] text-[#676879] font-medium">
                Desglose multi-moneda USD & Bolívares
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono text-left">
                <thead className="bg-[#F5F6F8] text-[#676879] border-b border-[#E6E9EF]">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">CONCEPTO FINANCIERO</th>
                    <th className="py-2.5 px-4 font-bold text-right">POR BOLSA ({packWeightGrams}g)</th>
                    <th className="py-2.5 px-4 font-bold text-right bg-blue-50/50 text-[#6161FF]">
                      POR KILO (1,000g)
                    </th>
                    <th className="py-2.5 px-4 font-bold text-right bg-emerald-50/50 text-[#00CA72]">
                      LOTE COMPLETO ({calc.totalWeightKg.toFixed(2)} Kg)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9EF]">
                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-[#323338]">Costo Base ($ USD)</td>
                    <td className="py-2.5 px-4 text-right text-[#323338] font-bold">
                      {formatCurrency(calc.costUnitUSD, 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#6161FF] font-bold bg-blue-50/20">
                      {formatCurrency(calc.costPerKgUSD, 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#323338] font-bold bg-emerald-50/20">
                      {formatCurrency(costTotalUSD, 'USD')}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2.5 px-4 font-semibold text-[#323338]">Costo Base (Bs.)</td>
                    <td className="py-2.5 px-4 text-right text-[#676879]">
                      {formatCurrency(calc.costUnitVES, 'VES')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#676879] bg-blue-50/20">
                      {formatCurrency(calc.costPerKgVES, 'VES')}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#676879] bg-emerald-50/20">
                      {formatCurrency(calc.costTotalVES, 'VES')}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-[#323338]">Precio de Venta ($ USD)</td>
                    <td className="py-2.5 px-4 text-right font-black text-[#6161FF]">
                      {formatCurrency(priceUSD, 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-[#6161FF] bg-blue-50/30">
                      {formatCurrency(calc.pricePerKgUSD, 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72] bg-emerald-50/30">
                      {formatCurrency(calc.totalRevenueUSD, 'USD')}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/50">
                    <td className="py-2.5 px-4 font-bold text-[#323338]">Precio de Venta (Bs.)</td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#323338]">
                      {formatCurrency(priceVES, 'VES')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#323338] bg-blue-50/30">
                      {formatCurrency(calc.pricePerKgVES, 'VES')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-[#323338] bg-emerald-50/30">
                      {formatCurrency(calc.totalRevenueVES, 'VES')}
                    </td>
                  </tr>

                  <tr className="bg-emerald-50/40">
                    <td className="py-2.5 px-4 font-black text-[#00CA72]">Ganancia Neta ($ USD)</td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72]">
                      +{formatCurrency(calc.profitUnitUSD, 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72] bg-blue-50/40">
                      +{formatCurrency(calc.profitPerKgUSD, 'USD')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72] bg-emerald-100/40">
                      +{formatCurrency(calc.totalProfitUSD, 'USD')}
                    </td>
                  </tr>

                  <tr className="bg-emerald-50/40">
                    <td className="py-2.5 px-4 font-black text-[#00CA72]">Ganancia Neta (Bs.)</td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72]">
                      +{formatCurrency(calc.profitUnitVES, 'VES')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72] bg-blue-50/40">
                      +{formatCurrency(calc.profitPerKgVES, 'VES')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-[#00CA72] bg-emerald-100/40">
                      +{formatCurrency(calc.totalProfitVES, 'VES')}
                    </td>
                  </tr>
                </tbody>
              </table>
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
              <span className="hidden xs:inline">Eliminar Producto</span>
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
              form="frutos-secos-form"
              className="py-2.5 px-5 sm:px-6 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-[#6161FF]/25 active:scale-95 transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>{product ? 'Actualizar Producto' : 'Guardar y Publicar Producto'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FrutosSecosForm;
