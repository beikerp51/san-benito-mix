import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { MnModal } from '../../components/ios-components';
import { db, addWithSync } from '../../db/database';
import { useExchangeRateStore, formatCurrency } from '../../services/exchange-rate-service';
import { addDays } from 'date-fns';
import { ClipboardPaste, CheckCircle2, AlertCircle, Trash2, Edit2, Sparkles, UserCheck } from 'lucide-react';

interface SmartPasteModalProps {
  onClose: () => void;
  onImportComplete?: () => void;
}

export interface ParsedClient {
  id: string;
  name: string;
  amount: number;
  originalText: string;
  valid: boolean;
}

/**
 * Parses real-world WhatsApp messages:
 * - Drops WhatsApp timestamps: [15/9, 2:30 p.m.], 15/09/2026, 14:30 - etc.
 * - Drops WhatsApp sender prefix: 'Beiker: Carlos: 15.00' -> name: 'Carlos', amount: 15.00
 * - Handles 'Client: Amount' with comma or dot decimals: 'Maria: 20,50' -> 20.50
 * - Handles currency markers ($ or Bs)
 */
export function parseWhatsAppClientLine(rawLine: string): { name: string; amount: number } | null {
  if (!rawLine || !rawLine.trim()) return null;
  let str = rawLine.trim();

  // 1. Remove WhatsApp timestamp patterns:
  // Examples:
  // [15/9, 2:30 p. m.]
  // [15/09/2026, 14:30:15]
  // 15/09/2026, 2:30 p.m. -
  // [2:30 p. m., 15/9/2026]
  str = str.replace(/^\[\s*\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\s*\]\s*/i, '');
  str = str.replace(/^\[\s*\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?,?\s+\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?\s*\]\s*/i, '');
  str = str.replace(/^\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?,?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?\s*-\s*/i, '');

  // 2. Remove WhatsApp sender prefix if multiple colons exist:
  // e.g. "Beiker: Carlos: 15.00" -> first part is sender, second is client
  const colonCount = (str.match(/:/g) || []).length;
  if (colonCount >= 2) {
    const firstColonIdx = str.indexOf(':');
    str = str.substring(firstColonIdx + 1).trim();
  }

  // 3. Match "ClientName: Amount" (with colon)
  if (str.includes(':')) {
    const colonIdx = str.indexOf(':');
    let name = str.substring(0, colonIdx).trim();
    const rest = str.substring(colonIdx + 1).trim();

    // Clean any residual symbols in name
    name = name.replace(/^[-–—~*_\s]+|[-–—~*_\s]+$/g, '').trim();

    // Extract amount: captures numbers with optional dot or comma decimal (e.g. 15, 15.50, 15,50)
    const amountMatch = rest.match(/(\d+(?:[.,]\d+)?)/);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(',', '.'));
      if (name.length > 0 && !isNaN(amount) && amount > 0) {
        return { name, amount };
      }
    }
  }

  // 4. Fallback for lines without colon: e.g. "Carlos Mendoza 15.50$" or "María $20"
  const amountMatch = str.match(/(\d+(?:[.,]\d+)?)/);
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(',', '.'));
    let name = str
      .replace(amountMatch[0], '')
      .replace(/[\$#~*_—–\-]/g, '')
      .replace(/\b(usd|ves|bs|dolares|bolivares)\b/gi, '')
      .trim();

    name = name.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();

    if (name.length > 0 && !isNaN(amount) && amount > 0) {
      return { name, amount };
    }
  }

  return null;
}

