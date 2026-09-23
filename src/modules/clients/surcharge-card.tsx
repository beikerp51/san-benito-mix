import React, { useState, useMemo, useEffect } from 'react';
import { db, type Client, type Account, updateWithSync, deleteWithSync, addWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { usePermission, useAuthStore } from '../../auth/auth-store';
import {
  Clock,
  AlertTriangle,
  DollarSign,
  Percent,
  X,
  CheckCircle2,
  Trash2,
  Phone,
  Calendar,
  Save,
  Building2,
  User,
  FileText,
} from 'lucide-react';

interface SurchargeCardProps {
  client: Client;
  onClose: () => void;
}

export const SurchargeCard: React.FC<SurchargeCardProps> = ({ client, onClose }) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const canApplySurcharges = usePermission('applySurcharges');
  const currentUser = useAuthStore((s) => s.currentUser);

  // Editable Form Fields
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone || '');
  const [debtUSD, setDebtUSD] = useState(client.debtUSD);
  const [note, setNote] = useState(client.note || '');
  const [status, setStatus] = useState(client.status);
  const [surchargeActive, setSurchargeActive] = useState(client.surchargeActive);
  const [surchargePercent, setSurchargePercent] = useState(client.surchargePercent || 10);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    db.accounts.toArray().then(setAccounts);
  }, []);

  const daysOverdue = Math.max(
    0,
    Math.floor((Date.now() - (client.dueDate || Date.now())) / (1000 * 60 * 60 * 24))
  );

  const overdueCategory =
    daysOverdue === 0
      ? 'Al día'
      : daysOverdue <= 15
      ? '15 días'
      : daysOverdue <= 30
      ? '1 mes'
      : '+1 mes';

  const calculations = useMemo(() => {
    const debtBaseUSD = Number(debtUSD) || 0;
    const debtBaseVES = debtBaseUSD * activeRate;
    const surchargeUSD = surchargeActive ? debtBaseUSD * (surchargePercent / 100) : 0;
    const surchargeVES = surchargeUSD * activeRate;
    const totalUSD = debtBaseUSD + surchargeUSD;
    const totalVES = totalUSD * activeRate;

    return { debtBaseUSD, debtBaseVES, surchargeUSD, surchargeVES, totalUSD, totalVES };
  }, [debtUSD, activeRate, surchargeActive, surchargePercent]);

  const handleSave = async () => {
    if (!name.trim()) return;

    await updateWithSync(db.clients, 'clients', client.id!, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      debtUSD: Number(debtUSD) || 0,
      debtVES: (Number(debtUSD) || 0) * activeRate,
      note: note.trim(),
      status,
      surchargeActive,
      surchargePercent: surchargeActive ? surchargePercent : 0,
      updatedAt: Date.now(),
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar al cliente "${client.name}" de la base de datos?`)) return;
    await deleteWithSync(db.clients, 'clients', client.id!);
    onClose();
  };

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mn-modal-overlay">
      <div className="mn-modal max-w-lg w-full animate-scale-in">
        {/* Header */}
        <div className="mn-modal-header border-b border-[#E6E9EF]">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-sm"
              style={{
                background:
                  status === 'paid'
                    ? '#00CA72'
                    : daysOverdue > 0
                    ? '#E2445C'
                    : '#6161FF',
              }}
            >
              {initials || 'CL'}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#323338]">{name || 'Cliente'}</h2>
              <p className="text-xs text-[#676879]">
                Ficha comercial · Control crediticio y recargos
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/5 text-[#676879]">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Overdue Alert if applicable */}
          {status === 'pending' && daysOverdue > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs">
              <Clock size={18} className="text-[#E2445C] flex-shrink-0" />
              <div>
                <span className="font-bold text-[#E2445C] block">
                  Cliente en mora ({daysOverdue} días de retraso)
                </span>
                <span className="text-[#676879]">
                  Venció el {new Date(client.dueDate).toLocaleDateString('es-VE')} · Categoría: {overdueCategory}
                </span>
              </div>
            </div>
          )}

          {/* Fields Grid */}
          <div className="space-y-3">
            <div>
              <label className="mn-input-label">Nombre / Razón Social</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mn-input text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mn-input-label">Teléfono (WhatsApp)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="04141234567"
                  className="mn-input text-xs"
                />
              </div>

              <div>
                <label className="mn-input-label">Deuda Comercial ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={debtUSD}
                  onChange={(e) => setDebtUSD(parseFloat(e.target.value) || 0)}
                  className="mn-input text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="mn-input-label">Nota o Referencia</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Referencia de crédito o dirección de despacho"
                className="mn-input text-xs"
              />
            </div>
          </div>

          {/* Surcharge Configuration (Master / Authorized) */}
          {canApplySurcharges && status === 'pending' && (
            <div className="p-4 rounded-xl border border-[#E6E9EF] bg-[#F6F7FB] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent size={16} className="text-[#FDAB3D]" />
                  <span className="text-xs font-bold text-[#323338]">
                    ¿Aplicar recargo por mora financiera?
                  </span>
                </div>
                <div
                  onClick={() => setSurchargeActive(!surchargeActive)}
                  className={`mn-toggle ${surchargeActive ? 'on' : ''}`}
                />
              </div>

              {surchargeActive && (
                <div className="space-y-3 pt-2 border-t border-[#E6E9EF] animate-fade-in">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-[#676879] mb-1">
                      <span>Porcentaje de recargo adicional</span>
                      <span className="font-bold text-[#FDAB3D] font-mono">{surchargePercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={surchargePercent}
                      onChange={(e) => setSurchargePercent(Number(e.target.value))}
                      className="w-full accent-[#6161FF] cursor-pointer"
                    />
                  </div>

                  {/* Calculation Details */}
                  <div className="p-3 rounded-lg bg-white border border-[#E6E9EF] text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between text-[#676879]">
                      <span>Deuda Base:</span>
                      <span>{formatCurrency(calculations.debtBaseUSD, 'USD')}</span>
                    </div>
                    <div className="flex justify-between text-[#FDAB3D]">
                      <span>Recargo ({surchargePercent}%):</span>
                      <span>+{formatCurrency(calculations.surchargeUSD, 'USD')}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#E2445C] border-t border-[#E6E9EF] pt-1 text-sm">
                      <span>Total Exigible:</span>
                      <span>{formatCurrency(calculations.totalUSD, 'USD')}</span>
                    </div>
                    <div className="flex justify-end text-[0.6875rem] text-[#676879]">
                      <span>Equiv. {formatCurrency(calculations.totalVES, 'VES')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mn-modal-footer flex items-center justify-between">
          <button
            type="button"
            onClick={handleDelete}
            className="text-xs font-bold text-[#E2445C] hover:underline flex items-center gap-1"
          >
            <Trash2 size={13} />
            <span>Eliminar Cliente</span>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="mn-btn mn-btn-outline text-xs">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="mn-btn mn-btn-primary text-xs flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SurchargeCard;
