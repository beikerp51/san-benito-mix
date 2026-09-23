import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'sbm_theme_mode';

const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  if (saved === 'light' || saved === 'dark') return saved;
  // Si el usuario tiene modo oscuro en su teléfono / SO, respetarlo por defecto
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const applyThemeToDOM = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Actualizar meta theme-color para la barra de estado del teléfono (iOS / Android)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', mode === 'dark' ? '#0B0F19' : '#F6F7FB');
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = getInitialTheme();
  applyThemeToDOM(initial);

  return {
    theme: initial,
    setTheme: (mode: ThemeMode) => {
      localStorage.setItem(STORAGE_KEY, mode);
      applyThemeToDOM(mode);
      set({ theme: mode });
    },
    toggleTheme: () => {
      const next: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(next);
    },
  };
});

// Listener para sincronizar inmediatamente en la carga inicial
if (typeof window !== 'undefined') {
  const initial = getInitialTheme();
  applyThemeToDOM(initial);
}
