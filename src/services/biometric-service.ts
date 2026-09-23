// ─── Biometric WebAuthn Service for San Benito Mix ───────────────
// Soporte oficial para Huella Dactilar (Android / Windows Hello) y Face ID (iOS / Mac)

const BIOMETRIC_KEY_PREFIX = 'sbm_bio_cred_';

export interface BiometricStatus {
  isAvailable: boolean;
  hasEnrolled: boolean;
  platformName: string;
}

// Convert ArrayBuffer to Base64URL string
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert Base64URL string to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Detectar si el dispositivo actual soporta biometría nativa
export async function checkBiometricAvailability(userId?: number): Promise<BiometricStatus> {
  if (typeof window === 'undefined') {
    return { isAvailable: false, hasEnrolled: false, platformName: 'Desconocido' };
  }

  const isSupported =
    Boolean(window.PublicKeyCredential) &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';

  if (!isSupported) {
    return { isAvailable: false, hasEnrolled: false, platformName: 'No soportado' };
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    const hasEnrolled = userId ? Boolean(localStorage.getItem(`${BIOMETRIC_KEY_PREFIX}${userId}`)) : false;

    // Detectar plataforma amigable
    const ua = navigator.userAgent;
    let platformName = 'Huella / Biometría';
    if (/android/i.test(ua)) {
      platformName = 'Huella Digital Android';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      platformName = 'Face ID / Touch ID';
    } else if (/windows/i.test(ua)) {
      platformName = 'Windows Hello';
    } else if (/mac/i.test(ua)) {
      platformName = 'Touch ID Mac';
    }

    return {
      isAvailable: Boolean(available),
      hasEnrolled,
      platformName,
    };
  } catch (err) {
    console.warn('[Biometrics] Error verificando autenticador:', err);
    return { isAvailable: false, hasEnrolled: false, platformName: 'Error' };
  }
}

// 1. Registrar huella dactilar para un usuario
export async function registerBiometricCredential(
  userId: number,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAvail = await checkBiometricAvailability();
    if (!isAvail.isAvailable) {
      return { success: false, error: 'Este dispositivo no tiene sensor biométrico o no está activado.' };
    }

    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const userHandle = new Uint8Array(16);
    crypto.getRandomValues(userHandle);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: 'SAN BENITO MIX 2026',
        id: window.location.hostname,
      },
      user: {
        id: userHandle,
        name: `user_${userId}`,
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256 (estándar Android/iOS)
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      return { success: false, error: 'No se pudo crear la credencial biométrica.' };
    }

    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem(
      `${BIOMETRIC_KEY_PREFIX}${userId}`,
      JSON.stringify({
        credId: credIdBase64,
        enrolledAt: Date.now(),
        userName,
      })
    );

    return { success: true };
  } catch (err: any) {
    console.error('[Biometrics] Error al registrar huella:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Operación cancelada o no autorizada por el usuario.' };
    }
    return { success: false, error: err?.message || 'Error al registrar huella.' };
  }
}

// 2. Verificar huella dactilar para iniciar sesión
export async function authenticateWithBiometrics(
  userId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const isAvail = await checkBiometricAvailability(userId);
    if (!isAvail.isAvailable) {
      return { success: false, error: 'Biometría no disponible en este dispositivo.' };
    }

    const raw = localStorage.getItem(`${BIOMETRIC_KEY_PREFIX}${userId}`);
    if (!raw) {
      return {
        success: false,
        error: 'Aún no has registrado tu huella en este teléfono. Ingresa tu contraseña primero para activarla.',
      };
    }

    const { credId } = JSON.parse(raw);
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [
        {
          id: base64ToBuffer(credId),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60000,
    };

    const assertion = (await navigator.credentials.get({
      publicKey: getOptions,
    })) as PublicKeyCredential;

    if (assertion) {
      return { success: true };
    }
    return { success: false, error: 'Verificación biométrica rechazada.' };
  } catch (err: any) {
    console.warn('[Biometrics] Error en autenticación:', err);
    if (err.name === 'NotAllowedError') {
      return { success: false, error: 'Huella no reconocida o solicitud cancelada.' };
    }
    return { success: false, error: err?.message || 'Error biométrico.' };
  }
}

// Eliminar credencial biométrica registrada
export function removeBiometricCredential(userId: number): void {
  try {
    localStorage.removeItem(`${BIOMETRIC_KEY_PREFIX}${userId}`);
  } catch {}
}
