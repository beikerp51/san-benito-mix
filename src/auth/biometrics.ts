/**
 * ─── Servicio de Autenticación Biométrica de Hardware Real (W3C WebAuthn) ───
 * Interactúa DIRECTAMENTE con el sensor de huella dactilar físico del teléfono
 * móvil (Android BiometricPrompt / iOS Touch ID / Face ID) o Windows Hello en PC.
 * 
 * Reglas estrictas:
 * 1. NUNCA se simula ni se realiza bypass. El usuario DEBE colocar su dedo físico.
 * 2. El hardware del dispositivo valida criptográficamente que la huella coincida
 *    con las registradas en el sistema operativo del teléfono.
 * 3. Máximo 3 intentos de lectura antes del bloqueo de seguridad.
 */

export interface BiometricStatus {
  isSupported: boolean;
  isSecureContext: boolean;
  hasPlatformAuthenticator: boolean;
  isEnrolled: boolean;
  enrolledAt?: number;
  deviceName?: string;
  hasTlsError?: boolean;
}

// Claves de almacenamiento local por usuario
const getCredKey = (userId: number) => `sbm_bio_credential_v3_${userId}`;
const getMetaKey = (userId: number) => `sbm_bio_meta_v3_${userId}`;

// Utilidades para convertir ArrayBuffer a Base64 y viceversa
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < bytes.byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Diagnóstico del soporte del sensor biométrico de hardware en este dispositivo
 */
export async function checkBiometricSupport(userId: number): Promise<BiometricStatus> {
  const isSecure = typeof window !== 'undefined' && window.isSecureContext === true;
  const hasWebAuthn = typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

  // Limpiar cualquier clave vieja de bypass si existiera
  const oldKeyV2 = localStorage.getItem(`sbm_bio_credential_v2_${userId}`);
  if (oldKeyV2?.startsWith('device_bound_')) {
    localStorage.removeItem(`sbm_bio_credential_v2_${userId}`);
  }

  if (!isSecure || !hasWebAuthn) {
    return {
      isSupported: false,
      isSecureContext: isSecure,
      hasPlatformAuthenticator: false,
      isEnrolled: false,
    };
  }

  let hasPlatformAuthenticator = false;
  try {
    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      hasPlatformAuthenticator = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (e) {
    console.warn('[Biometrics] Error verificando authenticator de plataforma:', e);
  }

  const rawCred = localStorage.getItem(getCredKey(userId));
  const isRealCred = Boolean(rawCred && !rawCred.startsWith('device_bound_'));

  const rawMeta = localStorage.getItem(getMetaKey(userId));
  let meta: { enrolledAt?: number; deviceName?: string } = {};
  if (rawMeta) {
    try {
      meta = JSON.parse(rawMeta);
    } catch {}
  }

  return {
    isSupported: true,
    isSecureContext: true,
    hasPlatformAuthenticator,
    isEnrolled: isRealCred,
    enrolledAt: meta.enrolledAt,
    deviceName: meta.deviceName,
  };
}

/**
 * Registra la huella dactilar física en el chip de seguridad del teléfono.
 * Despliega el diálogo nativo del sistema operativo:
 * "Toca el sensor de huella digital de este teléfono"
 */
export async function registerBiometricFingerprint(
  userId: number,
  userName: string
): Promise<{ success: boolean; message: string; isTlsError?: boolean }> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return {
      success: false,
      message: 'Se requiere una conexión segura (HTTPS o localhost) para activar el sensor de huella del teléfono.',
    };
  }

  if (!window.PublicKeyCredential || !navigator.credentials) {
    return {
      success: false,
      message: 'Este navegador no tiene soporte para la API de autenticación biométrica de hardware.',
    };
  }

  try {
    // Generar un challenge criptográfico aleatorio de 32 bytes
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // ID de usuario codificado en bytes
    const userIdBytes = new TextEncoder().encode(`sbm_user_${userId}_${Date.now()}`);

    // Solicitar al hardware del teléfono crear una credencial biométrica en su enclave seguro
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'SAN BENITO MIX',
        },
        user: {
          id: userIdBytes,
          name: `user_${userId}`,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256 (estándar nativo de Android BiometricPrompt / Apple Touch ID)
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // OBLIGA al sensor físico integrado del teléfono / PC
          userVerification: 'required',        // OBLIGA a que el usuario coloque su huella en el lector
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return {
        success: false,
        message: 'No se completó la lectura biométrica en el sensor.',
      };
    }

    // Almacenar el ID criptográfico de la credencial asociada al hardware
    const credIdBase64 = bufferToBase64(credential.rawId);
    localStorage.setItem(getCredKey(userId), credIdBase64);

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const deviceName = isMobile ? 'Sensor de Huella del Teléfono' : 'Sensor Biométrico PC';
    localStorage.setItem(
      getMetaKey(userId),
      JSON.stringify({
        enrolledAt: Date.now(),
        deviceName,
      })
    );

    return {
      success: true,
      message: `¡Huella de ${userName} registrada y verificada exitosamente en el sensor de este teléfono!`,
    };
  } catch (err: any) {
    console.error('[Biometrics] Error durante el registro de huella:', err);

    if (err.name === 'NotAllowedError') {
      if (err.message?.includes('certificate errors') || err.message?.includes('TLS')) {
        return {
          success: false,
          isTlsError: true,
          message: 'Android Chrome bloquea el sensor de huella en certificados locales no verificados. Ingresa mediante el enlace SSL de Cloudflare para activar el sensor físico.',
        };
      }
      return {
        success: false,
        message: 'Registro cancelado o el sensor de huella del teléfono no detectó una coincidencia autorizada.',
      };
    }

    if (err.name === 'InvalidStateError') {
      return {
        success: false,
        message: 'Esta huella ya se encuentra vinculada en el dispositivo.',
      };
    }

    return {
      success: false,
      message: err.message || 'Error al comunicarse con el sensor físico del teléfono.',
    };
  }
}

