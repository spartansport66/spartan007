"use client";

import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload as UploadIcon, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import *s z from 'zod';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnMapping {
  source: string; // Original Excel header
  targetKey: string | ''; // Mapped schema key, or empty string if not mapped
}

interface ParsedRow<T> {
  originalRow: number;
  isValid: boolean;
  errors: string[];
  data: T;
  rawData: { [key: string]: any }; // The raw object from the Excel row (original keys)
}

interface ExcelUploadProps<T extends z.ZodTypeAny> {
  onUpload: (data: z.infer<T>[]) => Promise<void>;
  sampleData: any[];
  sampleFileName: string;
  uploadButtonText: string;
  displayHeaders: { key: string; label: string }[]; // Headers for display in the table
  validationSchema: T;
}

const ExcelUpload = <T extends z.ZodTypeAny>({
  onUpload,
  sampleData,
  sampleFileName,
  uploadButtonText,
  displayHeaders,
  validationSchema,
}: ExcelUploadProps<T>) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow<z.infer<T>>[]>([]);
  const [loading, setLoading] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]); // Original Excel headers
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]); // User-defined mappings
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData([]);
      setExcelHeaders([]);
      setColumnMappings([]);
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
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 1) {
          showError('Excel file is empty.');
          setLoading(false);
          return;
        }
        
        const detectedHeaders = (jsonData[0] as string[]).map(h => String(h).trim()).filter(h => h !== ''); // Filter out empty headers
        setExcelHeaders(detectedHeaders);

        // Initialize column mappings with detected headers and empty target keys
        const initialMappings: ColumnMapping[] = detectedHeaders.map(header => {
          // Attempt to auto-map if the detected header matches a required field's label
          const matchedField = displayHeaders.find(field => field.label.toLowerCase() === header.toLowerCase());
          return {
            source: header,
            targetKey: matchedField ? matchedField.key : '', // Auto-map if found, otherwise empty
          };
        });
        setColumnMappings(initialMappings);

        // Clear parsed data until mappings are applied
        setParsedData([]);
        showSuccess('Excel file parsed. Please map your columns.');

      } catch (error: any) {
        console.error('Error during Excel parsing:', error);
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

  const handleMappingChange = (sourceHeader: string, targetValue: string) => {
    setColumnMappings(prevMappings =>
      prevMappings.map(mapping =>
        mapping.source === sourceHeader ? { ...mapping, targetKey: targetValue === "__NONE__" ? "" : targetValue } : mapping
      )
    );
  };

  const applyMappingsAndValidate = () => {
    if (!file || excelHeaders.length === 0) {
      showError('Please parse an Excel file first.');
      return;
    }
    processAndValidateData();
  };

  // Memoize the options for the target select dropdown
  const targetKeyOptions = useMemo(() => {
    return displayHeaders.map(field => ({
      value: field.key,
      label: field.label,
    }));
  }, [displayHeaders]);

  const processAndValidateData = () => {
    if (!file || excelHeaders.length === 0) {
      showError('Please parse an Excel file first.');
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
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const startRowIndex = excelHeaders.length > 0 ? 1 : 0;
        const processedRows: ParsedRow<z.infer<T>>[] = [];

        for (let i = startRowIndex; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }

          const rawRowObject: { [key: string]: any } = {};
          excelHeaders.forEach((header, index) => {
            rawRowObject[header] = row[index];
          });

          const transformedRowObject: Partial<z.infer<T>> = {};

          // Apply mappings to transform raw data into schema-compatible object
          columnMappings.forEach(mapping => {
            if (mapping.targetKey) {
              const rawValue = rawRowObject[mapping.source];
              // Use z.coerce.number for numeric fields, otherwise use rawValue or null
              // This is a generic approach, specific coercions should ideally be handled by the schema itself
              transformedRowObject[mapping.targetKey as keyof z.infer<T>] = (rawValue !== undefined && rawValue !== null) ? rawValue : null;
            }
          });

          const validationResult = validationSchema.safeParse(transformedRowObject);
          if (validationResult.success) {
            processedRows.push({
              originalRow: i + 1,
              isValid: true,
              errors: [],
              data: validationResult.data,
              rawData: rawRowObject,
            });
          } else {
            const zodErrors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            processedRows.push({
              originalRow: i + 1,
              isValid: false,
              errors: zodErrors,
              data: transformedRowObject as z.infer<T>, // Cast to full schema type for consistency
              rawData: rawRowObject,
            });
          }
        }

        setParsedData(processedRows);

        if (processedRows.some(row => !row.isValid)) {
          showError('Some rows contain invalid data. Please correct them before uploading.');
        } else if (processedRows.length > 0) {
          showSuccess(`Processed ${processedRows.length} rows. Review the data below.`);
        } else {
          showError('No valid data found in the Excel file after applying mappings.');
        }
      } catch (error: any) {
        console.error('Error during data processing and validation:', error);
        showError(`Error processing data: ${error.message}`);
      } finally {
        setLoading(false);
      }
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
      await onUpload(validParsedData.map(p => p.data));
      setParsedData([]);
      setFile(null);
      setExcelHeaders([]);
      setColumnMappings([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Error uploading items:', error);
      showError(`Failed to upload items: ${error.message}`);
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
          {uploadButtonText}
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

        {excelHeaders.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Map Your Columns</h3>
            <p className="text-sm text-muted-foreground">
              Match your Excel file's columns to the required fields.
            </p>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Your Excel Column</TableHead>
                    <TableHead>Required Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{mapping.source}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping.targetKey || "__NONE__"} // Use __NONE__ for empty targetKey
                          onValueChange={(value: string) =>
                            handleMappingChange(mapping.source, value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select required field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__NONE__">Do not map</SelectItem> {/* Use __NONE__ */}
                            {targetKeyOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={processAndValidateData} disabled={loading} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Apply Mappings & Validate'}
            </Button>
          </div>
        )}
        
        {parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    {displayHeaders.map((field, index) => (
                      <TableHead key={index}>{field.label}</TableHead>
                    ))}
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((row, rowIndex) => (
                    <TableRow
                      key={rowIndex}
                      className={cn(
                        row.isValid ? "" : "bg-red-50/50 hover:bg-red-100/50"
                      )}
                    >
                      <TableCell className="font-medium">{row.originalRow}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </TableCell>
                      {displayHeaders.map((field, colIndex) => {
                        const value = row.data[field.key as keyof z.infer<T>];
                        return (
                          <TableCell key={colIndex}>
                            {value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : 'N/A'}
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