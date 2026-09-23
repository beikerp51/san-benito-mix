import React, { useState, useEffect, useMemo } from 'react';
import { FrutosSecosForm } from './frutos-secos-form';
import { ProductFormModal } from './product-form-modal';
import { PlatanitosForm } from './platanitos-form';
import { TurronesForm } from './turrones-form';
import { VariosForm } from './varios-form';
import { DispatchesView } from './dispatches-view';
import { DispatchModal } from './dispatch-modal';
import { StarProductsWidget } from './star-products-widget';
import { db, type Product } from '../../db/database';
import { useExchangeRateStore, formatCurrency, formatUnitPlural } from '../../services/exchange-rate-service';
import { usePermission, useAuthStore } from '../../auth/auth-store';
import { MnSearch } from '../../components/ios-components';
import { Plus, TrendingUp, Package, AlertTriangle, Edit2, Layers, Send, Star, Tag, ChevronRight } from 'lucide-react';
import { PricePresetsModal } from './price-presets-modal';
import type { ProductPricePreset } from '../../services/price-preset-service';

interface TabItem {
  key: string;
  label: string;
  icon?: React.FC<{ size: number; className?: string }>;
}

export const InventoryPage: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';

  // Dynamic tab list: Master NEVER sees "Entregas de Mercancía"
  const tabs: TabItem[] = useMemo(() => {
    const base: TabItem[] = [
      { key: 'frutos_secos', label: 'Frutos Secos' },
      { key: 'platanitos', label: 'Platanitos' },
      { key: 'turrones', label: 'Turrones' },
      { key: 'varios', label: 'Varios' },
    ];

    if (isAdmin) {
      base.push({ key: 'dispatches', label: 'Entregas a Dirección', icon: Send });
    }

    base.push({ key: 'stars', label: 'Productos Estrella', icon: Star });

    return base;
  }, [isAdmin]);

  const [activeTabKey, setActiveTabKey] = useState<string>('frutos_secos');
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showPricePresetsModal, setShowPricePresetsModal] = useState(false);
  const [selectedPresetForNewProduct, setSelectedPresetForNewProduct] = useState<ProductPricePreset | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const canViewCosts = usePermission('viewCosts');
  const canViewMargins = usePermission('viewMargins');

  const isCatalogTab = ['frutos_secos', 'platanitos', 'turrones', 'varios'].includes(activeTabKey);

  useEffect(() => {
    loadProducts();

    const handleSync = () => {
      loadProducts();
    };
    window.addEventListener('sbm:sync', handleSync);
    return () => {
      window.removeEventListener('sbm:sync', handleSync);
    };
  }, [activeTabKey]);

  const loadProducts = async () => {
    if (isCatalogTab) {
      const items = await db.products.where('category').equals(activeTabKey).toArray();
      setProducts(items);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProduct(null);
    setSelectedPresetForNewProduct(null);
    loadProducts();
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.flavor && p.flavor.toLowerCase().includes(search.toLowerCase()))
  );

  const totalStock = filteredProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalValueUSD = filteredProducts.reduce((sum, p) => sum + p.priceUSD * p.stock, 0);

  const activeTabObj = tabs.find((t) => t.key === activeTabKey) || tabs[0];

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      {/* Category Navigation Bar (Monday Tabs) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-[#E6E9EF] dark:border-slate-800 pb-3">
        {/* Horizontal Navigation Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[#F0F1F3] dark:bg-slate-800/90 rounded-xl scrollbar-none">
          {tabs.map((tab) => {
            const isSelected = activeTabKey === tab.key;
            const Icon = tab.icon;
            const isDispatches = tab.key === 'dispatches';

            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTabKey(tab.key);
                  setSearch('');
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? isDispatches
                      ? 'bg-[#6161FF] text-white shadow-sm font-bold'
                      : 'bg-white dark:bg-slate-700 text-[#323338] dark:text-white shadow-sm font-bold'
                    : isDispatches
                    ? 'text-[#6161FF] dark:text-indigo-400 hover:bg-white/60 dark:hover:bg-slate-700 font-bold'
                    : 'text-[#676879] dark:text-slate-400 hover:text-[#323338] dark:hover:text-white'
                }`}
              >
                {Icon && (
                  <Icon
                    size={13}
                    className={tab.key === 'stars' ? 'text-amber-500 fill-amber-500' : undefined}
                  />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls & Dispatch Trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {isCatalogTab && (
            <div className="flex-1 min-w-[200px]">
              <MnSearch value={search} onChange={setSearch} placeholder="Buscar producto o sabor..." />
            </div>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {/* Delivery Button: ONLY FOR ADMINISTRADORA */}
            {isAdmin && (
              <button
                onClick={() => setShowDispatchModal(true)}
                className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#6161FF] to-[#A25DDC] hover:from-[#5050E6] hover:to-[#8E44AD] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-[#6161FF]/30 tap-haptic whitespace-nowrap flex-shrink-0 cursor-pointer"
                title="Entregar mercancía y descontar automáticamente del inventario"
              >
                <Send size={13} />
                <span>Entregar</span>
              </button>
            )}

            {isCatalogTab && (
              <button
                onClick={() => setShowPricePresetsModal(true)}
                className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 tap-haptic whitespace-nowrap shadow-xs flex-shrink-0 cursor-pointer"
                title="Fijar nombres y precios de venta por unidad (Tarifario Base)"
              >
                <Tag size={13} className="text-[#00CA72]" />
                <span className="hidden min-[400px]:inline">Tarifario</span>
                <span className="min-[400px]:hidden">Tarifas</span>
              </button>
            )}

            {isCatalogTab && (
              <button
                onClick={handleAdd}
                className="py-2 px-3 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white text-xs font-bold flex items-center gap-1.5 tap-haptic whitespace-nowrap shadow-xs shadow-[#6161FF]/25 flex-shrink-0 cursor-pointer"
              >
                <Plus size={13} />
                <span>Nuevo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Bar for Catalog Categories (Compact 2-col on mobile) */}
      {isCatalogTab && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
          <div className="mn-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-[#0086C9] flex items-center justify-center flex-shrink-0">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[0.6875rem] sm:text-xs text-[#676879] font-medium truncate">Stock Almacén</div>
              <div className="text-base sm:text-xl font-black text-[#323338] truncate">{totalStock} Unds</div>
            </div>
          </div>

          {canViewMargins && (
            <div className="mn-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-[#00CA72] flex items-center justify-center flex-shrink-0">
                <TrendingUp size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[0.6875rem] sm:text-xs text-[#676879] font-medium truncate">Valor Inventario</div>
                <div className="text-base sm:text-xl font-black text-[#323338] truncate">
                  {formatCurrency(totalValueUSD, 'USD')}
                </div>
              </div>
            </div>
          )}

          <div
            className={`mn-card p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3 ${
              canViewMargins ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-[#A25DDC] flex items-center justify-center flex-shrink-0">
              <Layers size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-[0.6875rem] sm:text-xs text-[#676879] font-medium truncate">Contravalor Bs</div>
              <div className="text-base sm:text-xl font-black text-[#323338] truncate">
                {formatCurrency(totalValueUSD * activeRate, 'VES')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conditional Views Rendering */}
      {isCatalogTab ? (
        <div className="mn-card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="mn-group-header bg-white dark:bg-slate-900 border-b border-[#E6E9EF] dark:border-slate-800">
            <div className="mn-group-color" style={{ background: '#5050E6' }} />
            <span className="text-sm font-bold text-[#323338] dark:text-white">
              {activeTabObj.label} — Catálogo Activo
            </span>
            <span className="text-xs text-[#676879] dark:text-slate-400 font-normal">
              ({filteredProducts.length} productos)
            </span>
          </div>

          {/* Vista de Tarjetas Móviles Super Senior (iOS / Android) */}
          <div className="md:hidden p-3 space-y-3 bg-[#F8FAFC] dark:bg-slate-950/40">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-[#676879] dark:text-slate-400 shadow-xs">
                <span className="text-3xl block mb-2">📦</span>
                No hay productos registrados en esta categoría.{' '}
                <button onClick={handleAdd} className="text-[#6161FF] dark:text-indigo-400 font-bold underline block mt-2 text-sm">
                  Crear primer producto
                </button>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const effectiveMinStock = product.minStock || 5;
                const isLowStock = product.stock <= effectiveMinStock && product.stock > 0;
                const isOutOfStock = product.stock <= 0;

                return (
                  <div
                    key={product.id}
                    onClick={() => handleEdit(product)}
                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_2px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-md active:scale-[0.985] transition-all cursor-pointer space-y-3 relative overflow-hidden group"
                  >
                    {/* Top Row: Icon + Name & Status Badges */}
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center text-2xl flex-shrink-0 shadow-xs">
                        {product.photo || '📦'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-snug truncate">
                            {product.name}
                          </h3>
                          <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0 group-hover:text-indigo-600 transition-colors" />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {product.flavor && (
                            <span className="text-[0.6875rem] font-bold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-lg">
                              {product.flavor}
                            </span>
                          )}

                          <span
                            className={`font-black px-2 py-0.5 rounded-lg text-[0.6875rem] flex items-center gap-1 ${
                              isOutOfStock
                                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                : isLowStock
                                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isOutOfStock ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                            />
                            {product.stock} {formatUnitPlural(product.unitType, product.stock)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Large Hero Price & Countervalues */}
                    <div className="flex items-end justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Precio de Venta
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="font-mono font-black text-lg text-[#6161FF] dark:text-indigo-400 tracking-tight">
                            {formatCurrency(product.priceUSD, 'USD')}
                          </span>
                          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                            ≈ {formatCurrency(product.priceUSD * activeRate, 'VES')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        {canViewMargins && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-black border border-emerald-200/80 dark:border-emerald-800">
                            +{product.marginPercent}%
                          </span>
                        )}
                        {canViewCosts && product.costUnitUSD && (
                          <span className="block text-[0.625rem] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            Costo: ${product.costUnitUSD.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Tabla para Pantallas Medianas y Grandes */}
          <div className="hidden md:block overflow-x-auto">
            <table className="mn-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>FOTO</th>
                  <th>DESCRIPCIÓN DE PRODUCTO</th>
                  <th style={{ width: 140 }}>ESTADO</th>
                  <th style={{ width: 120, textAlign: 'right' }}>UNIDADES</th>
                  {canViewCosts && <th style={{ width: 120, textAlign: 'right' }}>COSTO U.</th>}
                  <th style={{ width: 130, textAlign: 'right' }}>PRECIO VENTA</th>
                  {canViewMargins && <th style={{ width: 100, textAlign: 'center' }}>MARGEN</th>}
                  <th style={{ width: 140, textAlign: 'right' }}>VALOR TOTAL</th>
                  <th style={{ width: 80, textAlign: 'center' }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={canViewCosts && canViewMargins ? 9 : 7} className="text-center py-12 text-sm text-[#676879]">
                      No hay productos registrados en esta categoría.{' '}
                      <button onClick={handleAdd} className="text-[#6161FF] font-semibold underline ml-1">
                        Crear primer producto
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const effectiveMinStock = product.minStock || 5;
                    const isLowStock = product.stock <= effectiveMinStock && product.stock > 0;
                    const isOutOfStock = product.stock <= 0;

                    return (
                      <tr
                        key={product.id}
                        onClick={() => handleEdit(product)}
                        className="cursor-pointer hover:bg-[#F5F6F8] transition-colors"
                      >
                        {/* Icon */}
                        <td className="mn-table-cell text-center">
                          <div className="w-9 h-9 rounded-lg bg-[#F0F1F3] flex items-center justify-center text-lg mx-auto">
                            {product.photo || '📦'}
                          </div>
                        </td>

                        {/* Name & Flavor / Rubro */}
                        <td className="mn-table-cell">
                          <div>
                            <div className="font-bold text-xs text-[#323338]">{product.name}</div>
                            {product.category === 'frutos_secos' && product.packWeightGrams && (
                              <div className="text-[0.6875rem] text-[#6161FF] font-semibold mt-0.5 flex items-center gap-1.5">
                                <span className="bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                  {product.packWeightGrams}g
                                </span>
                                {product.packWeightGrams > 0 && product.priceUSD > 0 && (
                                  <span className="text-[#676879] font-mono">
                                    ≈ {formatCurrency((1000 / product.packWeightGrams) * product.priceUSD, 'USD')}/Kg
                                  </span>
                                )}
                              </div>
                            )}
                            {product.flavor && (
                              <div className="text-xs text-[#676879] font-medium mt-0.5">
                                Variedad: {product.flavor}
                              </div>
                            )}
                            {product.category === 'varios' && (product.itemCategory || product.sku) && (
                              <div className="text-[0.6875rem] text-[#676879] mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {product.itemCategory && (
                                  <span className="bg-purple-50 text-[#A25DDC] px-1.5 py-0.5 rounded font-semibold border border-purple-100">
                                    {product.itemCategory}
                                  </span>
                                )}
                                {product.sku && (
                                  <span className="font-mono text-[#8C8F9F] bg-gray-100 px-1 py-0.2 rounded text-[0.625rem]">
                                    SKU: {product.sku}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Stock Status */}
                        <td className="mn-table-cell">
                          {isOutOfStock ? (
                            <span className="mn-pill mn-pill-red">Agotado</span>
                          ) : isLowStock ? (
                            <span className="mn-pill mn-pill-orange">Stock Bajo (&le;{effectiveMinStock})</span>
                          ) : (
                            <span className="mn-pill mn-pill-green">Disponible</span>
                          )}
                        </td>

                        {/* Stock Units */}
                        <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#323338]">
                          {product.stock} {formatUnitPlural(product.unitType, product.stock)}
                        </td>

                        {/* Cost */}
                        {canViewCosts && (
                          <td className="mn-table-cell text-right font-mono text-xs text-[#676879]">
                            {formatCurrency(product.costUnitUSD, 'USD')}
                          </td>
                        )}

                        {/* Price USD */}
                        <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#6161FF]">
                          {formatCurrency(product.priceUSD, 'USD')}
                        </td>

                        {/* Margin */}
                        {canViewMargins && (
                          <td className="mn-table-cell text-center text-xs font-bold text-[#00CA72]">
                            +{product.marginPercent}%
                          </td>
                        )}

                        {/* Total Value */}
                        <td className="mn-table-cell text-right font-mono font-semibold text-xs text-[#323338]">
                          {formatCurrency(product.priceUSD * product.stock, 'USD')}
                        </td>

                        {/* Action */}
                        <td className="mn-table-cell text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(product);
                            }}
                            className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879] hover:text-[#6161FF]"
                            title="Editar producto"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTabKey === 'dispatches' ? (
        /* Dispatches View (Administradora Only) */
        <DispatchesView />
      ) : (
        /* Star Products & Real Profitability Dashboard */
        <StarProductsWidget />
      )}

      {/* Forms */}
      {showForm && editingProduct?.category === 'platanitos' ? (
        <PlatanitosForm product={editingProduct} onClose={handleFormClose} />
      ) : showForm && editingProduct?.category === 'turrones' ? (
        <TurronesForm product={editingProduct} onClose={handleFormClose} />
      ) : showForm ? (
        <ProductFormModal
          product={editingProduct}
          defaultCategory={activeTabKey as any}
          initialPreset={selectedPresetForNewProduct}
          onClose={handleFormClose}
          onSuccess={loadProducts}
        />
      ) : null}

      {/* Core Dispatch Modal */}
      {showDispatchModal && (
        <DispatchModal
          onClose={() => setShowDispatchModal(false)}
          onSuccess={() => {
            loadProducts();
          }}
        />
      )}

      {/* Tarifario de Precios por Unidad Modal */}
      {showPricePresetsModal && (
        <PricePresetsModal
          onClose={() => setShowPricePresetsModal(false)}
          onSelectPresetForNewProduct={(preset) => {
            setSelectedPresetForNewProduct(preset);
            setEditingProduct(null);
            setShowForm(true);
          }}
        />
      )}

      {/* Floating Action Button (FAB) for Mobile (iPhone / Android) */}
      {isCatalogTab && (
        <button
          onClick={handleAdd}
          className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#6161FF] via-[#7B51EC] to-[#9A42E4] text-white flex items-center justify-center shadow-xl shadow-indigo-500/40 active:scale-90 transition-all cursor-pointer border border-white/20"
          title="Agregar Nuevo Producto"
        >
          <Plus size={26} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  );
};
