import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export interface BillExportRow {
  'SALE/PUR': string;
  'TYPE': string;
  'DATE': string;
  'VOUCHER SERIES': string;
  'VOUCHER NO.': string;
  'PARTY': string;
  'STATION': string;
  'P.O.S.': string;
  'GSTIN': string;
  'PARTY CODE': string;
  'INVOICE NO.': string;
  'INVOICE DATE': string;
  'ITEM NAME': string;
  'ITEM SIZE': string;
  'HSN CODE': string;
  'QUANTITY': number;
  'UNIT': string;
  'TAXABLE VALUE': number;
  'FREIGHT': number;
  'PACKING': number;
  'GST RATE': number;
  'CGST': number;
  'SGST': number;
  'IGST': number;
  'TOTAL': number;
  'R/OFF': number;
  'NET AMOUNT': number;
}

export interface BillDataForExport {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  payment_status: string;
  status: string;
  dealer_name: string;
  dealer_gst: string;
  dealer_code: string;
  dealer_address?: string;
  dealer_city?: string;
  dealer_state?: string;
  company_name: string;
  company_gst: string;
  freight_charges?: number;
  round_off?: number;
  items: Array<{
    product_name: string;
    product_code: string;
    product_size?: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount_percent: number;
    gst_percent: number;
    total_price: number;
  }>;
}

/**
 * Converts bill data to Excel rows with all required accounting headers
 */
export const convertBillsToExcelRows = (bills: BillDataForExport[]): BillExportRow[] => {
  const rows: BillExportRow[] = [];

  bills.forEach((bill) => {
    const billNumberParts = bill.bill_number.split('/');
    const voucherSeries = billNumberParts[0] || '';
    const voucherNo = billNumberParts[billNumberParts.length - 1] || bill.bill_number;

    if (bill.items.length === 0) {
      const row: BillExportRow = {
        'SALE/PUR': 'S',
        'TYPE': 'L',
        'DATE': format(new Date(bill.bill_date), 'dd/MM/yyyy'),
        'VOUCHER SERIES': voucherSeries,
        'VOUCHER NO.': voucherNo,
        'PARTY': bill.dealer_name,
        'STATION': bill.dealer_city || bill.dealer_address || '',
        'P.O.S.': 'PUNJAB',
        'GSTIN': bill.dealer_gst || '',
        'PARTY CODE': bill.dealer_code || '',
        'INVOICE NO.': bill.bill_number,
        'INVOICE DATE': format(new Date(bill.bill_date), 'dd/MM/yyyy'),
        'ITEM NAME': '',
        'ITEM SIZE': '',
        'HSN CODE': '',
        'QUANTITY': 0,
        'UNIT': '',
        'TAXABLE VALUE': 0,
        'FREIGHT': bill.freight_charges || 0,
        'PACKING': 0,
        'GST RATE': 0,
        'CGST': 0,
        'SGST': 0,
        'IGST': 0,
        'TOTAL': parseFloat(bill.grand_total.toFixed(2)),
        'R/OFF': bill.round_off || 0,
        'NET AMOUNT': parseFloat(bill.grand_total.toFixed(2)),
      };

      rows.push(row);
      return;
    }

    bill.items.forEach((item, itemIndex) => {
      const taxableValue = item.unit_price * item.quantity * (1 - item.discount_percent / 100);
      const gstAmount = taxableValue * (item.gst_percent / 100);
      const cgst = gstAmount / 2;
      const sgst = gstAmount / 2;
      const igst = 0;

      const row: BillExportRow = {
        'SALE/PUR': 'S',
        'TYPE': 'L',
        'DATE': format(new Date(bill.bill_date), 'dd/MM/yyyy'),
        'VOUCHER SERIES': voucherSeries,
        'VOUCHER NO.': voucherNo,
        'PARTY': bill.dealer_name,
        'STATION': bill.dealer_city || bill.dealer_address || '',
        'P.O.S.': 'PUNJAB',
        'GSTIN': bill.dealer_gst || '',
        'PARTY CODE': bill.dealer_code || '',
        'INVOICE NO.': bill.bill_number,
        'INVOICE DATE': format(new Date(bill.bill_date), 'dd/MM/yyyy'),
        'ITEM NAME': item.product_name,
        'ITEM SIZE': item.product_size || '',
        'HSN CODE': item.hsn_code || '',
        'QUANTITY': item.quantity,
        'UNIT': item.unit || 'Nos',
        'TAXABLE VALUE': parseFloat(taxableValue.toFixed(2)),
        'FREIGHT': itemIndex === 0 ? (bill.freight_charges || 0) : 0,
        'PACKING': 0,
        'GST RATE': item.gst_percent,
        'CGST': parseFloat(cgst.toFixed(2)),
        'SGST': parseFloat(sgst.toFixed(2)),
        'IGST': parseFloat(igst.toFixed(2)),
        'TOTAL': parseFloat(item.total_price.toFixed(2)),
        'R/OFF': itemIndex === 0 ? (bill.round_off || 0) : 0,
        'NET AMOUNT': itemIndex === 0 ? parseFloat(bill.grand_total.toFixed(2)) : 0,
      };

      rows.push(row);
    });
  });

  return rows;
};

/**
 * Exports bills to Excel file
 */
export const exportBillsToExcel = (bills: BillDataForExport[], filename = 'Bills_Export.xlsx') => {
  try {
    const rows = convertBillsToExcelRows(bills);

    // Create a new workbook
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bills');

    // Set column widths
    const columnWidths = {
      'SALE/PUR': 12,
      'TYPE': 12,
      'DATE': 12,
      'VOUCHER SERIES': 14,
      'VOUCHER NO.': 14,
      'PARTY': 20,
      'STATION': 15,
      'P.O.S.': 15,
      'GSTIN': 18,
      'PARTY CODE': 14,
      'INVOICE NO.': 14,
      'INVOICE DATE': 12,
      'ITEM NAME': 25,
      'ITEM SIZE': 12,
      'HSN CODE': 12,
      'QUANTITY': 10,
      'UNIT': 10,
      'TAXABLE VALUE': 14,
      'FREIGHT': 12,
      'PACKING': 12,
      'GST RATE': 10,
      'CGST': 12,
      'SGST': 12,
      'IGST': 12,
      'TOTAL': 14,
      'R/OFF': 12,
      'NET AMOUNT': 14,
    };

    ws['!cols'] = Object.values(columnWidths).map(width => ({ wch: width }));

    // Style header row (optional - XLSX basic styling)
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1F4E78' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    // Apply header styles to first row
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!ws[address]) continue;
      ws[address].s = headerStyle;
    }

    // Write the file
    XLSX.writeFile(wb, filename);
    return true;
  } catch (error) {
    console.error('Error exporting bills to Excel:', error);
    throw error;
  }
};

/**
 * Generates a filename with current date
 */
export const generateBillExportFilename = (company?: string): string => {
  const date = format(new Date(), 'yyyy-MM-dd_HHmmss');
  const companyPart = company ? `_${company}` : '';
  return `Bills_Export${companyPart}_${date}.xlsx`;
};