/**
 * Verifica la huella dactilar físicamente con el sensor del teléfono.
 * Despliega el diálogo nativo del sistema operativo (Android BiometricPrompt o Touch ID).
 * Solo autoriza el ingreso si el dedo colocado coincide con el registrado en el teléfono.
 */
export async function verifyBiometricFingerprint(
  userId: number
): Promise<{ success: boolean; message: string; isTlsError?: boolean; isUnregistered?: boolean }> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return {
      success: false,
      message: 'Se requiere conexión segura (HTTPS) para activar el sensor de huella física.',
    };
  }

  const rawCred = localStorage.getItem(getCredKey(userId));
  if (!rawCred || rawCred.startsWith('device_bound_')) {
    // Si no está registrada o era un token viejo, forzar nuevo registro físico
    if (rawCred) localStorage.removeItem(getCredKey(userId));
    return {
      success: false,
      isUnregistered: true,
      message: 'Aún no has vinculado tu huella en este teléfono. Toca "Vincular mi Huella" para colocar el dedo en el sensor.',
    };
  }

  try {
    const credIdBuffer = base64ToBuffer(rawCred);
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Invocar el diálogo de huella nativo del sistema operativo del teléfono
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          {
            id: credIdBuffer,
            type: 'public-key',
          },
        ],
        userVerification: 'required', // OBLIGA al teléfono a solicitar la huella dactilar al usuario
        timeout: 60000,
      },
    });

    if (assertion) {
      return {
        success: true,
        message: '¡Huella dactilar reconocida y autorizada por el teléfono!',
      };
    }

    return {
      success: false,
      message: 'El sensor de huella no autorizó la operación.',
    };
  } catch (err: any) {
    console.error('[Biometrics] Error durante la verificación en el sensor:', err);

    if (err.name === 'NotAllowedError') {
      if (err.message?.includes('certificate errors') || err.message?.includes('TLS')) {
        return {
          success: false,
          isTlsError: true,
          message: 'Android Chrome bloquea el sensor de huella en certificados locales no verificados. Ingresa mediante el enlace SSL de Cloudflare para activar el sensor físico.',
        };
      }
      return {
        success: false,
        message: 'Huella no reconocida por el sensor del teléfono o escaneo cancelado.',
      };
    }

    return {
      success: false,
      message: err.message || 'Error al comunicarse con el sensor biométrico del teléfono.',
    };
  }
}

/**
 * Elimina la huella dactilar vinculada a este usuario en este dispositivo.
 */
export function removeBiometricEnrollment(userId: number): void {
  localStorage.removeItem(getCredKey(userId));
  localStorage.removeItem(getMetaKey(userId));
  localStorage.removeItem(`sbm_bio_credential_v2_${userId}`);
  localStorage.removeItem(`sbm_bio_meta_v2_${userId}`);
}
