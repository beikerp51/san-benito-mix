import { create } from 'zustand';
import bcrypt from 'bcryptjs';
import { db, enforceUniqueUsers, type User, type Settings } from '../db/database';

// ─── Types ──────────────────────────────────────────────────────

export interface AuthState {
  currentUser: User | null;
  permissions: Settings | null;
  isAuthenticated: boolean;
  isLocked: boolean;
  failedAttempts: number;
  lockUntil: number | null;
  users: User[];
  selectedUserId: number | null;

  // Actions
  loadUsers: () => Promise<void>;
  selectUser: (userId: number) => void;
  attemptLogin: (pin: string) => Promise<boolean>;
  attemptBiometricLogin: (userId: number) => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  lockScreen: () => void;
  logout: () => void;
  checkLockStatus: () => boolean;
}

// ─── Constants ──────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_KEY = 'san_benito_session_v1';

// ─── Store ──────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  permissions: null,
  isAuthenticated: false,
  isLocked: false,
  failedAttempts: 0,
  lockUntil: null,
  users: [],
  selectedUserId: null,

  loadUsers: async () => {
    const verified = await enforceUniqueUsers();
    // Guarantee strictly 2 unique users: Beiker Pérez (Master) and Fabiana Acosta (Admin)
    const sorted = [...verified].sort((a, b) => (a.role === 'master' ? -1 : 1));
    const currentSelected = get().selectedUserId;
    const nextSelected = sorted.some((u) => u.id === currentSelected)
      ? currentSelected
      : sorted[0]?.id || null;

    set({ users: sorted, selectedUserId: nextSelected });
  },

  restoreSession: async (): Promise<boolean> => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (!session?.userId) return false;

      const user = await db.users.get(session.userId);
      if (!user) {
        localStorage.removeItem(SESSION_KEY);
        return false;
      }

      let permissions: Settings | null = null;
      if (user.role === 'admin') {
        permissions = (await db.settings.where('userId').equals(user.id!).first()) || null;
      }

      set({
        currentUser: user,
        permissions,
        isAuthenticated: true,
        selectedUserId: user.id!,
        isLocked: false,
      });
      return true;
    } catch (err) {
      console.warn('[AuthStore] Error restoring session:', err);
      return false;
    }
  },

  selectUser: (userId: number) => {
    const state = get();
    if (state.checkLockStatus()) return;
    set({ selectedUserId: userId, failedAttempts: 0 });
  },

  attemptLogin: async (pin: string): Promise<boolean> => {
    const state = get();

    // Check if locked
    if (state.checkLockStatus()) {
      return false;
    }

    const { selectedUserId, users } = state;
    if (!selectedUserId) return false;

    const user = users.find((u) => u.id === selectedUserId);
    if (!user) return false;

    // Sanitize PIN input — only digits allowed
    const sanitizedPin = pin.replace(/\D/g, '');
    if (sanitizedPin.length !== 8) return false;

    // bcrypt comparison
    const match = await bcrypt.compare(sanitizedPin, user.pinHash);

    if (match) {
      // Load permissions for admin users
      let permissions: Settings | null = null;
      if (user.role === 'admin') {
        permissions = (await db.settings.where('userId').equals(user.id!).first()) || null;
      }

      // Persist session to localStorage so refresh doesn't log out
      try {
        localStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            userId: user.id,
            role: user.role,
            name: user.name,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        console.warn('[AuthStore] Failed to save session:', e);
      }

      set({
        currentUser: user,
        permissions,
        isAuthenticated: true,
        isLocked: false,
        failedAttempts: 0,
        lockUntil: null,
      });
      return true;
    } else {
      const newAttempts = state.failedAttempts + 1;
      const updates: Partial<AuthState> = {
        failedAttempts: newAttempts,
      };

      if (newAttempts >= MAX_ATTEMPTS) {
        updates.lockUntil = Date.now() + LOCK_DURATION_MS;
        updates.isLocked = true;
      }

      set(updates as AuthState);
      return false;
    }
  },

  attemptBiometricLogin: async (userId: number): Promise<boolean> => {
    const state = get();
    if (state.checkLockStatus()) return false;

    const user = state.users.find((u) => u.id === userId);
    if (!user) return false;

    // Load permissions for admin users
    let permissions: Settings | null = null;
    if (user.role === 'admin') {
      permissions = (await db.settings.where('userId').equals(user.id!).first()) || null;
    }

    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          userId: user.id,
          role: user.role,
          name: user.name,
          timestamp: Date.now(),
          authMethod: 'biometric',
        })
      );
    } catch (e) {
      console.warn('[AuthStore] Failed to save session:', e);
    }

    set({
      currentUser: user,
      permissions,
      isAuthenticated: true,
      isLocked: false,
      failedAttempts: 0,
      lockUntil: null,
    });
    return true;
  },

  lockScreen: () => {
    set({ isAuthenticated: false });
  },

  logout: () => {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (e) {}

    set({
      currentUser: null,
      permissions: null,
      isAuthenticated: false,
      selectedUserId: null,
      failedAttempts: 0,
    });
  },

  checkLockStatus: (): boolean => {
    const { lockUntil } = get();
    if (!lockUntil) return false;

    if (Date.now() < lockUntil) {
      set({ isLocked: true });
      return true;
    } else {
      set({ isLocked: false, lockUntil: null, failedAttempts: 0 });
      return false;
    }
  },
}));

// ─── Permission Helpers ─────────────────────────────────────────

export function useIsMaster(): boolean {
  return useAuthStore((s) => s.currentUser?.role === 'master');
}

export function usePermission(key: keyof Omit<Settings, 'id' | 'userId'>): boolean {
  const currentUser = useAuthStore((s) => s.currentUser);
  const permissions = useAuthStore((s) => s.permissions);

  if (!currentUser) return false;
  if (currentUser.role === 'master') return true;
  if (!permissions) return false;

  return permissions[key] as boolean;
}

export async function updatePermission(
  userId: number,
  key: keyof Omit<Settings, 'id' | 'userId'>,
  value: boolean
): Promise<void> {
  const setting = await db.settings.where('userId').equals(userId).first();
  if (setting?.id) {
    await db.settings.update(setting.id, { [key]: value });
  }
}
