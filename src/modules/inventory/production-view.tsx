import React, { useState, useEffect, useMemo } from 'react';
import { db, type ProductionBatch, type Product, addWithSync, updateWithSync } from '../../db/database';
import { useAuthStore } from '../../auth/auth-store';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import {
  Flame,
  Scale,
  TrendingDown,
  Package,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';

const PROCESS_LABELS: Record<string, string> = {
  tostado_mani: '🥜 Tostado de Maní',
  tostado_mixto: '🌰 Tostado Frutos Mixtos',
  fritura_platanitos: '🍌 Fritura de Platanitos',
  coccion_turron: '🍯 Elaboración de Turrones',
  otro: '⚙️ Otro Proceso',
};

export const ProductionView: React.FC = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [processType, setProcessType] = useState<ProductionBatch['processType']>('tostado_mani');
  const [rawIngredientName, setRawIngredientName] = useState('Maní Crudo en Grano');
  const [rawWeightKg, setRawWeightKg] = useState<number>(50);
  const [rawCostUSD, setRawCostUSD] = useState<number>(80);
  const [outputWeightKg, setOutputWeightKg] = useState<number>(46.5);
  const [targetProductId, setTargetProductId] = useState<number>(0);
  const [unitsProduced, setUnitsProduced] = useState<number>(510);
  const [autoAddStock, setAutoAddStock] = useState<boolean>(true);
  const [batchNotes, setBatchNotes] = useState<string>('');

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
    const [b, p] = await Promise.all([
      db.productionBatches.reverse().sortBy('date'),
      db.products.toArray(),
    ]);
    setBatches(b);
    setProducts(p);
    if (p.length > 0 && targetProductId === 0) {
      setTargetProductId(p[0].id || 0);
    }
  };

  // Calculations in real time
  const lossKg = Math.max(0, rawWeightKg - outputWeightKg);
  const lossPercent = rawWeightKg > 0 ? (lossKg / rawWeightKg) * 100 : 0;
  const netCostPerKgUSD = outputWeightKg > 0 ? rawCostUSD / outputWeightKg : 0;

  const targetProduct = products.find((p) => p.id === targetProductId);

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rawWeightKg <= 0 || outputWeightKg <= 0) {
      alert('Los pesos de entrada y salida deben ser mayores a 0.');
      return;
    }

    if (outputWeightKg > rawWeightKg) {
      alert('El peso final obtenido no puede superar el peso inicial.');
      return;
    }

    const batchCode = `LOTE-${new Date().getFullYear()}-${String(batches.length + 1).padStart(4, '0')}`;

    const batchData: ProductionBatch = {
      batchCode,
      processType,
      rawIngredientName: rawIngredientName.trim(),
      rawWeightKg,
      rawCostUSD,
      outputWeightKg,
      lossKg: Number(lossKg.toFixed(2)),
      lossPercent: Number(lossPercent.toFixed(2)),
      netCostPerKgUSD: Number(netCostPerKgUSD.toFixed(3)),
      targetProductId: targetProductId || undefined,
      targetProductName: targetProduct ? targetProduct.name : undefined,
      unitsProduced,
      status: 'completed',
      date: Date.now(),
      notes: batchNotes.trim(),
      userId: currentUser?.id || 1,
    };

    await addWithSync(db.productionBatches, 'productionBatches', batchData);

    // If autoAddStock is checked and product selected, increment stock in products!
    if (autoAddStock && targetProduct && targetProduct.id && unitsProduced > 0) {
      const newStock = targetProduct.stock + unitsProduced;
      await updateWithSync(db.products, 'products', targetProduct.id, {
        stock: newStock,
        updatedAt: Date.now(),
      });
    }

    setShowModal(false);
    resetForm();
    await loadData();
  };

  const resetForm = () => {
    setRawWeightKg(50);
    setOutputWeightKg(46.5);
    setRawCostUSD(80);
    setUnitsProduced(510);
    setBatchNotes('');
  };

  const totalKgProcessed = batches.reduce((sum, b) => sum + b.rawWeightKg, 0);
  const totalUnitsPacked = batches.reduce((sum, b) => sum + b.unitsProduced, 0);
  const avgMerma =
    batches.length > 0
      ? batches.reduce((sum, b) => sum + b.lossPercent, 0) / batches.length
      : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-[#FDAB3D] uppercase tracking-wider">
              Transformación y Rendimiento
            </span>
            <span className="text-xs text-[#C5C7D0]">·</span>
            <span className="text-xs font-semibold text-[#00CA72] flex items-center gap-1">
              <Sparkles size={12} /> Carga Automática de Paquetes
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#323338]">
            Producción, Tostado y Control de Mermas
          </h2>
          <p className="text-xs text-[#676879] mt-0.5">
            Seguimiento de lotes de tostado, cálculo de pérdida térmica (%) y costo neto por kilo
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="mn-btn mn-btn-primary text-xs py-2.5 px-4 flex items-center gap-2 shadow-md shadow-[#6161FF]/20 active:scale-95 transition-all"
        >
          <Flame size={15} />
          <span>Nuevo Lote de Producción</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="mn-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-[#FDAB3D] flex items-center justify-center flex-shrink-0">
            <Scale size={22} />
          </div>
          <div>
            <div className="text-xs text-[#676879] font-medium">Materia Prima Procesada</div>
            <div className="text-2xl font-black text-[#323338] font-mono">
              {totalKgProcessed.toFixed(1)} Kg
            </div>
            <div className="text-[0.6875rem] text-[#676879] mt-0.5">En {batches.length} lotes de tostado</div>
          </div>
        </div>

        <div className="mn-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-[#E2445C] flex items-center justify-center flex-shrink-0">
            <TrendingDown size={22} />
          </div>
          <div>
            <div className="text-xs text-[#676879] font-medium">Merma Promedio de Tostado</div>
            <div className="text-2xl font-black text-[#E2445C] font-mono">
              {avgMerma.toFixed(1)}%
            </div>
            <div className="text-[0.6875rem] text-[#676879] mt-0.5">Pérdida de humedad y cáscara</div>
          </div>
        </div>

        <div className="mn-card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#00CA72] flex items-center justify-center flex-shrink-0">
            <Package size={22} />
          </div>
          <div>
            <div className="text-xs text-[#676879] font-medium">Unidades Empacadas</div>
            <div className="text-2xl font-black text-[#00CA72] font-mono">
              +{totalUnitsPacked} uds
            </div>
            <div className="text-[0.6875rem] text-[#00CA72] font-semibold mt-0.5">
              Sumadas directamente al inventario
            </div>
          </div>
        </div>
      </div>

      {/* Monday Board Table */}
      <div className="mn-card overflow-hidden">
        <div className="mn-group-header bg-white border-b border-[#E6E9EF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="mn-group-color" style={{ background: '#FDAB3D' }} />
            <span className="text-sm font-bold text-[#323338]">
              Lotes de Producción Registrados
            </span>
            <span className="text-xs text-[#676879] font-normal">
              ({batches.length} lotes)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="mn-table">
            <thead>
              <tr>
                <th style={{ width: 130 }}>LOTE / FECHA</th>
                <th>PROCESO Y MATERIA PRIMA</th>
                <th style={{ width: 110, textAlign: 'right' }}>ENTRADA</th>
                <th style={{ width: 110, textAlign: 'right' }}>SALIDA</th>
                <th style={{ width: 110, textAlign: 'center' }}>MERMA (%)</th>
                <th style={{ width: 120, textAlign: 'right' }}>COSTO NETO/KG</th>
                <th>PRODUCTO FINAL</th>
                <th style={{ width: 110, textAlign: 'right' }}>PAQUETES</th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-[#676879]">
                    No hay lotes de producción o tostado registrados.{' '}
                    <button
                      onClick={() => setShowModal(true)}
                      className="text-[#6161FF] font-semibold underline ml-1"
                    >
                      Registrar primer lote
                    </button>
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F5F6F8] transition-colors">
                    {/* Batch Code & Date */}
                    <td className="mn-table-cell text-xs">
                      <div className="font-bold text-[#6161FF] font-mono">{b.batchCode}</div>
                      <div className="text-[0.625rem] text-[#676879] mt-0.5">
                        {new Date(b.date).toLocaleDateString('es-VE')}
                      </div>
                    </td>

                    {/* Process */}
                    <td className="mn-table-cell text-xs">
                      <div className="font-bold text-[#323338]">
                        {PROCESS_LABELS[b.processType] || b.processType}
                      </div>
                      <div className="text-[0.6875rem] text-[#676879]">
                        {b.rawIngredientName}
                      </div>
                    </td>

                    {/* Raw In */}
                    <td className="mn-table-cell text-right font-mono text-xs text-[#323338]">
                      {b.rawWeightKg} Kg
                    </td>

                    {/* Output */}
                    <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#00CA72]">
                      {b.outputWeightKg} Kg
                    </td>

                    {/* Merma */}
                    <td className="mn-table-cell text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-[#E2445C] border border-rose-100">
                        -{b.lossPercent}% ({b.lossKg} Kg)
                      </span>
                    </td>

                    {/* Cost / Kg */}
                    <td className="mn-table-cell text-right font-mono font-bold text-xs text-[#323338]">
                      {formatCurrency(b.netCostPerKgUSD, 'USD')}/Kg
                    </td>

                    {/* Target Product */}
                    <td className="mn-table-cell text-xs font-medium text-[#323338]">
                      {b.targetProductName || 'Sin empacar'}
                    </td>

                    {/* Units */}
                    <td className="mn-table-cell text-right font-mono font-black text-xs text-[#00CA72]">
                      +{b.unitsProduced} uds
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Batch Modal */}
      {showModal && (
        <div className="mn-modal-overlay">
          <div className="mn-modal max-w-xl w-full animate-scale-in bg-white p-0 overflow-hidden shadow-2xl rounded-2xl border border-[#E6E9EF]">
            <div className="p-5 border-b border-[#E6E9EF] bg-gradient-to-r from-amber-500/10 to-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Flame size={20} />
                </div>
                <div>
                  <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-amber-600">
                    Procesamiento de Materia Prima
                  </span>
                  <h3 className="text-base font-black text-[#323338]">
                    Registrar Lote de Tostado / Producción
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="p-5 space-y-4">
              {/* Process Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mn-input-label">Tipo de Proceso</label>
                  <select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value as any)}
                    className="mn-input mn-select text-xs"
                  >
                    <option value="tostado_mani">🥜 Tostado de Maní</option>
                    <option value="tostado_mixto">🌰 Tostado Frutos Mixtos</option>
                    <option value="fritura_platanitos">🍌 Fritura de Platanitos</option>
                    <option value="coccion_turron">🍯 Elaboración de Turrones</option>
                    <option value="otro">⚙️ Otro Proceso</option>
                  </select>
                </div>

                <div>
                  <label className="mn-input-label">Materia Prima Entrada</label>
                  <input
                    type="text"
                    required
                    value={rawIngredientName}
                    onChange={(e) => setRawIngredientName(e.target.value)}
                    placeholder="Ej. Maní Crudo Grano 50kg"
                    className="mn-input text-xs"
                  />
                </div>
              </div>

              {/* Weight In, Cost In, Weight Out */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mn-input-label">Peso Inicial (Kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    required
                    value={rawWeightKg}
                    onChange={(e) => setRawWeightKg(Number(e.target.value))}
                    className="mn-input text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="mn-input-label">Costo Total ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={rawCostUSD}
                    onChange={(e) => setRawCostUSD(Number(e.target.value))}
                    className="mn-input text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="mn-input-label">Peso Obtenido (Kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    required
                    value={outputWeightKg}
                    onChange={(e) => setOutputWeightKg(Number(e.target.value))}
                    className="mn-input text-xs font-mono font-bold text-[#00CA72]"
                  />
                </div>
              </div>

              {/* Merma and Real Cost Metric Card */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200/60 grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[0.6875rem] font-bold text-[#676879] uppercase block">
                    Pérdida Térmica
                  </span>
                  <span className="text-base font-black text-[#E2445C] font-mono">
                    -{lossKg.toFixed(2)} Kg
                  </span>
                </div>
                <div>
                  <span className="text-[0.6875rem] font-bold text-[#676879] uppercase block">
                    % de Merma
                  </span>
                  <span className="text-base font-black text-[#E2445C] font-mono">
                    {lossPercent.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[0.6875rem] font-bold text-[#676879] uppercase block">
                    Costo Neto Real/Kg
                  </span>
                  <span className="text-base font-black text-[#323338] font-mono">
                    {formatCurrency(netCostPerKgUSD, 'USD')}/Kg
                  </span>
                </div>
              </div>

              {/* Packaging to Target Product */}
              <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E6E9EF] space-y-3">
                <span className="text-xs font-bold text-[#323338] block">
                  Empaquetado y Actualización de Stock
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mn-input-label">Producto Final a Cargar</label>
                    <select
                      value={targetProductId}
                      onChange={(e) => setTargetProductId(Number(e.target.value))}
                      className="mn-input mn-select text-xs"
                    >
                      <option value={0}>Selecciona producto final...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.photo} {p.name} {p.flavor ? `(${p.flavor})` : ''} · Stock actual: {p.stock} uds
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mn-input-label">Bolsas / Paquetes Producidos</label>
                    <input
                      type="number"
                      min="1"
                      value={unitsProduced}
                      onChange={(e) => setUnitsProduced(Number(e.target.value))}
                      className="mn-input text-xs font-mono font-bold text-[#00CA72]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoAdd"
                    checked={autoAddStock}
                    onChange={(e) => setAutoAddStock(e.target.checked)}
                    className="w-4 h-4 rounded text-[#6161FF] focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="autoAdd" className="text-xs font-semibold text-[#323338] cursor-pointer">
                    Sumar automáticamente +{unitsProduced} unidades al stock de {targetProduct?.name || 'producto'}
                  </label>
                </div>
              </div>

              <div>
                <label className="mn-input-label">Observaciones del Lote</label>
                <input
                  type="text"
                  placeholder="Ej. Tostado medio con sal marina, temperatura controlada..."
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  className="mn-input text-xs"
                />
              </div>

              <div className="p-4 -mx-5 -mb-5 bg-[#F6F7FB] border-t border-[#E6E9EF] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mn-btn mn-btn-outline text-xs py-2.5 px-4"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mn-btn mn-btn-primary text-xs py-2.5 px-5 flex items-center gap-2"
                >
                  <CheckCircle2 size={15} />
                  <span>Guardar Lote y Cargar Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
