import * as XLSX from 'xlsx';

interface ParseExcelResult {
  headers: string[];
  data: any[]; // Array of objects, where keys are original headers
}

export const parseExcelFile = (file: File): Promise<ParseExcelResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read all data as array of arrays, without header inference
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!Array.isArray(jsonData) || jsonData.length < 1) {
          reject(new Error('[parseExcelFile] Excel file is empty or malformed.'));
          return;
        }
        
        // Extract headers from the first row, ensuring they are trimmed strings
        const headers = (jsonData[0] as any[]).map(h => String(h ?? '').trim()).filter(h => h !== '');
        
        if (headers.length === 0 && jsonData.length > 1) {
          reject(new Error('[parseExcelFile] Could not detect headers in the first row. Please ensure your Excel file has headers.'));
          return;
        }

        const dataRows = jsonData.slice(1); // Data starts from the second row (after headers)
        const parsedData: any[] = dataRows.map((row: any, index: number) => {
          const rowData: any = { originalRow: index + 2 }; // Add original row number for debugging/display
          if (Array.isArray(row)) {
            headers.forEach((header, i) => {
              // Ensure all values are treated as strings, converting null/undefined to empty string before trimming
              rowData[header] = String(row[i] ?? '').trim();
            });
          } else {
            // If row is not an array (e.g., empty row in sheet_to_json), treat it as an empty row
            headers.forEach((header) => {
              rowData[header] = '';
            });
          }
          return rowData;
        }).filter(row => Object.values(row).some(val => String(val).trim() !== '')); // Filter out completely empty rows

        resolve({ headers, data: parsedData });

      } catch (error: any) {
        reject(new Error(`[parseExcelFile] Error parsing Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('[parseExcelFile] Error reading file. Please try again.'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const downloadExcelFile = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  try {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);
    return true;
  } catch (error: any) {
    console.error(`[downloadExcelFile] Error creating Excel file:`, error);
    throw new Error(`[downloadExcelFile] Failed to create Excel file: ${error.message}`);
  }
};