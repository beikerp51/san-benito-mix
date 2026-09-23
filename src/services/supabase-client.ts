import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'sbm_supabase_url';
const STORAGE_KEY_KEY = 'sbm_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let lastClientUrl = '';
let lastClientKey = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
  const storedKey = localStorage.getItem(STORAGE_KEY_KEY) || '';

  const url = storedUrl || envUrl;
  const anonKey = storedKey || envKey;

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isConfigured: Boolean(url.trim() && anonKey.trim()),
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;

  if (cachedClient && lastClientUrl === url && lastClientKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastClientUrl = url;
    lastClientKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('[Supabase] Error inicializando cliente:', err);
    return null;
  }
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();

  localStorage.setItem(STORAGE_KEY_URL, cleanUrl);
  localStorage.setItem(STORAGE_KEY_KEY, cleanKey);

  cachedClient = null;
  lastClientUrl = '';
  lastClientKey = '';
}

export function clearSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_KEY);
  cachedClient = null;
  lastClientUrl = '';
  lastClientKey = '';
}

export async function testSupabaseConnection(
  testUrl?: string,
  testKey?: string
): Promise<{ success: boolean; message: string }> {
  const url = (testUrl || getSupabaseConfig().url).trim().replace(/\/+$/, '');
  const anonKey = (testKey || getSupabaseConfig().anonKey).trim();

  if (!url || !anonKey) {
    return { success: false, message: 'La URL y la clave Anon son obligatorias.' };
  }

  if (!url.startsWith('https://')) {
    return { success: false, message: 'La URL debe comenzar con https:// (ej. https://xxxx.supabase.co)' };
  }

  try {
    const tempClient = createClient(url, anonKey);
    // Ping with a lightweight query (exchange_rates or accounts or products)
    const { error } = await tempClient.from('accounts').select('id').limit(1);

    if (error) {
      // If table does not exist or permission denied
      if (error.code === 'PGRST116' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Conectó con Supabase pero las tablas no están creadas. Ejecuta el script schema.sql en el SQL Editor.',
        };
      }
      return { success: false, message: `Error Supabase: ${error.message} (${error.code || 'Desconocido'})` };
    }

    return { success: true, message: '¡Conexión exitosa con Supabase PostgreSQL!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error de red al conectar con Supabase.' };
  }
}
