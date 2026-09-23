import React, { useState } from 'react';
import {
  X,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Download,
  Share2,
  Info,
  Layers,
} from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  tunnelUrl?: string;
  localIpUrl?: string;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  tunnelUrl = 'https://queue-kid-stanford-outlet.trycloudflare.com',
  localIpUrl = 'http://192.168.1.103:5173',
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'local'>('android');

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    tunnelUrl
  )}&color=0F172A&bgcolor=FFFFFF`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:from-slate-800/50 dark:to-indigo-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#6161FF] to-[#A25DDC] flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                Instalar App en Dispositivos
              </h2>
              <p className="text-[0.6875rem] text-slate-500 dark:text-slate-400 font-medium">
                Acceso móvil nativo WebAPK / PWA 2026
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer tap-haptic"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* SSL Status Card */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
            <div className="p-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex-shrink-0 mt-0.5">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                  Túnel HTTPS Seguro Activo
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-[0.6875rem] text-emerald-800 dark:text-emerald-300/90 leading-relaxed mt-0.5">
                Los teléfonos Android (Brave / Chrome) exigen conexión HTTPS con certificado SSL para compilar el paquete <strong>APK Nativo</strong> sin restricciones.
              </p>
            </div>
          </div>

          {/* QR Code and Quick Share Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="p-2 bg-white rounded-2xl shadow-sm border border-slate-200/70 flex-shrink-0">
              <img
                src={qrImageUrl}
                alt="Escanear QR para instalar en móvil"
                className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl object-contain"
                loading="eager"
              />
            </div>

            <div className="flex-1 w-full space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <QrCode size={15} className="text-[#6161FF]" />
                <span>Escanea con la cámara del celular</span>
              </div>
              <p className="text-[0.6875rem] text-slate-500 dark:text-slate-400 leading-snug">
                Apunta la cámara de tu teléfono al código QR para abrir el enlace seguro directamente.
              </p>

              {/* Direct Link Box */}
              <div className="pt-1">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1.5 pl-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[0.625rem] font-mono text-slate-600 dark:text-slate-300 truncate flex-1 select-all">
                    {tunnelUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(tunnelUrl)}
                    className={`px-2 py-1 rounded-lg text-[0.625rem] font-bold flex items-center gap-1 transition-all cursor-pointer tap-haptic ${
                      copied
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-[#6161FF] text-white hover:bg-indigo-600'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check size={11} />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Guide Selector Tabs */}
          <div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all tap-haptic cursor-pointer ${
                  activeTab === 'android'
                    ? 'bg-white dark:bg-slate-900 text-[#6161FF] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                🤖 Android (APK)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all tap-haptic cursor-pointer ${
                  activeTab === 'ios'
                    ? 'bg-white dark:bg-slate-900 text-[#6161FF] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                🍏 iPhone (iOS)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('local')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all tap-haptic cursor-pointer ${
                  activeTab === 'local'
                    ? 'bg-white dark:bg-slate-900 text-[#6161FF] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                📶 WiFi Local
              </button>
            </div>

            {/* Android Tab Content */}
            {activeTab === 'android' && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-200">
                  <Download size={14} className="text-[#6161FF]" />
                  <span>Pasos para Instalar APK en Android (Brave / Chrome):</span>
                </div>
                <ol className="space-y-2 text-[0.6875rem] text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#6161FF] text-white flex items-center justify-center font-bold text-[0.625rem] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Abre el enlace seguro HTTPS en tu teléfono con <strong>Google Chrome</strong> o <strong>Brave</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#6161FF] text-white flex items-center justify-center font-bold text-[0.625rem] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Toca el menú de los 3 puntos <strong className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">⋮</strong> y selecciona <strong>"Instalar aplicación"</strong> o toca el botón inferior <strong>"Instalar en Pantalla"</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#6161FF] text-white flex items-center justify-center font-bold text-[0.625rem] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      ¡Listo! El sistema Android crea el paquete <strong>APK Nativo</strong> en tu teléfono, con icono de San Benito Mix, pantalla completa y soporte de caché local.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            {/* iOS Tab Content */}
            {activeTab === 'ios' && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                  <Share2 size={14} className="text-[#6161FF]" />
                  <span>Pasos para Instalar en iPhone / iPad (Safari):</span>
                </div>
                <ol className="space-y-2 text-[0.6875rem] text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-[0.625rem] flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Abre el enlace en el navegador <strong>Safari</strong> de tu iPhone.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-[0.625rem] flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Toca el botón <strong>Compartir</strong> <span className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">⎋</span> (cuadrado con flecha hacia arriba en la barra inferior).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-[0.625rem] flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Baja y selecciona <strong>"Agregar al inicio"</strong> <span className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">➕</span>.
                    </span>
                  </li>
                </ol>
              </div>
            )}

            {/* Local WiFi Tab Content */}
            {activeTab === 'local' && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2.5 animate-fade-in">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
                  <Info size={14} className="text-amber-600" />
                  <span>¿Por qué Brave mostró "No se puede instalar esta app"?</span>
                </div>
                <p className="text-[0.6875rem] text-amber-800 dark:text-amber-300 leading-relaxed">
                  Brave y Chrome en Android bloquean la creación de paquetes WebAPK sobre direcciones IP locales (como <code>{localIpUrl}</code>) porque no tienen certificado SSL.
                </p>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-800/80 space-y-1.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers size={13} className="text-amber-600" />
                    <span>Solución en Red Local:</span>
                  </div>
                  <p className="text-[0.6875rem] text-slate-600 dark:text-slate-400">
                    En el menú desplegable que te salió en pantalla, toca la segunda opción:{' '}
                    <strong>"Crear acceso directo"</strong> (Shortcuts open in Brave). Se añadirá el icono directamente a tu pantalla de inicio y funcionará sin problema.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-center justify-between">
          <a
            href={tunnelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6161FF] hover:underline"
          >
            <span>Probar Enlace en otra pestaña</span>
            <ExternalLink size={13} />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer tap-haptic"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
