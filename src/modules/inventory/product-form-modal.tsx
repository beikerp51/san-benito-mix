import React, { useState, useEffect, useMemo } from 'react';
import {
  db,
  type Product,
  type ProductCategory,
  addWithSync,
  updateWithSync,
  deleteWithSync,
} from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import {
  loadPricePresets,
  savePricePreset,
  findPresetByName,
  type ProductPricePreset,
} from '../../services/price-preset-service';
import {
  Calculator,
  Scale,
  X,
  Save,
  Trash2,
  Package,
  DollarSign,
  Layers,
  Bot,
  Sparkles,
  ShieldCheck,
  Zap,
  Percent,
  Boxes,
  Tag,
  Check,
} from 'lucide-react';

interface ProductFormModalProps {
  product: Product | null;
  defaultCategory?: ProductCategory;
  initialPreset?: ProductPricePreset | null;
  onClose: () => void;
  onSuccess?: () => void;
}

// Preset chips
const SACK_WEIGHT_PRESETS = [25, 45, 50, 60];
const PACK_WEIGHT_PRESETS = [30, 40, 50, 80, 90, 100, 150, 200, 250, 500, 1000];
const MARGIN_PRESETS = [20, 30, 40, 50, 65, 80, 100];
const EMOJIS_GRANEL = ['🥜', '🌰', '🫘', '🥣', '🍿', '☕', '🍯', '🥥', '🧂', '🌾'];
const EMOJIS_OTROS = ['📦', '🍫', '🍬', '🥤', '🥫', '🏷️', '🧼', '🧃', '🥪', '🧴'];

const OTHER_ITEM_CATEGORIES = [
  'Confitería y Dulces',
  'Víveres y Abarrotes',
  'Bebidas y Refrescos',
  'Snacks y Golosinas',
  'Empaques y Bolsas',
  'Insumos y Materia Prima',
  'Misceláneos y Otros',
];

