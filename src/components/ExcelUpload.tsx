"use client";

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload as UploadIcon, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import * as z from 'zod';
import { cn } from '@/lib/utils';

interface ParsedRow {
  originalRow: number;
  isValid: boolean;
  errors: string[];
  data: any; // The validated data object (matching schema keys)
  rawData: any; // The raw object from the Excel row (original keys)
}

interface ExcelUploadProps {
  onUpload: (data: any[]) => Promise<void>;
  sampleData: any[];
  sampleFileName: string;
  uploadButtonText: string;
  displayHeaders: string[]; // Headers for display in the table
  columnMap: { [excelHeader: string]: string }; // Maps Excel column names to schema keys
  validationSchema: z.ZodSchema<any>;
}

const ExcelUpload: React.FC<ExcelUploadProps> = ({
  onUpload,
  sampleData,
  sampleFileName,
  uploadButtonText,
  displayHeaders,
  columnMap,
  validationSchema,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData([]);
    } else {
      setFile(null);
    }
  };

  const handleParseExcel = () => {
    if (!file) {
      showError('Please select an Excel file to upload.');
      return;
    }

    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Use header: 1 to get data as array of arrays, then manually map to objects
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) { // At least header + one data row
          showError('Excel file is empty or has no data rows.');
          setLoading(false);
          return;
        }
        
        const excelHeaders = (jsonData[0] as string[]).map(h => h.trim());
        
        // Check if all required headers (from columnMap keys) are present in the Excel file
        const requiredExcelHeaders = Object.keys(columnMap);
        const missingHeaders = requiredExcelHeaders.filter(rh => !excelHeaders.includes(rh));
        
        if (missingHeaders.length > 0) {
          showError(`Missing required columns in Excel: ${missingHeaders.join(', ')}`);
          setLoading(false);
          return;
        }
        
        const parsedRows: ParsedRow[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          // Skip entirely empty rows
          if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }
          
          const rawRowObject: { [key: string]: any } = {};
          excelHeaders.forEach((header, index) => {
            rawRowObject[header] = row[index];
          });

          const transformedRowObject: { [key: string]: any } = {};
          let hasAllRequiredMappedFields = true;
          for (const excelHeader in columnMap) {
            const schemaKey = columnMap[excelHeader];
            const rawValue = rawRowObject[excelHeader];
            
            // Special handling for numbers to ensure they are parsed correctly before Zod
            if (schemaKey === 'price' || schemaKey === 'creditlimit' || schemaKey === 'openingbalance') {
              transformedRowObject[schemaKey] = parseFloat(rawValue);
            } else if (schemaKey === 'stock' || schemaKey === 'allottedcreditdays') {
              transformedRowObject[schemaKey] = parseInt(rawValue);
            } else {
              transformedRowObject[schemaKey] = rawValue;
            }

            // Check if a required field (based on schema) is missing in the transformed object
            // This is a basic check, Zod will do the full validation
            if (validationSchema instanceof z.ZodObject && validationSchema.shape[schemaKey] && validationSchema.shape[schemaKey]._def.typeName === 'ZodString' && validationSchema.shape[schemaKey]._def.checks.some((check: any) => check.kind === 'min' && check.value > 0) && (rawValue === undefined || rawValue === null || String(rawValue).trim() === '')) {
                hasAllRequiredMappedFields = false;
            }
          }

          const validationResult = validationSchema.safeParse(transformedRowObject);
          
          if (validationResult.success && hasAllRequiredMappedFields) {
            parsedRows.push({
              originalRow: i + 1,
              isValid: true,
              errors: [],
              data: validationResult.data,
              rawData: rawRowObject,
            });
          } else {
            const errors = validationResult.success ? [] : validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            if (!hasAllRequiredMappedFields && validationResult.success) {
                // Add a generic error if required fields were missing but Zod didn't catch it (e.g., due to preprocess)
                errors.push('One or more required fields are missing or empty.');
            }
            parsedRows.push({
              originalRow: i + 1,
              isValid: false,
              errors: errors,
              data: transformedRowObject, // Keep transformed data for context
              rawData: rawRowObject,
            });
          }
        }
        
        setParsedData(parsedRows);
        if (parsedRows.some(row => !row.isValid)) {
          showError('Some rows contain invalid data. Please correct them before uploading.');
        } else if (parsedRows.length > 0) {
          showSuccess(`Parsed ${parsedRows.length} rows from Excel file. All valid.`);
        } else {
          showError('No valid data found in the Excel file.');
        }
      } catch (error: any) {
        console.error('Error parsing Excel file:', error);
        showError(`Error parsing Excel file: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = () => {
      showError('Error reading file. Please try again.');
      setLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleUpload = async () => {
    const validParsedData = parsedData.filter(p => p.isValid);
    if (validParsedData.length === 0) {
      showError('No valid data to upload.');
      return;
    }
    
    if (parsedData.some(row => !row.isValid)) {
      showError('Cannot upload. Please correct all invalid rows first.');
      return;
    }

    setLoading(true);
    try {
      await onUpload(validParsedData.map(p => p.data)); // Pass only the validated data
      setParsedData([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading data:', error);
      showError(`Failed to upload data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    try {
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');
      
      XLSX.writeFile(wb, sampleFileName);
      showSuccess('Sample Excel file downloaded successfully!');
    } catch (error: any) {
      console.error('Error creating sample file:', error);
      showError(`Failed to create sample file: ${error.message}`);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="h-5 w-5" />
          Bulk Upload
        </CardTitle>
        <CardDescription>
          Upload an Excel sheet to add multiple items at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="excel-file">Excel File</Label>
            <Input 
              id="excel-file" 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange} 
              ref={fileInputRef}
              disabled={loading}
            />
          </div>
          <Button 
            onClick={handleParseExcel} 
            disabled={!file || loading}
            className="w-full sm:w-auto"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadIcon className="mr-2 h-4 w-4" />}
            {loading ? 'Parsing...' : 'Parse Excel'}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleDownloadSample} 
            disabled={loading}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Sample
          </Button>
        </div>

        {parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    {displayHeaders.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((row, rowIndex) => ( // Show first 10 rows
                    <TableRow key={rowIndex} className={cn(row.isValid ? "" : "bg-red-50/50 hover:bg-red-100/50")}>
                      <TableCell className="font-medium">{row.originalRow}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </TableCell>
                      {displayHeaders.map((header, colIndex) => {
                        // Find the original Excel header that maps to this display header
                        const originalExcelHeader = Object.keys(columnMap).find(key => columnMap[key] === header.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        const rawValue = originalExcelHeader ? row.rawData[originalExcelHeader] : 'N/A';
                        return (
                          <TableCell key={colIndex}>
                            {rawValue !== undefined && rawValue !== null ? String(rawValue) : 'N/A'}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-yellow-600 dark:text-yellow-400 text-sm">
                        {row.errors.length > 0 ? row.errors.join('; ') : 'None'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedData.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={displayHeaders.length + 3} className="text-center">
                        ... and {parsedData.length - 10} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {parsedData.filter(p => p.isValid).length} valid rows, {parsedData.filter(p => !p.isValid).length} invalid rows
              </p>
              <Button 
                onClick={handleUpload} 
                disabled={loading || parsedData.some(row => !row.isValid) || parsedData.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadIcon className="mr-2 h-4 w-4" />}
                {loading ? 'Uploading...' : uploadButtonText}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ExcelUpload;