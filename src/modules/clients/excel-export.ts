import * as XLSX from 'xlsx';
import type { Client } from '../../db/database';

export function exportClientsToExcel(clients: Client[], activeRate: number): void {
  // Sort A-Z
  const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));

  const rows = sorted.map((client) => {
    const daysOverdue =
      client.status === 'pending'
        ? Math.max(0, Math.floor((Date.now() - client.dueDate) / (1000 * 60 * 60 * 24)))
        : 0;

    const surchargeUSD = client.surchargeActive
      ? client.debtUSD * (client.surchargePercent / 100)
      : 0;
    const totalUSD = client.debtUSD + surchargeUSD;

    return {
      'Nombre': client.name,
      'Deuda ($)': Number(client.debtUSD.toFixed(2)),
      'Deuda (Bs)': Number((client.debtUSD * activeRate).toFixed(2)),
      'Estado': client.status === 'paid' ? 'PAGADO' : 'PENDIENTE',
      'Fecha Vencimiento': new Date(client.dueDate).toLocaleDateString('es-VE'),
      'Días Atraso': daysOverdue,
      'Recargo (%)': client.surchargeActive ? client.surchargePercent : 0,
      'Recargo ($)': Number(surchargeUSD.toFixed(2)),
      'Total ($)': Number(totalUSD.toFixed(2)),
      'Total (Bs)': Number((totalUSD * activeRate).toFixed(2)),
      'Nota': client.note,
    };
  });

  // Add totals row
  const totalDebtUSD = sorted.filter(c => c.status === 'pending').reduce((s, c) => s + c.debtUSD, 0);
  const totalSurchargeUSD = sorted.filter(c => c.status === 'pending' && c.surchargeActive)
    .reduce((s, c) => s + c.debtUSD * (c.surchargePercent / 100), 0);
  const grandTotalUSD = totalDebtUSD + totalSurchargeUSD;

  rows.push({
    'Nombre': '═══ TOTALES ═══',
    'Deuda ($)': Number(totalDebtUSD.toFixed(2)),
    'Deuda (Bs)': Number((totalDebtUSD * activeRate).toFixed(2)),
    'Estado': '',
    'Fecha Vencimiento': '',
    'Días Atraso': 0,
    'Recargo (%)': 0,
    'Recargo ($)': Number(totalSurchargeUSD.toFixed(2)),
    'Total ($)': Number(grandTotalUSD.toFixed(2)),
    'Total (Bs)': Number((grandTotalUSD * activeRate).toFixed(2)),
    'Nota': '',
  });

  // Create workbook
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Nombre
    { wch: 12 }, // Deuda $
    { wch: 15 }, // Deuda Bs
    { wch: 12 }, // Estado
    { wch: 18 }, // Fecha
    { wch: 12 }, // Días
    { wch: 12 }, // Recargo %
    { wch: 12 }, // Recargo $
    { wch: 12 }, // Total $
    { wch: 15 }, // Total Bs
    { wch: 35 }, // Nota
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes SAN BENITO MIX');

  // Download
  const date = new Date().toLocaleDateString('es-VE').replace(/\//g, '-');
  XLSX.writeFile(workbook, `SanBenitoMix_Clientes_${date}.xlsx`);
}