const UNIT_TYPES = [
  'Bolsa',
  'Unidad',
  'Paquete',
  'Caja',
  'Bulto',
  'Docena',
  'Kilo',
  'Frasco',
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  defaultCategory = 'frutos_secos',
  initialPreset,
  onClose,
  onSuccess,
}) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const activeSource = useExchangeRateStore((s) => s.activeSource);
  const isEditing = Boolean(product && product.id);

  // ─── TARIFARIO PRESETS STATE ───
  const [availablePresets, setAvailablePresets] = useState<ProductPricePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ProductPricePreset | null>(null);
  const [savedToTarifarioNotice, setSavedToTarifarioNotice] = useState<string | null>(null);

  // ─── 1. MODALIDAD PRINCIPAL ───
  // 'granel': Fraccionamiento por Sacos o Kilos a Bolsas
  // 'otros': Mercancía General / Unidades directas / Otras cosas
  const [operationalMode, setOperationalMode] = useState<'granel' | 'otros'>(() => {
    if (initialPreset) {
      return initialPreset.category === 'varios' ? 'otros' : 'granel';
    }
    if (product) {
      return product.category === 'varios' || product.unitType === 'Unidad' || product.itemCategory
        ? 'otros'
        : 'granel';
    }
    return defaultCategory === 'varios' ? 'otros' : 'granel';
  });

  // Datos Generales
  const [name, setName] = useState(initialPreset?.name || product?.name || '');
  const [photo, setPhoto] = useState(
    initialPreset?.photo || product?.photo || (operationalMode === 'granel' ? '🥜' : '📦')
  );
  const [itemCategory, setItemCategory] = useState(product?.itemCategory || 'Víveres y Abarrotes');
  const [unitType, setUnitType] = useState(initialPreset?.unitType || product?.unitType || 'Bolsa');
  const [minStock, setMinStock] = useState<number>(product?.minStock || 10);

  // ─── 2. CANTIDAD (POR SACO O POR KILOS) ───
  const [bulkInputMode, setBulkInputMode] = useState<'saco' | 'kilos'>('saco');
  const [sackCount, setSackCount] = useState<number>(1);
  const [weightPerSackKg, setWeightPerSackKg] = useState<number>(50);
  const [directKilos, setDirectKilos] = useState<number>(() => {
    if (product?.totalWeightGrams) return product.totalWeightGrams / 1000;
    return 50;
  });

  // ─── 3. PRECIO DE COSTO (POR SACO, POR KILO O TOTAL) ───
  const [costInputMode, setCostInputMode] = useState<'por_saco' | 'por_kilo' | 'total'>('por_saco');
  const [costCurrency, setCostCurrency] = useState<'USD' | 'VES'>('USD');
  const [costValue, setCostValue] = useState<number>(() => {
    if (product?.costTotalUSD) return product.costTotalUSD;
    return 45.0;
  });

  // ─── 4. GRAMAJE POR UNIDAD / BOLSA ───
  const [packGrams, setPackGrams] = useState<number>(
    initialPreset?.packWeightGrams || product?.packWeightGrams || 90
  );
  const [customPackGrams, setCustomPackGrams] = useState('');

  // ─── 6. EXISTENCIA EN ALMACÉN (STOCK) ───
  const [stockManual, setStockManual] = useState<number | ''>(
    product?.stock !== undefined ? product.stock : ''
  );
  const [stockSyncedWithBatch, setStockSyncedWithBatch] = useState<boolean>(!isEditing);

  // ─── 9. PORCENTAJE DE GANANCIA Y FIJACIÓN BIDIRECCIONAL ───
  const [marginPercent, setMarginPercent] = useState<number>(product?.marginPercent || 35);
  const [priceUSD, setPriceUSD] = useState<number>(initialPreset?.priceUSD || product?.priceUSD || 0);
  const [priceVES, setPriceVES] = useState<number>(
    initialPreset ? Number((initialPreset.priceUSD * activeRate).toFixed(2)) : product?.priceVES || 0
  );

  // Para el modo 'otros' (Mercancía General directa)
  const [otherUnitCostUSD, setOtherUnitCostUSD] = useState<number>(product?.costUnitUSD || 1.0);
  const [otherStock, setOtherStock] = useState<number>(product?.stock || 24);

  // ─── CÁLCULOS MATEMÁTICOS DE RENDIMIENTO Y COSTOS ───
  const calculations = useMemo(() => {
    if (operationalMode === 'granel') {
      // 1. Total Kilos y Gramos
      let totalKilos = 0;
      if (bulkInputMode === 'saco') {
        totalKilos = Math.max(0, sackCount * weightPerSackKg);
      } else {
        totalKilos = Math.max(0, directKilos);
      }
      const totalGrams = totalKilos * 1000;

      // 2. Inversión Total y Costos Base
      let totalCostUSD = 0;
      if (costCurrency === 'VES') {
        const valUSD = activeRate > 0 ? costValue / activeRate : 0;
        if (costInputMode === 'por_saco') {
          totalCostUSD = bulkInputMode === 'saco' ? valUSD * sackCount : (valUSD / (weightPerSackKg || 50)) * totalKilos;
        } else if (costInputMode === 'por_kilo') {
          totalCostUSD = valUSD * totalKilos;
        } else {
          totalCostUSD = valUSD;
        }
      } else {
        if (costInputMode === 'por_saco') {
          totalCostUSD = bulkInputMode === 'saco' ? costValue * sackCount : (costValue / (weightPerSackKg || 50)) * totalKilos;
        } else if (costInputMode === 'por_kilo') {
          totalCostUSD = costValue * totalKilos;
        } else {
          totalCostUSD = costValue;
        }
      }

      const totalCostVES = totalCostUSD * activeRate;
      const costPerKgUSD = totalKilos > 0 ? totalCostUSD / totalKilos : 0;
      const costPerKgVES = costPerKgUSD * activeRate;
      const costPerGramUSD = totalGrams > 0 ? totalCostUSD / totalGrams : 0;
      const costPerGramVES = costPerGramUSD * activeRate;

      // 3. Bolsas Salientes y Rendimiento
      const effectivePackGrams = packGrams > 0 ? packGrams : 90;
      const totalBolsas = effectivePackGrams > 0 ? Math.floor(totalGrams / effectivePackGrams) : 0;
      const mermaGrams = totalGrams - totalBolsas * effectivePackGrams;
      const bagsPerKg = effectivePackGrams > 0 ? 1000 / effectivePackGrams : 0;

      // 4. Costo por Bolsa
      const costUnitUSD = totalBolsas > 0 ? totalCostUSD / totalBolsas : costPerGramUSD * effectivePackGrams;
      const costUnitVES = costUnitUSD * activeRate;

      return {
        totalKilos,
        totalGrams,
        totalCostUSD,
        totalCostVES,
        costPerKgUSD,
        costPerKgVES,
        costPerGramUSD,
        costPerGramVES,
        effectivePackGrams,
        totalBolsas,
        mermaGrams,
        bagsPerKg,
        costUnitUSD,
        costUnitVES,
      };
    } else {
      // Modo Mercancía General / Otros
      const costUnitUSD = otherUnitCostUSD;
      const costUnitVES = otherUnitCostUSD * activeRate;
      const totalBolsas = otherStock;
      const totalCostUSD = costUnitUSD * otherStock;
      const totalCostVES = totalCostUSD * activeRate;

      return {
        totalKilos: 0,
        totalGrams: 0,
        totalCostUSD,
        totalCostVES,
        costPerKgUSD: 0,
        costPerKgVES: 0,
        costPerGramUSD: 0,
        costPerGramVES: 0,
        effectivePackGrams: 0,
        totalBolsas,
        mermaGrams: 0,
        bagsPerKg: 0,
        costUnitUSD,
        costUnitVES,
      };
    }
  }, [
    operationalMode,
    bulkInputMode,
    sackCount,
    weightPerSackKg,
    directKilos,
    costInputMode,
    costCurrency,
    costValue,
    packGrams,
    otherUnitCostUSD,
    otherStock,
    activeRate,
  ]);

  // Sincronización automática de stock si está vinculado
  useEffect(() => {
    if (stockSyncedWithBatch && operationalMode === 'granel') {
      setStockManual(calculations.totalBolsas);
    }
  }, [calculations.totalBolsas, stockSyncedWithBatch, operationalMode]);

  // ─── CARGAR PRESETS DEL TARIFARIO Y APLICAR INICIAL ───
  useEffect(() => {
    loadPricePresets().then((list) => {
      setAvailablePresets(list);
      if (initialPreset) {
        applyPreset(initialPreset);
      } else if (!isEditing && name.trim()) {
        const match = findPresetByName(list, name);
        if (match) applyPreset(match);
      }
    });
  }, [initialPreset]);

  const applyPreset = (preset: ProductPricePreset) => {
    setSelectedPreset(preset);
    setName(preset.name);
    if (preset.photo) setPhoto(preset.photo);
    if (preset.packWeightGrams) setPackGrams(preset.packWeightGrams);
    if (preset.unitType) setUnitType(preset.unitType);
    if (preset.category === 'varios') {
      setOperationalMode('otros');
    } else {
      setOperationalMode('granel');
    }
    setPriceUSD(preset.priceUSD);
    setPriceVES(Number((preset.priceUSD * activeRate).toFixed(2)));
    if (calculations.costUnitUSD > 0 && preset.priceUSD > calculations.costUnitUSD) {
      const computedMargin = Number(
        (((preset.priceUSD - calculations.costUnitUSD) / calculations.costUnitUSD) * 100).toFixed(1)
      );
      setMarginPercent(computedMargin);
    }
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    const match = findPresetByName(availablePresets, newName);
    if (match) {
      setSelectedPreset(match);
      setPriceUSD(match.priceUSD);
      setPriceVES(Number((match.priceUSD * activeRate).toFixed(2)));
      if (match.photo) setPhoto(match.photo);
      if (match.packWeightGrams) setPackGrams(match.packWeightGrams);
      if (match.unitType) setUnitType(match.unitType);
      if (match.category === 'varios') {
        setOperationalMode('otros');
      } else {
        setOperationalMode('granel');
      }
    } else {
      setSelectedPreset(null);
    }
  };

  const handleSaveToTarifario = async () => {
    if (!name.trim()) {
      alert('Por favor escribe primero el nombre del producto.');
      return;
    }
    if (priceUSD <= 0) {
      alert('El precio debe ser mayor a 0 para fijarlo en el tarifario.');
      return;
    }
    const cat: ProductCategory = operationalMode === 'granel' ? 'frutos_secos' : 'varios';
    const saved = await savePricePreset({
      name: name.trim().toUpperCase(),
      category: cat,
      priceUSD,
      packWeightGrams: packGrams,
      unitType,
      photo,
    });
    setSelectedPreset(saved);
    setAvailablePresets((prev) => {
      const idx = prev.findIndex((p) => p.name.toUpperCase() === saved.name.toUpperCase());
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [...prev, saved];
    });
    setSavedToTarifarioNotice(`Precio de "${saved.name}" ($${saved.priceUSD.toFixed(2)}) guardado en el Tarifario`);
    setTimeout(() => setSavedToTarifarioNotice(null), 3500);
  };

  // Actualizar precio de venta cuando cambia costo unitario o margen
  useEffect(() => {
    // Si hay un preset fijado del tarifario, se conserva ese precio y se ajusta el margen en base al costo del lote
    if (selectedPreset) {
      if (calculations.costUnitUSD > 0 && selectedPreset.priceUSD > 0) {
        const computedMargin = Number(
          (((selectedPreset.priceUSD - calculations.costUnitUSD) / calculations.costUnitUSD) * 100).toFixed(1)
        );
        setMarginPercent(computedMargin);
        setPriceVES(Number((selectedPreset.priceUSD * activeRate).toFixed(2)));
      }
      return;
    }

    if (calculations.costUnitUSD > 0) {
      const suggestedUSD = Number((calculations.costUnitUSD * (1 + marginPercent / 100)).toFixed(2));
      setPriceUSD((prev) => (prev <= 0 || !isEditing ? suggestedUSD : prev));
      setPriceVES(Number((suggestedUSD * activeRate).toFixed(2)));
    }
  }, [calculations.costUnitUSD, marginPercent, activeRate, isEditing, selectedPreset]);

  // Modificación del margen % (Slider o Chips)
  const handleMarginChange = (newMargin: number) => {
    setMarginPercent(newMargin);
    if (calculations.costUnitUSD > 0) {
      const newUSD = Number((calculations.costUnitUSD * (1 + newMargin / 100)).toFixed(2));
      setPriceUSD(newUSD);
      setPriceVES(Number((newUSD * activeRate).toFixed(2)));
    }
  };

  // Modificación directa del precio de venta en USD
  const handlePriceUSDChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setPriceUSD(val);
    setPriceVES(Number((val * activeRate).toFixed(2)));

    if (calculations.costUnitUSD > 0 && val > 0) {
      const computedMargin = Number(
        (((val - calculations.costUnitUSD) / calculations.costUnitUSD) * 100).toFixed(1)
      );
      setMarginPercent(computedMargin);
    }
  };

  // Modificación directa del precio en Bolívares
  const handlePriceVESChange = (valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setPriceVES(val);
    const usd = activeRate > 0 ? Number((val / activeRate).toFixed(2)) : 0;
    setPriceUSD(usd);

    if (calculations.costUnitUSD > 0 && usd > 0) {
      const computedMargin = Number(
        (((usd - calculations.costUnitUSD) / calculations.costUnitUSD) * 100).toFixed(1)
      );
      setMarginPercent(computedMargin);
    }
  };

  // ─── 8. IA ECONOMISTA Y ASESORA FINANCIERA DE VENEZUELA ───
  const aiFinancialStudy = useMemo(() => {
    const costUnit = calculations.costUnitUSD;
    const currentPrice = priceUSD;
    const currentMargin = marginPercent;
    const units = operationalMode === 'granel' ? calculations.totalBolsas : otherStock;
    const effectiveStock = stockManual !== '' ? Number(stockManual) : units;

    // Métricas del estudio económico
    const totalSalesUSD = effectiveStock * currentPrice;
    const totalSalesVES = totalSalesUSD * activeRate;
    const totalNetProfitUSD = totalSalesUSD - calculations.totalCostUSD;
    const totalNetProfitVES = totalNetProfitUSD * activeRate;
    const profitPerUnitUSD = Math.max(0, currentPrice - costUnit);

    // Margen de equilibrio mínimo (cubre 5% merma técnica + 7% flete/empaque + reposición en Venezuela)
    const breakEvenPriceUSD = Number((costUnit * 1.12).toFixed(2));
    const aiSuggestedPriceUSD = Number((costUnit * 1.45).toFixed(2)); // 45% margen óptimo en mercado nacional

    // Semáforo de Viabilidad Económica
    let status: 'optimo' | 'moderado' | 'riesgo' = 'optimo';
    let title = '';
    let description = '';
    let recommendation = '';

    if (currentPrice < costUnit) {
      status = 'riesgo';
      title = '🔴 Venta a Pérdida Inminente';
      description = `El precio de $${currentPrice.toFixed(2)} está por debajo del costo unitario ($${costUnit.toFixed(2)}).`;
      recommendation = `Aumenta el precio inmediatamente a mínimo $${breakEvenPriceUSD.toFixed(2)} para evitar quiebra.`;
    } else if (currentMargin < 25) {
      status = 'riesgo';
      title = '🔴 Alto Riesgo de Descapitalización en Venezuela';
      description = `Un margen de ${currentMargin.toFixed(1)}% no cubre la reposición del próximo saco ante inflación, costos de bolsas selladas y merma.`;
      recommendation = `Sube el margen a mínimo 35%-40% ($${Number((costUnit * 1.35).toFixed(2))} USD).`;
    } else if (currentMargin >= 25 && currentMargin < 40) {
      status = 'moderado';
      title = '🟡 Margen Aceptable con Rotación Alta';
      description = `Margen del ${currentMargin.toFixed(1)}%. Tu negocio recupera el costo y genera ganancia moderada, pero requiere venta semanal rápida.`;
      recommendation = `Para blindar el negocio ante el dólar, la IA Economista sugiere un precio de $${aiSuggestedPriceUSD.toFixed(2)} (45% de margen).`;
    } else {
      status = 'optimo';
      title = '🟢 Excelente Rentabilidad y Negocio Blindado';
      description = `Margen sólido del ${currentMargin.toFixed(1)}%. Cada bolsa genera +$${profitPerUnitUSD.toFixed(2)} de ganancia neta.`;
      recommendation = `Tu lote completo de ${effectiveStock} unidades te generará una utilidad neta de +${formatCurrency(totalNetProfitUSD, 'USD')} (≈ ${formatCurrency(totalNetProfitVES, 'VES')}).`;
    }

    return {
      costUnit,
      currentPrice,
      currentMargin,
      totalSalesUSD,
      totalSalesVES,
      totalNetProfitUSD,
      totalNetProfitVES,
      profitPerUnitUSD,
      breakEvenPriceUSD,
      aiSuggestedPriceUSD,
      status,
      title,
      description,
      recommendation,
    };
  }, [
    calculations,
    priceUSD,
    marginPercent,
    stockManual,
    otherStock,
    operationalMode,
    activeRate,
  ]);

  // ─── GUARDAR EN BASE DE DATOS ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor indica el nombre del producto.');
      return;
    }

    if (priceUSD <= 0) {
      alert('El precio de venta debe ser mayor a 0.');
      return;
    }

    const finalStock =
      operationalMode === 'granel'
        ? (stockManual !== '' ? Number(stockManual) : calculations.totalBolsas)
        : otherStock;

    const category: ProductCategory =
      operationalMode === 'granel' ? 'frutos_secos' : 'varios';

    const productPayload: Product = {
      name: name.trim(),
      category,
      photo: photo || (operationalMode === 'granel' ? '🥜' : '📦'),
      costTotalUSD: Number(calculations.totalCostUSD.toFixed(2)),
      costTotalVES: Number(calculations.totalCostVES.toFixed(2)),
      totalWeightGrams: operationalMode === 'granel' ? calculations.totalGrams : undefined,
      packWeightGrams: operationalMode === 'granel' ? calculations.effectivePackGrams : undefined,
      packCount: operationalMode === 'granel' ? calculations.totalBolsas : finalStock,
      marginPercent: Number(marginPercent.toFixed(1)),
      costUnitUSD: Number(calculations.costUnitUSD.toFixed(4)),
      costUnitVES: Number(calculations.costUnitVES.toFixed(4)),
      priceUSD: Number(priceUSD.toFixed(2)),
      priceVES: Number((priceUSD * activeRate).toFixed(2)),
      stock: Math.max(0, finalStock),
      minStock,
      unitType: operationalMode === 'granel' ? 'Bolsa' : unitType,
      itemCategory: operationalMode === 'otros' ? itemCategory : 'Granel Embolsado',
      createdAt: product?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    try {
      if (isEditing && product?.id) {
        await updateWithSync(db.products, 'products', product.id, productPayload);
      } else {
        await addWithSync(db.products, 'products', productPayload);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error guardando producto:', err);
      alert('Ocurrió un error al guardar el producto.');
    }
  };

  const handleDelete = async () => {
    if (!product?.id) return;
    if (confirm(`¿Estás seguro de eliminar el producto "${product.name}" del inventario?`)) {
      await deleteWithSync(db.products, 'products', product.id);
      if (onSuccess) onSuccess();
      onClose();
    }
  };

  return (
    <div className="mn-modal-overlay p-0 sm:p-4 overflow-y-auto">
      <div className="mn-modal max-w-4xl w-full animate-scale-in my-0 sm:my-auto bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-[#E6E9EF] dark:border-slate-800 overflow-hidden flex flex-col max-h-[94dvh]">
        {/* ── DRAG HANDLE INDICATOR (iOS / Android Native) ── */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* ── HEADER SUPERIOR ── */}
        <div className="border-b border-[#E6E9EF] dark:border-slate-800 bg-gradient-to-r from-white via-[#F8F9FB] to-[#EEF2F6] dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 sm:px-7 py-3 flex items-center justify-between flex-shrink-0 z-10">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span className="text-[0.625rem] font-extrabold uppercase tracking-wider text-[#6161FF] bg-[#6161FF]/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles size={10} /> Inventario 2026
              </span>
              <span className="text-[0.6875rem] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck size={11} className="text-emerald-600" /> Tasa: {activeRate.toFixed(2)} Bs
              </span>
            </div>
            <h2 className="text-base sm:text-2xl font-black text-[#1D2132] dark:text-white tracking-tight flex items-center gap-2 truncate">
              <span>{photo}</span>
              <span className="truncate">{isEditing ? `Editar: ${product?.name}` : 'Nuevo Producto'}</span>
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-800 transition-colors tap-haptic"
                title="Eliminar producto"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              type="submit"
              form="product-pro-form"
              className="py-2 px-3 sm:py-2.5 sm:px-4 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-95 transition-all cursor-pointer tap-haptic"
            >
              <Save size={15} />
              <span className="hidden sm:inline">Guardar Producto</span>
              <span className="sm:hidden inline">Guardar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[#676879] dark:text-slate-400 hover:text-[#1D2132] dark:hover:text-white transition-colors tap-haptic"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* ── SELECTOR DE MODALIDAD DUAL (REQUERIMIENTO 1: OTRA SECCIÓN PARA OTRAS COSAS) ── */}
        <div className="px-3 sm:px-7 pt-3 pb-2 bg-white dark:bg-slate-900 border-b border-[#F0F1F3] dark:border-slate-800">
          <div className="grid grid-cols-2 p-1 bg-[#F0F1F3] dark:bg-slate-800 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => {
                setOperationalMode('granel');
                setPhoto('🥜');
              }}
              className={`py-2 px-2 sm:py-2.5 sm:px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all tap-haptic ${
                operationalMode === 'granel'
                  ? 'bg-white dark:bg-slate-700 text-[#1D2132] dark:text-white shadow-sm ring-1 ring-black/5 font-black'
                  : 'text-[#676879] dark:text-slate-400 hover:text-[#1D2132] dark:hover:text-white'
              }`}
            >
              <Scale size={15} className={operationalMode === 'granel' ? 'text-[#6161FF]' : ''} />
              <span className="hidden sm:inline">🌾 Granel & Embolsado (Por Sacos / Kilos a Bolsas)</span>
              <span className="sm:hidden inline text-[0.75rem]">🌾 Granel a Bolsas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setOperationalMode('otros');
                setPhoto('📦');
              }}
              className={`py-2 px-2 sm:py-2.5 sm:px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition-all tap-haptic ${
                operationalMode === 'otros'
                  ? 'bg-white dark:bg-slate-700 text-[#1D2132] dark:text-white shadow-sm ring-1 ring-black/5 font-black'
                  : 'text-[#676879] dark:text-slate-400 hover:text-[#1D2132] dark:hover:text-white'
              }`}
            >
              <Boxes size={15} className={operationalMode === 'otros' ? 'text-[#00CA72]' : ''} />
              <span className="hidden sm:inline">📦 Otras Cosas (Mercancía General / Víveres / Insumos)</span>
              <span className="sm:hidden inline text-[0.75rem]">📦 Otras Cosas</span>
            </button>
          </div>
        </div>

        {/* ── CUERPO DEL FORMULARIO CON SCROLL ── */}
        <form id="product-pro-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 sm:p-7 space-y-6">
          {/* ── 1. IDENTIFICACIÓN DEL PRODUCTO ── */}
          <div className="bg-[#F8F9FC] p-4 sm:p-5 rounded-2xl border border-[#E6E9EF] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#6161FF] uppercase tracking-wider flex items-center gap-1.5">
                <Package size={15} /> 1. Identificación y Nombre del Producto
              </span>
              <span className="text-xs text-[#676879]">
                {operationalMode === 'granel' ? 'Frutos Secos, Maní, Granos o Polvo' : 'Mercancía General y Víveres'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
              {/* Selector de Icono / Emoji */}
              <div className="sm:col-span-2">
                <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                  Icono
                </label>
                <div className="flex items-center gap-1">
                  <div className="w-11 h-11 rounded-xl bg-white border border-[#E6E9EF] flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                    {photo}
                  </div>
                  <select
                    value={photo}
                    onChange={(e) => setPhoto(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-[#E6E9EF] rounded-xl text-[#323338] h-11 focus:outline-none focus:ring-2 focus:ring-[#6161FF]/30"
                  >
                    {(operationalMode === 'granel' ? EMOJIS_GRANEL : EMOJIS_OTROS).map((em) => (
                      <option key={em} value={em}>{em}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nombre del Producto */}
              <div className={operationalMode === 'otros' ? 'sm:col-span-6' : 'sm:col-span-10'}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[0.6875rem] font-black text-[#1D2132] uppercase">
                    Nombre Oficial del Producto *
                  </label>
                  {selectedPreset && (
                    <span className="text-[0.625rem] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={11} /> Precio Tomado: ${selectedPreset.priceUSD.toFixed(2)} USD
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    list="tarifario-products-list"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={
                      operationalMode === 'granel'
                        ? 'Ej: Maní Tostado Salado, Merey Entero, Granola Premium, Caraotas Negras...'
                        : 'Ej: Galletas María, Chocolate con Leche, Aceite de Oliva 500ml, Harina PAN...'
                    }
                    className="w-full p-2.5 px-3.5 bg-white border border-[#E6E9EF] rounded-xl text-sm font-bold text-[#1D2132] focus:outline-none focus:ring-2 focus:ring-[#6161FF] shadow-sm uppercase"
                  />
                  <datalist id="tarifario-products-list">
                    {availablePresets.map((p) => (
                      <option key={p.id} value={p.name}>
                        ${p.priceUSD.toFixed(2)} USD · {p.category}
                      </option>
                    ))}
                  </datalist>
                </div>

                {/* Banner de Precio Tomado del Tarifario */}
                {selectedPreset ? (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[0.625rem] font-black shadow-sm flex-shrink-0">
                        ✓
                      </span>
                      <div>
                        <span className="font-black text-emerald-800">
                          Precio por unidad fijado en Tarifario:
                        </span>{' '}
                        <span className="font-extrabold text-[#1D2132] font-mono">
                          ${selectedPreset.priceUSD.toFixed(2)} USD
                        </span>{' '}
                        <span className="text-emerald-700 font-mono">
                          (≈ {formatCurrency(selectedPreset.priceUSD * activeRate, 'VES')})
                        </span>
                      </div>
                    </div>
                    <span className="text-[0.625rem] font-black uppercase tracking-wider text-emerald-700 bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
                      Auto-Cargado
                    </span>
                  </div>
                ) : (
                  /* Chips rápidos con productos del Tarifario */
                  availablePresets.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[0.625rem] font-bold text-[#676879] flex items-center gap-1">
                        <Tag size={10} className="text-[#6161FF]" /> Del Tarifario:
                      </span>
                      {availablePresets.slice(0, 6).map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="px-2 py-0.5 rounded-lg bg-white hover:bg-[#6161FF] text-[#323338] hover:text-white border border-[#E6E9EF] text-[0.6875rem] font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title={`Tomar ${preset.name} a $${preset.priceUSD.toFixed(2)} USD`}
                        >
                          <span>{preset.photo || '🏷️'}</span>
                          <span className="uppercase">{preset.name}</span>
                          <span className="text-[#00CA72] group-hover:text-white font-mono">
                            ${preset.priceUSD.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* Categoría para "Otras Cosas" */}
              {operationalMode === 'otros' && (
                <div className="sm:col-span-4">
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Apartado / Clasificación
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E6E9EF] rounded-xl text-xs font-bold text-[#1D2132] h-11 focus:outline-none focus:ring-2 focus:ring-[#6161FF]"
                  >
                    {OTHER_ITEM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── 2 Y 3. CANTIDAD Y COSTO (MODO GRANEL: SACOS O KILOS) ── */}
          {operationalMode === 'granel' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 2. Cantidad por Saco o por Kilos */}
              <div className="bg-white p-5 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
                    <Scale size={15} className="text-[#6161FF]" /> 2. Cantidad (Por Saco o Kilos)
                  </span>
                  <div className="flex bg-[#F0F1F3] p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setBulkInputMode('saco')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        bulkInputMode === 'saco' ? 'bg-white text-[#1D2132] shadow-sm font-black' : 'text-[#676879]'
                      }`}
                    >
                      Por Sacos
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkInputMode('kilos')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        bulkInputMode === 'kilos' ? 'bg-white text-[#1D2132] shadow-sm font-black' : 'text-[#676879]'
                      }`}
                    >
                      Por Kilos
                    </button>
                  </div>
                </div>

                {bulkInputMode === 'saco' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                          N° de Sacos
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={sackCount}
                          onChange={(e) => setSackCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-sm font-black text-[#1D2132]"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                          Kg por cada Saco
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="0.5"
                          value={weightPerSackKg}
                          onChange={(e) => setWeightPerSackKg(parseFloat(e.target.value) || 50)}
                          className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-sm font-black text-[#1D2132]"
                        />
                      </div>
                    </div>

                    {/* Presets de peso por saco */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[0.625rem] text-[#676879] font-bold">Presets:</span>
                      {SACK_WEIGHT_PRESETS.map((kg) => (
                        <button
                          key={kg}
                          type="button"
                          onClick={() => setWeightPerSackKg(kg)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                            weightPerSackKg === kg
                              ? 'bg-[#6161FF] text-white font-bold'
                              : 'bg-[#F0F1F3] text-[#676879] hover:bg-gray-200'
                          }`}
                        >
                          {kg} Kg
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                      Kilos Totales Directos
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={directKilos}
                        onChange={(e) => setDirectKilos(parseFloat(e.target.value) || 0)}
                        placeholder="Ej: 50.0"
                        className="w-full p-2.5 pr-10 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-base font-black text-[#1D2132]"
                      />
                      <span className="absolute right-3 top-3 text-xs font-bold text-[#676879]">Kg</span>
                    </div>
                  </div>
                )}

                {/* Sub-tarjeta de resumen de masa */}
                <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between text-xs">
                  <span className="text-[#6161FF] font-bold">Masa Total del Lote:</span>
                  <span className="font-black text-[#1D2132] font-mono">
                    {calculations.totalKilos} Kg · ({calculations.totalGrams.toLocaleString('es-VE')} g)
                  </span>
                </div>
              </div>

              {/* 3. Precio del Producto por Kilo o Saco */}
              <div className="bg-white p-5 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign size={15} className="text-[#00CA72]" /> 3. Costo por Kilo o Saco
                  </span>
                  <div className="flex bg-[#F0F1F3] p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCostCurrency('USD')}
                      className={`px-2 py-0.5 rounded-md ${costCurrency === 'USD' ? 'bg-[#00CA72] text-white font-black' : 'text-[#676879]'}`}
                    >
                      $ USD
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostCurrency('VES')}
                      className={`px-2 py-0.5 rounded-md ${costCurrency === 'VES' ? 'bg-[#6161FF] text-white font-black' : 'text-[#676879]'}`}
                    >
                      Bs.
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Selector de modo de costo */}
                  <div className="flex items-center gap-1.5 bg-[#F8F9FB] p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setCostInputMode('por_saco')}
                      className={`flex-1 py-1 rounded-lg text-center ${costInputMode === 'por_saco' ? 'bg-white text-[#1D2132] shadow-sm' : 'text-[#676879]'}`}
                    >
                      Por Saco
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostInputMode('por_kilo')}
                      className={`flex-1 py-1 rounded-lg text-center ${costInputMode === 'por_kilo' ? 'bg-white text-[#1D2132] shadow-sm' : 'text-[#676879]'}`}
                    >
                      Por Kilo
                    </button>
                    <button
                      type="button"
                      onClick={() => setCostInputMode('total')}
                      className={`flex-1 py-1 rounded-lg text-center ${costInputMode === 'total' ? 'bg-white text-[#1D2132] shadow-sm' : 'text-[#676879]'}`}
                    >
                      Total Lote
                    </button>
                  </div>

                  <div>
                    <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                      {costInputMode === 'por_saco'
                        ? `Costo de 1 Saco (${costCurrency})`
                        : costInputMode === 'por_kilo'
                        ? `Costo de 1 Kilo (${costCurrency})`
                        : `Costo Total Invertido (${costCurrency})`}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={costValue}
                      onChange={(e) => setCostValue(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-base font-black text-[#1D2132]"
                    />
                  </div>

                  {/* Tarjeta de equivalencia de costo calculada */}
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-xs">
                    <span className="text-[#00CA72] font-bold">Inversión Total Estimada:</span>
                    <span className="font-black text-[#1D2132] font-mono">
                      {formatCurrency(calculations.totalCostUSD, 'USD')} · ({formatCurrency(calculations.totalCostVES, 'VES')})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Modo Otras Cosas: Costo Unitario y Stock */
            <div className="bg-white p-5 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={15} className="text-[#00CA72]" /> Costo Unitario de Adquisición
                </span>
                <span className="text-xs text-[#676879]">Unidad, Paquete o Caja</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Tipo de Presentación
                  </label>
                  <select
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-sm font-bold text-[#1D2132]"
                  >
                    {UNIT_TYPES.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Costo Unitario ($ USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={otherUnitCostUSD}
                    onChange={(e) => setOtherUnitCostUSD(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-sm font-black text-[#1D2132]"
                  />
                  <span className="text-[0.6875rem] text-[#676879] font-mono mt-0.5 block">
                    ≈ {formatCurrency(otherUnitCostUSD * activeRate, 'VES')}
                  </span>
                </div>

                <div>
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Existencia Inicial (Unidades)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={otherStock}
                    onChange={(e) => setOtherStock(parseInt(e.target.value) || 0)}
                    className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-sm font-black text-[#1D2132]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 4 Y 5. GRAMAJE POR UNIDAD Y BOLSAS SALIENTES (REQUERIMIENTOS 4 Y 5) ── */}
          {operationalMode === 'granel' && (
            <div className="bg-gradient-to-br from-white to-[#F8F9FD] p-5 sm:p-6 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
                  <Calculator size={15} className="text-[#6161FF]" /> 4. Gramaje de Cada Bolsa y 5. Bolsas Resultantes
                </span>
                <span className="text-xs font-bold text-[#6161FF]">
                  Rendimiento: {calculations.bagsPerKg.toFixed(1)} bolsas por cada Kilo
                </span>
              </div>

              {/* Chips de selección de Gramaje */}
              <div>
                <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1.5">
                  Selecciona el Gramaje de la Bolsa
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PACK_WEIGHT_PRESETS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setPackGrams(g);
                        setCustomPackGrams('');
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        packGrams === g
                          ? 'bg-[#6161FF] text-white shadow-md shadow-[#6161FF]/30 scale-105'
                          : 'bg-white hover:bg-gray-100 text-[#323338] border border-[#E6E9EF]'
                      }`}
                    >
                      {g >= 1000 ? `${g / 1000} Kg` : `${g} g`}
                    </button>
                  ))}

                  <div className="flex items-center gap-1 ml-1">
                    <input
                      type="number"
                      placeholder="Otro g"
                      value={customPackGrams}
                      onChange={(e) => {
                        setCustomPackGrams(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (val > 0) setPackGrams(val);
                      }}
                      className="w-20 p-1.5 bg-white border border-[#E6E9EF] rounded-xl text-xs font-bold text-center focus:ring-2 focus:ring-[#6161FF]"
                    />
                    <span className="text-xs text-[#676879] font-bold">g</span>
                  </div>
                </div>
              </div>

              {/* TARJETA DESTACADA DEL RESULTADO DE BOLSAS (PUNTO 5) */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#1D2132] via-[#292F4C] to-[#1D2132] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#6161FF] flex items-center justify-center text-2xl flex-shrink-0 shadow-md">
                    📦
                  </div>
                  <div>
                    <div className="text-[0.6875rem] font-bold text-white/70 uppercase tracking-wider">
                      Producción Total del Lote
                    </div>
                    <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                      {calculations.totalBolsas.toLocaleString('es-VE')}{' '}
                      <span className="text-base font-bold text-[#00CA72]">Bolsas</span>
                    </div>
                    <div className="text-xs text-white/80 mt-0.5">
                      Presentación de <strong>{calculations.effectivePackGrams} gramos</strong> por empaque
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-white/15 pt-2 sm:pt-0 sm:pl-5 space-y-1">
                  <div className="text-xs font-semibold text-[#00CA72]">
                    ✓ Rendimiento: {calculations.bagsPerKg.toFixed(1)} bolsas/kg
                  </div>
                  <div className="text-xs text-white/70">
                    Sobrante técnico: {calculations.mermaGrams} g
                  </div>
                  <div className="text-[0.6875rem] text-white/50 font-mono">
                    Lote de {calculations.totalKilos} Kg
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 6. EXISTENCIA EN ALMACÉN (REQUERIMIENTO 6) ── */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
                <Package size={15} className="text-[#6161FF]" /> 6. Existencia en Almacén (Stock Actual)
              </span>
              {operationalMode === 'granel' && (
                <button
                  type="button"
                  onClick={() => {
                    setStockSyncedWithBatch(true);
                    setStockManual(calculations.totalBolsas);
                  }}
                  className="text-xs font-bold text-[#6161FF] hover:underline flex items-center gap-1"
                >
                  <Sparkles size={12} /> Sincronizar con {calculations.totalBolsas} bolsas del lote
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="sm:col-span-2">
                <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                  Unidades disponibles para despacho y venta
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      operationalMode === 'granel'
                        ? stockManual
                        : otherStock
                    }
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      if (operationalMode === 'granel') {
                        setStockSyncedWithBatch(false);
                        setStockManual(val);
                      } else {
                        setOtherStock(val);
                      }
                    }}
                    placeholder="0"
                    className="w-full p-2.5 pr-20 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-base font-black text-[#1D2132]"
                  />
                  <span className="absolute right-3 top-3 text-xs font-bold text-[#676879]">
                    {operationalMode === 'granel' ? 'Bolsas' : unitType}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                  Alerta Stock Mínimo
                </label>
                <input
                  type="number"
                  min="1"
                  value={minStock}
                  onChange={(e) => setMinStock(parseInt(e.target.value) || 5)}
                  className="w-full p-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-sm font-bold text-[#1D2132]"
                />
              </div>
            </div>
          </div>

          {/* ── 7. ANÁLISIS DE COSTO Y RENDIMIENTO (REQUERIMIENTO 7) ── */}
          <div className="bg-white p-5 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-3">
            <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={15} className="text-[#6161FF]" /> 7. Análisis de Costo y Rendimiento
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Costo por Gramo */}
              <div className="p-3 rounded-xl bg-[#F8F9FB] border border-[#E6E9EF]">
                <div className="text-[0.625rem] font-bold text-[#676879] uppercase">Costo por Gramo</div>
                <div className="text-sm sm:text-base font-black font-mono text-[#1D2132] mt-0.5">
                  ${calculations.costPerGramUSD.toFixed(4)}
                </div>
                <div className="text-[0.625rem] text-[#676879] font-mono">
                  {calculations.costPerGramVES.toFixed(3)} Bs/g
                </div>
              </div>

              {/* Costo por Kilo */}
              <div className="p-3 rounded-xl bg-[#F8F9FB] border border-[#E6E9EF]">
                <div className="text-[0.625rem] font-bold text-[#676879] uppercase">Costo por Kilo</div>
                <div className="text-sm sm:text-base font-black font-mono text-[#1D2132] mt-0.5">
                  ${calculations.costPerKgUSD.toFixed(2)}
                </div>
                <div className="text-[0.625rem] text-[#676879] font-mono">
                  {calculations.costPerKgVES.toFixed(2)} Bs/Kg
                </div>
              </div>

              {/* Costo por Bolsa (Costo Unitario) */}
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <div className="text-[0.625rem] font-bold text-[#6161FF] uppercase">Costo por Bolsa</div>
                <div className="text-sm sm:text-base font-black font-mono text-[#6161FF] mt-0.5">
                  ${calculations.costUnitUSD.toFixed(3)}
                </div>
                <div className="text-[0.625rem] text-[#6161FF]/80 font-mono">
                  {calculations.costUnitVES.toFixed(2)} Bs/bolsa
                </div>
              </div>

              {/* Inversión Total Lote */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="text-[0.625rem] font-bold text-[#00CA72] uppercase">Inversión Lote</div>
                <div className="text-sm sm:text-base font-black font-mono text-[#00CA72] mt-0.5">
                  ${calculations.totalCostUSD.toFixed(2)}
                </div>
                <div className="text-[0.625rem] text-[#00CA72]/80 font-mono">
                  {calculations.totalCostVES.toFixed(2)} Bs
                </div>
              </div>
            </div>
          </div>

          {/* ── 8. IA ECONOMISTA Y ESTUDIO FINANCIERO EN VENEZUELA (REQUERIMIENTO 8) ── */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#181B26] via-[#212638] to-[#181B26] text-white shadow-xl space-y-4 border border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6161FF] to-[#A25DDC] flex items-center justify-center text-white shadow-md">
                  <Bot size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                    <span>Ares Finanzas · IA Economista de Venezuela</span>
                    <span className="text-[0.625rem] bg-[#00CA72] text-black px-1.5 py-0.2 rounded font-black">
                      ESTUDIO EN VIVO
                    </span>
                  </h3>
                  <p className="text-[0.6875rem] text-white/60">
                    Blindaje anti-inflacionario, evaluación de costo de reposición y viabilidad del negocio
                  </p>
                </div>
              </div>

              {/* Semáforo de Estado */}
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5 ${
                    aiFinancialStudy.status === 'optimo'
                      ? 'bg-[#00CA72]/20 text-[#00CA72] border border-[#00CA72]/40'
                      : aiFinancialStudy.status === 'moderado'
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  <Zap size={12} />
                  <span>{aiFinancialStudy.title}</span>
                </span>
              </div>
            </div>

            {/* Dictamen Económico de la IA */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs space-y-2">
              <p className="text-white/90 leading-relaxed">
                {aiFinancialStudy.description}{' '}
                <strong className="text-[#00CA72]">{aiFinancialStudy.recommendation}</strong>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10 text-center">
                <div>
                  <span className="text-[0.625rem] text-white/60 uppercase block">Costo de Reposición</span>
                  <span className="font-mono font-bold text-white text-xs">
                    ${aiFinancialStudy.breakEvenPriceUSD.toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="text-[0.625rem] text-white/60 uppercase block">Precio Sugerido IA</span>
                  <span className="font-mono font-black text-[#00CA72] text-xs">
                    ${aiFinancialStudy.aiSuggestedPriceUSD.toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="text-[0.625rem] text-white/60 uppercase block">Ganancia por Bolsa</span>
                  <span className="font-mono font-bold text-amber-300 text-xs">
                    +${aiFinancialStudy.profitPerUnitUSD.toFixed(2)} USD
                  </span>
                </div>
                <div>
                  <span className="text-[0.625rem] text-white/60 uppercase block">Utilidad Lote Completo</span>
                  <span className="font-mono font-black text-[#00CA72] text-xs">
                    +{formatCurrency(aiFinancialStudy.totalNetProfitUSD, 'USD')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 9. PORCENTAJE DE GANANCIA Y FIJACIÓN DE PRECIO (REQUERIMIENTO 9) ── */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E6E9EF] shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-1.5">
                <Percent size={15} className="text-[#6161FF]" /> 9. Fijación de Margen y Precio de Venta
              </span>
              <span className="text-xs font-black text-[#6161FF] font-mono">
                Margen Aplicado: +{marginPercent.toFixed(1)}%
              </span>
            </div>

            {/* Chips de porcentaje rápido */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#676879] font-bold">Márgenes Preset:</span>
              {MARGIN_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMarginChange(m)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                    Math.abs(marginPercent - m) < 0.5
                      ? 'bg-[#1D2132] text-white shadow-sm font-black'
                      : 'bg-[#F0F1F3] text-[#323338] hover:bg-gray-200'
                  }`}
                >
                  +{m}%
                </button>
              ))}
            </div>

            {/* Slider Táctil de Margen */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[0.6875rem] text-[#676879] font-bold">
                <span>10% (Bajo)</span>
                <span>35% (Equilibrio)</span>
                <span>50% (Recomendado Venezuela)</span>
                <span>100% (Alto)</span>
                <span>200% (Máximo)</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="1"
                value={Math.min(200, Math.max(10, marginPercent))}
                onChange={(e) => handleMarginChange(parseFloat(e.target.value))}
                className="w-full accent-[#6161FF] h-2 bg-gray-200 rounded-lg cursor-pointer"
              />
            </div>

            {/* Campos Bidireccionales de Precio de Venta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#F0F1F3]">
              {/* Precio USD */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[0.6875rem] font-black text-[#1D2132] uppercase">
                    Precio de Venta al Público ($ USD)
                  </label>
                  {selectedPreset && (
                    <span className="text-[0.625rem] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                      Fijado en Tarifario
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-sm font-bold text-[#676879]">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={priceUSD}
                    onChange={(e) => handlePriceUSDChange(e.target.value)}
                    className="w-full p-2.5 pl-8 bg-white border border-[#E6E9EF] rounded-xl text-lg font-black text-[#1D2132] focus:ring-2 focus:ring-[#6161FF]"
                  />
                </div>
                <span className="text-[0.6875rem] text-[#676879] mt-0.5 block">
                  Puedes escribir el precio deseado y se auto-calculará el margen.
                </span>
              </div>

              {/* Precio VES */}
              <div>
                <label className="block text-[0.6875rem] font-black text-[#1D2132] uppercase mb-1">
                  Precio de Venta en Bolívares (Bs.)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-sm font-bold text-[#676879]">Bs</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={priceVES}
                    onChange={(e) => handlePriceVESChange(e.target.value)}
                    className="w-full p-2.5 pl-9 bg-white border border-[#E6E9EF] rounded-xl text-lg font-black text-[#1D2132] focus:ring-2 focus:ring-[#6161FF]"
                  />
                </div>
                <span className="text-[0.6875rem] text-[#676879] mt-0.5 block">
                  A tasa activa: {activeRate.toFixed(2)} Bs / USD
                </span>
              </div>
            </div>

            {/* Acciones del Tarifario */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#F0F1F3]">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSaveToTarifario}
                  disabled={!name.trim() || priceUSD <= 0}
                  className="py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 disabled:opacity-40 text-[#6161FF] border border-purple-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Fijar este precio unitario en el Tarifario para que se auto-cargue la próxima vez"
                >
                  <Tag size={13} />
                  <span>Guardar este Precio en el Tarifario</span>
                </button>
                {savedToTarifarioNotice && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 animate-fade-in flex items-center gap-1">
                    <Check size={13} /> {savedToTarifarioNotice}
                  </span>
                )}
              </div>

              {selectedPreset && (
                <span className="text-[0.6875rem] text-[#676879]">
                  Vinculado al producto <strong>{selectedPreset.name}</strong> del Tarifario.
                </span>
              )}
            </div>
          </div>
        </form>

        {/* ── BARRA DE ACCIÓN FIJA INFERIOR PARA MÓVILES (FÁCIL ACCESO CON EL PULGAR) ── */}
        <div className="sm:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs active:bg-slate-100 transition-all text-center"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="product-pro-form"
            className="flex-2 py-3 px-4 rounded-xl bg-[#6161FF] text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-98 transition-all"
          >
            <Save size={16} />
            <span>Guardar Producto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