export const SmartPasteModal: React.FC<SmartPasteModalProps> = ({ onClose, onImportComplete }) => {
  const activeRate = useExchangeRateStore((s) => s.getActiveRate());
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedClient[]>([]);
  const [imported, setImported] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleParse = () => {
    // Sanitize against XSS
    const sanitized = DOMPurify.sanitize(rawText, { ALLOWED_TAGS: [] });

    const lines = sanitized
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const results: ParsedClient[] = lines.map((line, index) => {
      const result = parseWhatsAppClientLine(line);

      return {
        id: `parsed-${index}-${Date.now()}`,
        name: result ? result.name : line,
        amount: result ? result.amount : 0,
        originalText: line,
        valid: !!result && result.amount > 0 && result.name.length > 0,
      };
    });

    setParsed(results);
  };

  const handleUpdateItem = (id: string, name: string, amount: number) => {
    setParsed((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: name.trim(),
              amount,
              valid: name.trim().length > 0 && amount > 0,
            }
          : item
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    setParsed((prev) => prev.filter((item) => item.id !== id));
  };

  const handleImport = async () => {
    const validEntries = parsed.filter((p) => p.valid);
    if (validEntries.length === 0) return;

    const dueDate = addDays(new Date(), 15).getTime();

    for (const entry of validEntries) {
      await addWithSync(db.clients, 'clients', {
        name: entry.name,
        debtUSD: entry.amount,
        debtVES: entry.amount * activeRate,
        rateAtCreation: activeRate,
        dueDate,
        status: 'pending',
        surchargePercent: 10,
        surchargeActive: false,
        note: `Carga rápida WhatsApp. Deuda: $${entry.amount.toFixed(2)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    setImported(true);
    if (onImportComplete) onImportComplete();
    setTimeout(() => onClose(), 1400);
  };

  const validCount = parsed.filter((p) => p.valid).length;
  const totalUSD = parsed.filter((p) => p.valid).reduce((sum, p) => sum + p.amount, 0);

  return (
    <MnModal
      isOpen={true}
      onClose={onClose}
      title="Carga Masiva desde WhatsApp (Smart Paste)"
      width="640px"
    >
      <div className="space-y-4 animate-fade-in">
        {imported ? (
          <div className="text-center py-10 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-[#00CA72] flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-lg font-bold text-[#323338]">
              ¡{validCount} clientes importados con éxito!
            </h3>
            <p className="text-xs text-[#676879] mt-1">
              Todos los clientes fueron creados con sus montos limpios y sin fechas/horas de WhatsApp.
            </p>
          </div>
        ) : (
          <>
            {/* Guide Info Card */}
            <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E9EF]">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles size={16} className="text-[#6161FF]" />
                <span className="text-xs font-bold text-[#323338]">
                  Filtro Inteligente Anti-WhatsApp
                </span>
              </div>
              <p className="text-xs text-[#676879] leading-relaxed">
                Pega directamente cualquier bloque copiado de WhatsApp. El sistema{' '}
                <strong>eliminará automáticamente</strong> la fecha, la hora y tu nombre de remitente,
                dejando exclusivamente el <strong>nombre de la persona</strong> y el{' '}
                <strong>monto de la compra</strong>.
              </p>
            </div>

            {/* Input Text Area */}
            <div>
              <label className="block text-xs font-bold text-[#323338] mb-1.5">
                Pega los mensajes aquí:
              </label>
              <textarea
                className="mn-input min-h-[120px] font-mono text-xs leading-relaxed"
                placeholder={`[15/9, 2:30 p. m.] Beiker: Carlos: 15.00\n[15/9, 2:31 p. m.] Beiker: María Gómez: 20,50\nPedro Pérez: 35.00`}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (parsed.length > 0) setParsed([]);
                }}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Parse Trigger Button */}
            {parsed.length === 0 && (
              <button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="w-full py-3 rounded-xl bg-[#6161FF] hover:bg-[#5050E6] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#6161FF]/20 disabled:opacity-40 transition-all"
              >
                <ClipboardPaste size={16} />
                <span>Procesar y Limpiar Texto</span>
              </button>
            )}

            {/* Parsed Results Preview Table */}
            {parsed.length > 0 && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#323338]">
                    Clientes Detectados ({validCount} de {parsed.length})
                  </span>
                  <button
                    onClick={() => {
                      setParsed([]);
                      setRawText('');
                    }}
                    className="text-xs text-[#6161FF] hover:underline font-semibold"
                  >
                    Volver a pegar
                  </button>
                </div>

                <div className="mn-card max-h-64 overflow-y-auto divide-y divide-[#E6E9EF]">
                  {parsed.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-[#F5F6F8] transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {item.valid ? (
                          <CheckCircle2 size={16} className="text-[#00CA72] flex-shrink-0" />
                        ) : (
                          <AlertCircle size={16} className="text-[#E2445C] flex-shrink-0" />
                        )}

                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, e.target.value, item.amount)}
                            className="font-bold text-[#323338] bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-[#6161FF] px-1.5 py-0.5 rounded outline-none w-full"
                          />
                          {!item.valid && (
                            <div className="text-[0.625rem] text-[#E2445C] truncate px-1">
                              Original: {item.originalText}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[#676879]">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.amount || ''}
                          onChange={(e) =>
                            handleUpdateItem(item.id, item.name, parseFloat(e.target.value) || 0)
                          }
                          className="w-20 font-bold font-mono text-right text-[#323338] bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-[#6161FF] px-1.5 py-0.5 rounded outline-none border border-[#E6E9EF]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-[#676879] hover:text-[#E2445C] transition-colors"
                          title="Eliminar de la lista"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Card */}
                <div className="p-3.5 rounded-xl bg-[#F6F7FB] border border-[#E6E9EF] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#676879] block">Total acumulado a cargar:</span>
                    <span className="font-extrabold text-[#323338] text-sm">
                      {formatCurrency(totalUSD, 'USD')}
                    </span>
                    <span className="text-[#676879] ml-1">
                      (~Bs. {(totalUSD * activeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#676879] block">Plazo de cobro:</span>
                    <span className="font-semibold text-[#6161FF]">15 Días</span>
                  </div>
                </div>

                {/* Confirm Import Button */}
                <button
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="w-full py-3.5 rounded-xl bg-[#00CA72] hover:bg-[#00B766] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-[#00CA72]/20 disabled:opacity-40 transition-all"
                >
                  <UserCheck size={16} />
                  <span>Confirmar e Importar {validCount} Clientes</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </MnModal>
  );
};
