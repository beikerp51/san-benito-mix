import { db, type ProductCategory } from '../db/database';

export const PRICE_PRESETS_STORAGE_KEY = 'sbm_product_price_presets';

export interface ProductPricePreset {
  id: string;
  name: string;
  category: ProductCategory;
  priceUSD: number;
  packWeightGrams?: number;
  unitType?: string;
  photo?: string;
  updatedAt: number;
}

// ─── Default initial presets if none are stored ──────────────────
const DEFAULT_PRESETS: Omit<ProductPricePreset, 'id' | 'updatedAt'>[] = [
  { name: 'FRUTO SECOS', category: 'frutos_secos', priceUSD: 1.20, packWeightGrams: 90, photo: '🥜' },
  { name: 'GRANOLA', category: 'frutos_secos', priceUSD: 1.25, packWeightGrams: 90, photo: '🥣' },
  { name: 'MANÍ SALADO', category: 'frutos_secos', priceUSD: 1.00, packWeightGrams: 90, photo: '🥜' },
  { name: 'MANÍ CON PASAS', category: 'frutos_secos', priceUSD: 1.20, packWeightGrams: 90, photo: '🍇' },
  { name: 'NUECES MIXTAS', category: 'frutos_secos', priceUSD: 2.00, packWeightGrams: 90, photo: '🌰' },
  { name: 'ALMENDRAS', category: 'frutos_secos', priceUSD: 2.50, packWeightGrams: 100, photo: '🌰' },
  { name: 'PLATANITOS MADUROS', category: 'platanitos', priceUSD: 1.00, packWeightGrams: 75, photo: '🍌' },
  { name: 'PLATANITOS CON AJO', category: 'platanitos', priceUSD: 1.00, packWeightGrams: 75, photo: '🧄' },
  { name: 'TURRÓN DE MANÍ', category: 'turrones', priceUSD: 1.50, packWeightGrams: 120, photo: '🍫' },
];

export async function loadPricePresets(): Promise<ProductPricePreset[]> {
  try {
    let presets: ProductPricePreset[] = [];

    // 1. Read from localStorage
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(PRICE_PRESETS_STORAGE_KEY);
      if (raw) {
        try {
          presets = JSON.parse(raw);
        } catch {}
      }
    }

    // 2. If empty, check db.products or seed with defaults
    if (!presets || presets.length === 0) {
      const existingProducts = await db.products.toArray();
      if (existingProducts.length > 0) {
        presets = existingProducts.map((p) => ({
          id: `preset-${p.id || Date.now()}-${p.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: p.name.trim(),
          category: p.category,
          priceUSD: p.priceUSD || 1.00,
          packWeightGrams: p.packWeightGrams || 90,
          unitType: p.unitType || 'Bolsa',
          photo: p.photo || '🥜',
          updatedAt: p.updatedAt || Date.now(),
        }));
      } else {
        presets = DEFAULT_PRESETS.map((d, index) => ({
          ...d,
          id: `preset-def-${index + 1}`,
          updatedAt: Date.now(),
        }));
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem(PRICE_PRESETS_STORAGE_KEY, JSON.stringify(presets));
      }
    }

    // 3. Merge any new products from db.products that might not be in presets
    const allProducts = await db.products.toArray();
    let hasChanges = false;
    for (const prod of allProducts) {
      const exists = presets.some(
        (p) => p.name.trim().toLowerCase() === prod.name.trim().toLowerCase()
      );
      if (!exists && prod.name.trim() && prod.priceUSD > 0) {
        presets.push({
          id: `preset-${prod.id || Date.now()}`,
          name: prod.name.trim(),
          category: prod.category,
          priceUSD: prod.priceUSD,
          packWeightGrams: prod.packWeightGrams || 90,
          unitType: prod.unitType || 'Bolsa',
          photo: prod.photo || '📦',
          updatedAt: prod.updatedAt || Date.now(),
        });
        hasChanges = true;
      }
    }

    if (hasChanges && typeof window !== 'undefined') {
      localStorage.setItem(PRICE_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    }

    return presets;
  } catch (e) {
    console.warn('[PricePresetService] Error loading presets:', e);
    return [];
  }
}

export async function savePricePreset(
  item: Omit<ProductPricePreset, 'id' | 'updatedAt'> & { id?: string }
): Promise<ProductPricePreset> {
  const presets = await loadPricePresets();
  const now = Date.now();

  const id = item.id || `preset-${now}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = item.name.trim();

  const existingIndex = presets.findIndex(
    (p) => p.id === id || p.name.trim().toLowerCase() === cleanName.toLowerCase()
  );

  const updatedItem: ProductPricePreset = {
    id: existingIndex >= 0 ? presets[existingIndex].id : id,
    name: cleanName,
    category: item.category || 'frutos_secos',
    priceUSD: Number(item.priceUSD.toFixed(2)),
    packWeightGrams: item.packWeightGrams ? Number(item.packWeightGrams) : undefined,
    unitType: item.unitType || 'Bolsa',
    photo: item.photo || (item.category === 'frutos_secos' ? '🥜' : '📦'),
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    presets[existingIndex] = updatedItem;
  } else {
    presets.push(updatedItem);
  }

  // Save to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem(PRICE_PRESETS_STORAGE_KEY, JSON.stringify(presets));
    window.dispatchEvent(
      new CustomEvent('sbm:price-presets-updated', { detail: { updatedItem, presets } })
    );
  }

  // Sync to central DB if possible
  try {
    fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'pricePresets',
        operation: 'create',
        recordId: updatedItem.id,
        data: updatedItem,
      }),
    }).catch(() => {});
  } catch {}

  return updatedItem;
}

export async function deletePricePreset(id: string): Promise<void> {
  const presets = await loadPricePresets();
  const filtered = presets.filter((p) => p.id !== id);

  if (typeof window !== 'undefined') {
    localStorage.setItem(PRICE_PRESETS_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(
      new CustomEvent('sbm:price-presets-updated', { detail: { deletedId: id, presets: filtered } })
    );
  }

  try {
    fetch('/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'pricePresets',
        operation: 'delete',
        recordId: id,
      }),
    }).catch(() => {});
  } catch {}
}

export function findPresetByName(
  presets: ProductPricePreset[],
  name: string
): ProductPricePreset | undefined {
  if (!name || !name.trim()) return undefined;
  const target = name.trim().toLowerCase();
  return presets.find((p) => p.name.trim().toLowerCase() === target);
}
