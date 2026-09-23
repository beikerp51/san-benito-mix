import React, { useState, useEffect, useMemo } from 'react';
import { db, type Product, type DispatchRecord } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import {
  Star,
  TrendingUp,
  Award,
  Zap,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight,
  PieChart,
  Target,
  Sparkles,
} from 'lucide-react';

export const StarProductsWidget: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());

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
    const [prods, disp] = await Promise.all([
      db.products.toArray(),
      db.dispatches.toArray(),
    ]);
    setProducts(prods);
    setDispatches(disp);
  };

  // Dispatch quantity map per product
  const dispatchMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const d of dispatches) {
      map.set(d.productId, (map.get(d.productId) || 0) + d.quantity);
    }
    return map;
  }, [dispatches]);

  // Enhanced product analytics
  const analyzedProducts = useMemo(() => {
    return products.map((p) => {
      const deliveredQty = dispatchMap.get(p.id!) || 0;
      const profitPerUnitUSD = Math.max(0, p.priceUSD - p.costUnitUSD);
      const totalPotentialProfitUSD = profitPerUnitUSD * p.stock;
      const margin = p.marginPercent || (p.costUnitUSD > 0 ? ((p.priceUSD - p.costUnitUSD) / p.costUnitUSD) * 100 : 0);

      // ABC Classification
      let abcClass: 'A' | 'B' | 'C' = 'B';
      if (margin >= 45 || deliveredQty >= 20) {
        abcClass = 'A';
      } else if (margin < 25 && deliveredQty < 5) {
        abcClass = 'C';
      }

      return {
        ...p,
        deliveredQty,
        profitPerUnitUSD,
        totalPotentialProfitUSD,
        margin: Math.round(margin),
        abcClass,
      };
    });
  }, [products, dispatchMap]);

  // Sorted by highest potential profit
  const topProfitProducts = useMemo(() => {
    return [...analyzedProducts].sort((a, b) => b.totalPotentialProfitUSD - a.totalPotentialProfitUSD);
  }, [analyzedProducts]);

  // Sorted by most delivered (sales velocity)
  const topDeliveredProducts = useMemo(() => {
    return [...analyzedProducts].sort((a, b) => b.deliveredQty - a.deliveredQty);
  }, [analyzedProducts]);

  // KPIs
  const totalPotentialProfit = analyzedProducts.reduce((sum, p) => sum + p.totalPotentialProfitUSD, 0);
  const avgMargin = analyzedProducts.length > 0
    ? Math.round(analyzedProducts.reduce((sum, p) => sum + p.margin, 0) / analyzedProducts.length)
    : 0;
  const bestSeller = topDeliveredProducts[0];
  const mostProfitable = topProfitProducts[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#00CA72] uppercase tracking-wider">
              Inteligencia Comercial y Rentabilidad
            </span>
            <span className="text-xs text-[#C5C7D0]">·</span>
            <span className="text-xs font-semibold text-[#6161FF] flex items-center gap-1">
              <Sparkles size={12} /> Matriz ABC de Ganancias
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#323338]">
            Dashboard de Productos Estrella y Rentabilidad Real
          </h2>
          <p className="text-xs text-[#676879] mt-0.5">
            Análisis de margen unitario, rotación de entrega de mercancía y utilidad neta latente
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase mb-1">
            <span>Ganancia Neta en Stock</span>
            <DollarSign size={16} className="text-[#00CA72]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#00CA72]">
            {formatCurrency(totalPotentialProfit, 'USD')}
          </div>
          <div className="text-[0.6875rem] text-[#676879] mt-0.5">
            ≈ {formatCurrency(totalPotentialProfit * activeRate, 'VES')}
          </div>
        </div>

        {/* KPI 2 */}
        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase mb-1">
            <span>Margen Promedio</span>
            <TrendingUp size={16} className="text-[#6161FF]" />
          </div>
          <div className="text-2xl font-black font-mono text-[#6161FF]">
            +{avgMargin}%
          </div>
          <div className="text-[0.6875rem] text-[#676879] mt-0.5">
            Rentabilidad sobre costo base
          </div>
        </div>

        {/* KPI 3 */}
        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase mb-1">
            <span>Mayor Utilidad</span>
            <Award size={16} className="text-[#FDAB3D]" />
          </div>
          <div className="text-base font-black text-[#323338] truncate">
            {mostProfitable ? mostProfitable.name : '—'}
          </div>
          <div className="text-[0.6875rem] text-[#00CA72] font-semibold mt-0.5">
            {mostProfitable ? `+${formatCurrency(mostProfitable.profitPerUnitUSD, 'USD')}/ud ganancia` : ''}
          </div>
        </div>

        {/* KPI 4 */}
        <div className="mn-card p-4">
          <div className="flex items-center justify-between text-xs font-bold text-[#676879] uppercase mb-1">
            <span>Mayor Salida</span>
            <Zap size={16} className="text-amber-500" />
          </div>
          <div className="text-base font-black text-[#323338] truncate">
            {bestSeller && bestSeller.deliveredQty > 0 ? bestSeller.name : '—'}
          </div>
          <div className="text-[0.6875rem] text-[#6161FF] font-semibold mt-0.5">
            {bestSeller ? `${bestSeller.deliveredQty} uds entregadas` : 'Sin datos'}
          </div>
        </div>
      </div>

      {/* Top Stars Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Top Profit Makers */}
        <div className="mn-card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E9EF] mb-4">
            <div className="flex items-center gap-2">
              <Star size={18} className="text-amber-400 fill-amber-400" />
              <h3 className="text-sm font-bold text-[#323338]">Top Productos por Ganancia en Almacén</h3>
            </div>
            <span className="text-xs text-[#676879] font-medium">Margen Real</span>
          </div>

          <div className="space-y-3">
            {topProfitProducts.slice(0, 5).map((p, idx) => (
              <div
                key={p.id}
                className="p-3 rounded-xl bg-[#F6F7FB] hover:bg-white hover:shadow-sm border border-[#E6E9EF] transition-all flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-white border border-[#E6E9EF] flex items-center justify-center text-lg flex-shrink-0">
                    {p.photo || '🥜'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#323338] truncate">{p.name}</span>
                      <span
                        className={`text-[0.5625rem] font-black px-1.5 py-0.2 rounded ${
                          p.abcClass === 'A'
                            ? 'bg-emerald-100 text-emerald-800'
                            : p.abcClass === 'B'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        Clase {p.abcClass}
                      </span>
                    </div>
                    <div className="text-[0.6875rem] text-[#676879] mt-0.5">
                      Stock: {p.stock} uds · Margen: <span className="font-bold text-[#00CA72]">+{p.margin}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-black font-mono text-[#00CA72]">
                    +{formatCurrency(p.totalPotentialProfitUSD, 'USD')}
                  </div>
                  <div className="text-[0.625rem] text-[#676879]">
                    +{formatCurrency(p.profitPerUnitUSD, 'USD')}/ud
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Top Delivered / Velocity */}
        <div className="mn-card p-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E6E9EF] mb-4">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-[#6161FF]" />
              <h3 className="text-sm font-bold text-[#323338]">Top Productos por Rotación de Entrega</h3>
            </div>
            <span className="text-xs text-[#676879] font-medium">Despacho</span>
          </div>

          <div className="space-y-3">
            {topDeliveredProducts.slice(0, 5).map((p) => {
              const maxDelivered = Math.max(1, topDeliveredProducts[0]?.deliveredQty || 1);
              const percent = Math.min(100, Math.round((p.deliveredQty / maxDelivered) * 100));

              return (
                <div key={p.id} className="p-3 rounded-xl bg-[#F6F7FB] border border-[#E6E9EF]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[#323338] truncate">{p.name}</span>
                    <span className="text-xs font-mono font-black text-[#6161FF]">
                      {p.deliveredQty} uds entregadas
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-[#E6E9EF] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#6161FF] to-[#A25DDC] transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[0.625rem] text-[#676879]">
                    <span>Stock actual en almacén: {p.stock} uds</span>
                    <span>Precio Venta: ${p.priceUSD.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
