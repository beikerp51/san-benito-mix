import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  Tag,
  CheckCircle2,
  Search,
  Sparkles,
  ShieldCheck,
  Save,
  ArrowRight,
} from 'lucide-react';
import type { ProductCategory } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import {
  loadPricePresets,
  savePricePreset,
  deletePricePreset,
  type ProductPricePreset,
} from '../../services/price-preset-service';

interface PricePresetsModalProps {
  onClose: () => void;
  onSelectPresetForNewProduct?: (preset: ProductPricePreset) => void;
}

const CATEGORY_OPTIONS: { key: ProductCategory; label: string; icon: string }[] = [
  { key: 'frutos_secos', label: 'Frutos Secos', icon: '🥜' },
  { key: 'platanitos', label: 'Platanitos', icon: '🍌' },
  { key: 'turrones', label: 'Turrones', icon: '🍫' },
  { key: 'varios', label: 'Varios / Otras Cosas', icon: '📦' },
];

const EMOJI_PRESETS = ['🥜', '🍌', '🍫', '📦', '🥣', '🌰', '🍇', '🧂', '🍬', '⚡', '☕', '🥤'];

export const PricePresetsModal: React.FC<PricePresetsModalProps> = ({
  onClose,
  onSelectPresetForNewProduct,
}) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const activeSource = useExchangeRateStore((s) => s.activeSource);

  const [presets, setPresets] = useState<ProductPricePreset[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProductCategory>('frutos_secos');
  const [priceUSD, setPriceUSD] = useState<string>('');
  const [packWeightGrams, setPackWeightGrams] = useState<string>('90');
  const [unitType, setUnitType] = useState('Bolsa');
  const [photo, setPhoto] = useState('🥜');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    refreshPresets();

    const handleUpdate = () => refreshPresets();
    window.addEventListener('sbm:price-presets-updated', handleUpdate);
    return () => window.removeEventListener('sbm:price-presets-updated', handleUpdate);
  }, []);

  const refreshPresets = async () => {
    const list = await loadPricePresets();
    setPresets(list);
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleEdit = (p: ProductPricePreset) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setPriceUSD(String(p.priceUSD));
    setPackWeightGrams(p.packWeightGrams ? String(p.packWeightGrams) : '90');
    setUnitType(p.unitType || 'Bolsa');
    setPhoto(p.photo || '🥜');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setPriceUSD('');
    setPackWeightGrams('90');
    setUnitType('Bolsa');
    setPhoto('🥜');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Por favor indica el nombre del producto.');
      return;
    }

    const priceNum = parseFloat(priceUSD);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('El precio por unidad debe ser mayor a 0.');
      return;
    }

    const weightNum = parseInt(packWeightGrams);

    await savePricePreset({
      id: editingId || undefined,
      name: name.trim().toUpperCase(),
      category,
      priceUSD: priceNum,
      packWeightGrams: !isNaN(weightNum) && weightNum > 0 ? weightNum : undefined,
      unitType,
      photo,
    });

    showToast(
      editingId
        ? `Precio de "${name.trim().toUpperCase()}" actualizado a $${priceNum.toFixed(2)} USD`
        : `"${name.trim().toUpperCase()}" agregado al tarifario con precio $${priceNum.toFixed(2)} USD`
    );

    handleCancelEdit();
    await refreshPresets();
  };

  const handleDelete = async (id: string, prodName: string) => {
    if (confirm(`¿Eliminar "${prodName}" del tarifario de precios?`)) {
      await deletePricePreset(id);
      showToast(`Producto "${prodName}" eliminado del tarifario.`);
      await refreshPresets();
    }
  };

  const filteredPresets = presets.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="mn-modal max-w-4xl w-full my-auto bg-white rounded-3xl shadow-2xl border border-[#E6E9EF] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Superior */}
        <div className="border-b border-[#E6E9EF] bg-gradient-to-r from-white via-[#F8F9FB] to-[#EEF2F6] px-5 sm:px-7 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.625rem] font-black uppercase tracking-wider text-[#6161FF] bg-[#6161FF]/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Tag size={11} /> Catálogo Maestro
              </span>
              <span className="text-xs text-[#C5C7D0]">·</span>
              <span className="text-[0.6875rem] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-600" /> Tasa Fijada (
                {activeSource === 'bcv_usd' ? 'BCV USD' : activeSource === 'bcv_eur' ? 'BCV EUR' : 'Binance USDT'}
                ): {activeRate.toFixed(2)} Bs
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#1D2132] tracking-tight flex items-center gap-2">
              <span>🏷️</span>
              <span>Tarifario de Precios por Unidad</span>
            </h2>
            <p className="text-xs text-[#676879] mt-0.5">
              Define los nombres y precios de venta fijos por unidad. Al agregar un nuevo producto, el sistema tomará este precio automáticamente.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-black/5 text-[#676879] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notificación de éxito */}
        {successToast && (
          <div className="bg-emerald-500 text-white px-5 py-2.5 text-xs font-bold flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="hover:opacity-80">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Contenido con scroll */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6">
          {/* Formulario de Registro / Edición */}
          <div className="p-5 rounded-2xl bg-[#F8F9FB] border border-[#E6E9EF] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black text-[#1D2132] uppercase tracking-wider flex items-center gap-2">
                <Sparkles size={15} className="text-[#6161FF]" />
                {editingId ? 'Editar Precio de Producto' : 'Fijar Nuevo Precio por Unidad'}
              </span>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-xs font-bold text-rose-600 hover:underline"
                >
                  Cancelar Edición
                </button>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                {/* Nombre del Producto */}
                <div className="sm:col-span-6">
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Nombre del Producto *
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: MANÍ MIXTO, GRANOLA, ALMENDRAS..."
                      className="w-full p-2.5 bg-white border border-[#E6E9EF] rounded-xl text-sm font-bold text-[#1D2132] focus:ring-2 focus:ring-[#6161FF]/30 uppercase"
                      required
                    />
                  </div>
                </div>

                {/* Categoría */}
                <div className="sm:col-span-3">
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => {
                      const cat = e.target.value as ProductCategory;
                      setCategory(cat);
                      if (cat === 'frutos_secos') setPhoto('🥜');
                      if (cat === 'platanitos') setPhoto('🍌');
                      if (cat === 'turrones') setPhoto('🍫');
                      if (cat === 'varios') setPhoto('📦');
                    }}
                    className="w-full p-2.5 bg-white border border-[#E6E9EF] rounded-xl text-xs font-bold text-[#1D2132]"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Precio por Unidad ($ USD) */}
                <div className="sm:col-span-3">
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Precio por Unidad ($ USD) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-bold text-[#00CA72]">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={priceUSD}
                      onChange={(e) => setPriceUSD(e.target.value)}
                      placeholder="1.25"
                      className="w-full p-2.5 pl-7 bg-white border border-[#E6E9EF] rounded-xl text-sm font-black font-mono text-[#1D2132] focus:ring-2 focus:ring-[#00CA72]/30"
                      required
                    />
                  </div>
                  {parseFloat(priceUSD) > 0 && (
                    <span className="text-[0.6875rem] font-mono font-bold text-[#6161FF] mt-1 block">
                      ≈ {formatCurrency(parseFloat(priceUSD) * activeRate, 'VES')}
                    </span>
                  )}
                </div>
              </div>

              {/* Fila secundaria: Gramaje por bolsa y Selector de icono */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Gramaje Sugerido por Bolsa (g)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="5"
                    value={packWeightGrams}
                    onChange={(e) => setPackWeightGrams(e.target.value)}
                    placeholder="90"
                    className="w-full p-2.5 bg-white border border-[#E6E9EF] rounded-xl text-sm font-bold text-[#1D2132]"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[0.6875rem] font-bold text-[#676879] uppercase mb-1">
                    Presentación
                  </label>
                  <input
                    type="text"
                    value={unitType}
                    onChange={(e) => setUnitType(e.target.value)}
                    placeholder="Bolsa, Unidad, Paquete..."
                    className="w-full p-2.5 bg-white border border-[#E6E9EF] rounded-xl text-sm font-bold text-[#1D2132]"
                  />
                </div>

                <div className="sm:col-span-4 flex items-center gap-1.5 flex-wrap">
                  <label className="w-full block text-[0.6875rem] font-bold text-[#676879] uppercase">
                    Icono
                  </label>
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    {EMOJI_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setPhoto(emoji)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all ${
                          photo === emoji
                            ? 'bg-[#6161FF] text-white shadow-sm ring-2 ring-[#6161FF]'
                            : 'bg-white hover:bg-gray-100 border border-[#E6E9EF]'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón de acción */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="py-2.5 px-5 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-md shadow-[#6161FF]/30 active:scale-95 transition-all cursor-pointer"
                >
                  <Save size={15} />
                  <span>{editingId ? 'Guardar Cambios de Precio' : 'Guardar en Tarifario'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Listado de Productos y Precios Fijados */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#1D2132]">
                  Precios Registrados en el Sistema ({filteredPresets.length})
                </h3>
                <p className="text-xs text-[#676879]">
                  Estos precios se sugerirán y cargarán automáticamente cuando abras "Nuevo Producto".
                </p>
              </div>

              {/* Buscador y filtro */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-48">
                  <Search size={14} className="absolute left-3 top-2.5 text-[#676879]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar producto..."
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-xs font-bold text-[#1D2132]"
                  />
                </div>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="py-1.5 px-2.5 bg-[#F8F9FB] border border-[#E6E9EF] rounded-xl text-xs font-bold text-[#676879]"
                >
                  <option value="all">Todas</option>
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Grid de Tarjetas de Precios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredPresets.length === 0 ? (
                <div className="col-span-full py-10 text-center text-xs text-[#676879]">
                  No se encontraron productos en el tarifario. ¡Agrega el primero arriba!
                </div>
              ) : (
                filteredPresets.map((p) => {
                  const vesEquivalent = p.priceUSD * activeRate;
                  return (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-2xl border border-[#E6E9EF] bg-white hover:border-[#CCD1DD] transition-all flex flex-col justify-between group shadow-sm hover:shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-2xl p-2 rounded-xl bg-[#F8F9FB] border border-[#E6E9EF]">
                            {p.photo || '📦'}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-[#1D2132] truncate uppercase">
                              {p.name}
                            </h4>
                            <span className="text-[0.625rem] font-bold text-[#6161FF] bg-[#6161FF]/10 px-1.5 py-0.2 rounded">
                              {CATEGORY_OPTIONS.find((c) => c.key === p.category)?.label || p.category}
                            </span>
                            {p.packWeightGrams && (
                              <span className="text-[0.625rem] text-[#676879] ml-1.5">
                                · {p.packWeightGrams}g ({p.unitType || 'Bolsa'})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleEdit(p)}
                            className="p-1 rounded-lg hover:bg-gray-100 text-[#676879] hover:text-[#1D2132]"
                            title="Editar precio"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1 rounded-lg hover:bg-rose-50 text-rose-500"
                            title="Eliminar del tarifario"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Display del Precio Fijado */}
                      <div className="mt-3 pt-2.5 border-t border-[#F0F1F3] flex items-end justify-between">
                        <div>
                          <span className="text-[0.625rem] font-bold text-[#676879] uppercase block">
                            Precio de Venta Fijado:
                          </span>
                          <div className="text-base font-black font-mono text-[#00CA72]">
                            {formatCurrency(p.priceUSD, 'USD')}
                          </div>
                          <span className="text-[0.6875rem] font-mono text-[#676879] block">
                            ≈ {formatCurrency(vesEquivalent, 'VES')}
                          </span>
                        </div>

                        {onSelectPresetForNewProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectPresetForNewProduct(p);
                              onClose();
                            }}
                            className="py-1 px-2.5 rounded-lg bg-[#6161FF]/10 hover:bg-[#6161FF] text-[#6161FF] hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Usar este precio para agregar nuevo producto"
                          >
                            <span>Usar</span>
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F8F9FB] border-t border-[#E6E9EF] flex items-center justify-between text-xs text-[#676879]">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#6161FF]" /> Los precios configurados aquí se sincronizan automáticamente en toda la red local.
          </span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 rounded-xl bg-white hover:bg-gray-100 border border-[#E6E9EF] font-bold text-[#1D2132]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
