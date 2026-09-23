import React, { useState } from 'react';
import { db, resetSystemToBlank } from '../db/database';
import {
  AlertOctagon,
  Trash2,
  Download,
  X,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Users,
  Wallet,
  BookOpen,
} from 'lucide-react';

interface ResetSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REQUIRED_CONFIRMATION_TEXT = 'BORRAR TODO';

export const ResetSystemModal: React.FC<ResetSystemModalProps> = ({ isOpen, onClose }) => {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    try {
      const backupData = {
        app: 'SanBenitoMix',
        version: '2.0',
        timestamp: Date.now(),
        dateFormatted: new Date().toISOString(),
        tables: {
          users: await db.users.toArray(),
          settings: await db.settings.toArray(),
          exchangeRates: await db.exchangeRates.toArray(),
          products: await db.products.toArray(),
          losses: await db.losses.toArray(),
          accounts: await db.accounts.toArray(),
          transactions: await db.transactions.toArray(),
          auditLog: await db.auditLog.toArray(),
          clients: await db.clients.toArray(),
          dispatches: await db.dispatches.toArray(),
          productionBatches: await db.productionBatches.toArray(),
          cashClosures: await db.cashClosures.toArray(),
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const now = new Date();
      link.href = url;
      link.download = `Respaldo_Preventivo_Previo_Reset_${now.toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupDownloaded(true);
    } catch (e) {
      console.error('Error generando respaldo preventivo:', e);
      setErrorMsg('No se pudo generar el respaldo automático.');
    }
  };

  const handleExecuteReset = async () => {
    if (confirmationInput.trim() !== REQUIRED_CONFIRMATION_TEXT) return;

    setIsWiping(true);
    setErrorMsg(null);
    try {
      await resetSystemToBlank();
      // Brief pause to allow UI update then reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error('Error al resetear la base de datos:', err);
      setErrorMsg('Ocurrió un fallo al reiniciar el sistema.');
      setIsWiping(false);
    }
  };

  const isConfirmed = confirmationInput.trim() === REQUIRED_CONFIRMATION_TEXT;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-rose-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-rose-50/80 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
              <AlertOctagon size={22} />
            </div>
            <div>
              <h3 className="text-base font-black text-rose-950">
                Puesta a Cero / Dejar en Blanco el Sistema
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Zona de Peligro · Acción Destructiva Irreversible
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isWiping}
            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-[#323338]">
          <p className="text-sm font-semibold text-[#323338] leading-relaxed">
            Esta acción vaciará por completo los registros operativos de la empresa, dejándolo como una instalación limpia:
          </p>

          <div className="grid grid-cols-2 gap-2 bg-[#F6F7FB] p-3 rounded-xl border border-[#E6E9EF]">
            <div className="flex items-center gap-2 text-[#676879]">
              <Layers size={14} className="text-[#6161FF]" />
              <span>Inventario y Mermas (0)</span>
            </div>
            <div className="flex items-center gap-2 text-[#676879]">
              <Users size={14} className="text-[#00CA72]" />
              <span>Clientes y Deudas (0)</span>
            </div>
            <div className="flex items-center gap-2 text-[#676879]">
              <BookOpen size={14} className="text-[#A25DDC]" />
              <span>Libro Mayor y Asientos (0)</span>
            </div>
            <div className="flex items-center gap-2 text-[#676879]">
              <Wallet size={14} className="text-[#FDAB3D]" />
              <span>Saldos Cuentas (0.00 Bs / $)</span>
            </div>
          </div>

          <div className="text-[0.6875rem] text-[#676879] bg-blue-50 border border-blue-100 p-2.5 rounded-lg flex items-center justify-between">
            <span>Nota: Los usuarios de acceso (Beiker y Fabiana) se mantienen intactos.</span>
          </div>

          {/* Backup Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className={`w-full py-2.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                backupDownloaded
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-[#C5C7D0] text-[#323338] hover:bg-gray-50 shadow-sm'
              }`}
            >
              {backupDownloaded ? (
                <>
                  <CheckCircle2 size={16} className="text-[#00CA72]" />
                  <span>¡Copia de Respaldo Descargada!</span>
                </>
              ) : (
                <>
                  <Download size={16} className="text-[#6161FF]" />
                  <span>1. Descargar Respaldo Preventivo (Recomendado)</span>
                </>
              )}
            </button>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-1.5 pt-2">
            <label className="block text-[0.6875rem] font-bold text-rose-900 uppercase tracking-wider">
              2. Para confirmar, escribe exactamente: <span className="font-mono text-rose-600 font-black">{REQUIRED_CONFIRMATION_TEXT}</span>
            </label>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={`Escribe ${REQUIRED_CONFIRMATION_TEXT}`}
              disabled={isWiping}
              className="w-full px-3 py-2 text-sm font-mono border-2 border-rose-200 rounded-xl focus:border-rose-500 focus:outline-none transition-colors"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#F9FAFC] border-t border-[#E6E9EF] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isWiping}
            className="mn-btn mn-btn-outline text-xs py-2 px-4"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExecuteReset}
            disabled={!isConfirmed || isWiping}
            className={`text-xs py-2 px-4 rounded-xl font-bold flex items-center gap-2 transition-all ${
              isConfirmed && !isWiping
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer'
                : 'bg-rose-200 text-rose-400 cursor-not-allowed'
            }`}
          >
            {isWiping ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Restableciendo Sistema...</span>
              </>
            ) : (
              <>
                <Trash2 size={14} />
                <span>Dejar en Blanco Definitivamente</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
