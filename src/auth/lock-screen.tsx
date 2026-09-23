import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from './auth-store';
import {
  Lock,
  Unlock,
  AlertTriangle,
  Sparkles,
  Delete,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  User,
} from 'lucide-react';

export const LockScreen: React.FC = () => {
  const {
    users,
    selectedUserId,
    isLocked,
    lockUntil,
    failedAttempts,
    loadUsers,
    selectUser,
    attemptLogin,
    checkLockStatus,
  } = useAuthStore();

  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingLock, setRemainingLock] = useState(0);

  // Reloj digital en tiempo real
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const inputRef = useRef<HTMLInputElement>(null);

  // Reloj en vivo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Cargar usuarios
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Seleccionar primer usuario por defecto
  useEffect(() => {
    if (users.length > 0 && !selectedUserId) {
      selectUser(users[0].id!);
    }
  }, [users, selectedUserId, selectUser]);

  // Mantener foco en el campo para ingreso directo con teclado físico
  useEffect(() => {
    if (!isLocked) {
      inputRef.current?.focus();
    }
  }, [selectedUserId, isLocked]);

  // Cuenta regresiva si está bloqueado por intentos
  useEffect(() => {
    if (!lockUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, lockUntil - Date.now());
      setRemainingLock(remaining);
      if (remaining <= 0) {
        checkLockStatus();
        setRemainingLock(0);
        setErrorMessage(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockUntil, checkLockStatus]);

  const selectedUser = users.find((u) => u.id === selectedUserId) || users[0];

  // Respuesta háptica táctil para teléfonos móviles
  const triggerHaptic = (pattern: number | number[]) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch {}
  };

  // Sonidos de desbloqueo y error con Web Audio API
  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, ctx.currentTime + 0.15); // C6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const playErrorBuzz = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.22);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  };

  // Validación y envío de contraseña PIN
  const handleLoginSubmit = async (pinToVerify: string) => {
    if (isLocked || !selectedUserId || pinToVerify.length !== 8 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const success = await attemptLogin(pinToVerify);
      if (success) {
        setIsSuccess(true);
        triggerHaptic(80);
        playSuccessChime();
      } else {
        triggerHaptic([120, 60, 120]);
        playErrorBuzz();
        setIsShaking(true);
        const attemptsLeft = Math.max(0, 5 - (failedAttempts + 1));
        setErrorMessage(
          attemptsLeft > 0
            ? `Contraseña incorrecta. Te quedan ${attemptsLeft} intento(s).`
            : 'Sistema bloqueado temporalmente por seguridad (5 minutos).'
        );
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
          inputRef.current?.focus();
        }, 500);
      }
    } catch {
      setErrorMessage('Error al verificar credenciales.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Entrada por teclado físico
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setPin(val);
    setErrorMessage(null);
    if (val.length === 8) {
      handleLoginSubmit(val);
    }
  };

  // Entrada por teclado en pantalla (teléfonos / táctil)
  const handleKeypadPress = (digit: string) => {
    if (pin.length >= 8 || isLocked || isSubmitting) return;
    triggerHaptic(20);
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMessage(null);
    if (nextPin.length === 8) {
      handleLoginSubmit(nextPin);
    }
  };

  const handleKeypadDelete = () => {
    if (pin.length > 0) {
      triggerHaptic(20);
      setPin(pin.slice(0, -1));
      setErrorMessage(null);
    }
  };

  const formatLockTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Formato de hora estilo teléfono
  const formattedHours = currentTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const formattedDate = currentTime.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  return (
    <div
      className="min-h-[100dvh] w-full relative flex flex-col justify-between items-center overflow-x-hidden bg-[#070B14] select-none text-white py-6 px-4"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Fondo Ambient Luxury Glows */}
      <div className="absolute inset-0 bg-radial from-slate-900/70 via-[#070B14] to-[#03060B] pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[150px] pointer-events-none" />

      {/* Input oculto para captura directa con teclado físico en PC */}
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={8}
        value={pin}
        onChange={handleInputChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && pin.length === 8) {
            handleLoginSubmit(pin);
          }
        }}
        className="sr-only opacity-0 absolute pointer-events-none"
        autoFocus
      />

      {/* ─── SECCIÓN SUPERIOR: BRANDING & RELOJ ─── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center pt-2">
        {/* Logo San Benito Mix */}
        <div className="relative mb-3">
          <img
            src="/san-benito-logo.jpg"
            alt="San Benito Mix"
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shadow-2xl ring-3 ring-amber-400/70 shadow-amber-500/20 mx-auto"
          />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white text-[0.625rem]">
            ✓
          </div>
        </div>

        {/* Nombre de la Empresa */}
        <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center justify-center gap-2">
          <span>SAN BENITO MIX</span>
          <span className="text-[0.625rem] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-sm">
            2026
          </span>
        </h1>

        {/* Reloj Digital de Pantalla */}
        <div className="text-4xl sm:text-5xl font-light tracking-tight text-white/95 mt-2 font-sans">
          {formattedHours}
        </div>
        <div className="text-xs font-medium text-slate-400 capitalize mt-0.5">
          {capitalizedDate}
        </div>

        {/* Selector de Usuario */}
        <div className="w-full mt-4 bg-white/5 border border-white/10 rounded-2xl p-1.5 backdrop-blur-md">
          <div className="grid grid-cols-2 gap-1.5">
            {users.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              const isMaster = user.role === 'master';

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectUser(user.id!);
                    setPin('');
                    setErrorMessage(null);
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-indigo-600/80 to-purple-600/80 text-white shadow-md ring-1 ring-white/30'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 shadow-sm"
                    style={{
                      background: isMaster
                        ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                        : 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                    }}
                  >
                    {user.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.75rem] font-black truncate leading-tight">
                      {user.name}
                    </div>
                    <div className="text-[0.625rem] text-slate-300/80 truncate">
                      {isMaster ? 'Master' : 'Admin'}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 size={13} className="text-white flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Alerta si está bloqueado por tiempo */}
        {isLocked && (
          <div className="mt-3 w-full p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-2 animate-pulse">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span>Sistema bloqueado · Espera {formatLockTime(remainingLock)}</span>
          </div>
        )}

        {/* Mensaje de Error */}
        {errorMessage && !isLocked && (
          <div
            className={`mt-3 w-full p-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center justify-center gap-2 ${
              isShaking ? 'animate-shake' : ''
            }`}
          >
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ─── SECCIÓN CENTRAL: PUNTOS DE CONTRASEÑA PIN & TECLADO ─── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center my-3">
        {/* Encabezado de Solicitud */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-3">
          <KeyRound size={14} className="text-amber-400" />
          <span>Ingresa tu contraseña de 8 dígitos</span>
        </div>

        {/* Indicador de 8 Puntos de PIN */}
        <div
          className={`flex items-center justify-center gap-3 mb-5 py-2 ${
            isShaking ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`rounded-full transition-all duration-200 ${
                  isSuccess
                    ? 'w-3.5 h-3.5 bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-110'
                    : isFilled
                    ? 'w-3.5 h-3.5 bg-gradient-to-tr from-amber-400 to-indigo-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] scale-110'
                    : 'w-3 h-3 border border-white/30 bg-white/5'
                }`}
              />
            );
          })}
        </div>

        {/* Teclado Numérico Circular Estilo Teléfono */}
        <div className="grid grid-cols-3 gap-x-5 gap-y-3 w-full max-w-[260px]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLocked || isSubmitting}
              onClick={(e) => {
                e.stopPropagation();
                handleKeypadPress(String(num));
              }}
              className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/10 flex items-center justify-center text-2xl font-light text-white backdrop-blur-md transition-all active:scale-90 shadow-sm cursor-pointer mx-auto"
            >
              {num}
            </button>
          ))}

          {/* Indicador de Candado / Seguridad */}
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mx-auto">
            {isSuccess ? (
              <Unlock size={22} className="text-emerald-400 animate-bounce" />
            ) : (
              <Lock size={18} className="text-slate-400/60" />
            )}
          </div>

          {/* Tecla 0 */}
          <button
            type="button"
            disabled={isLocked || isSubmitting}
            onClick={(e) => {
              e.stopPropagation();
              handleKeypadPress('0');
            }}
            className="w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/10 flex items-center justify-center text-2xl font-light text-white backdrop-blur-md transition-all active:scale-90 shadow-sm cursor-pointer mx-auto"
          >
            0
          </button>

          {/* Tecla Borrar */}
          <button
            type="button"
            disabled={pin.length === 0 || isLocked || isSubmitting}
            onClick={(e) => {
              e.stopPropagation();
              handleKeypadDelete();
            }}
            className="w-16 h-16 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer disabled:opacity-20 mx-auto"
            title="Borrar dígito"
          >
            <Delete size={22} />
          </button>
        </div>

        {/* Indicador de estado al verificar */}
        {isSubmitting && (
          <div className="mt-3 text-xs text-amber-300 animate-pulse font-semibold flex items-center gap-1.5">
            <Sparkles size={13} className="animate-spin" />
            <span>Verificando contraseña...</span>
          </div>
        )}
      </div>

      {/* ─── SECCIÓN INFERIOR: FOOTER DE SEGURIDAD ─── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center pt-2">
        <div className="flex items-center gap-1.5 text-[0.6875rem] text-slate-400 font-medium">
          <ShieldCheck size={13} className="text-emerald-400" />
          <span>Acceso Protegido por Contraseña Cifrada (Bcrypt)</span>
        </div>
        <div className="text-[0.625rem] text-slate-500 mt-0.5">
          San Benito Mix C.A. · Control Administrativo
        </div>
      </div>
    </div>
  );
};
