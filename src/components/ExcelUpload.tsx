"use client";
import React, { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload as UploadIcon, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseExcelFile, downloadExcelFile } from '@/utils/excel';

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
  excludedSourceHeaders?: string[]; // New prop to exclude specific source headers
}

const ExcelUpload = <T extends z.ZodTypeAny>({
  onUpload,
  sampleData,
  sampleFileName,
  uploadButtonText,
  displayHeaders,
  validationSchema,
  excludedSourceHeaders = [], // Initialize with an empty array
}: ExcelUploadProps<T>) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow<z.infer<T>>[]>([]);
  const [loading, setLoading] = useState(false);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]); // Original Excel headers
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]); // User-defined mappings
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create a map from schema key to display label for error messages
  const schemaKeyToLabelMap = useMemo(() => {
    return new Map(displayHeaders.map(header => [header.key, header.label]));
  }, [displayHeaders]);

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

  const handleParseExcel = async () => {
    if (!file) {
      showError('[ExcelUpload] Please select an Excel file to upload.');
      return;
    }
    setLoading(true);
    try {
      const { headers: detectedHeaders, data: rawParsedData } = await parseExcelFile(file);
      
      // Filter out excluded headers
      let filteredHeaders = detectedHeaders.filter(header => 
        !excludedSourceHeaders.some(excluded => excluded.toLowerCase() === header.toLowerCase())
      );
      
      setExcelHeaders(filteredHeaders);
      
      // Create initial mappings by trying to match headers by name
      const initialMappings: ColumnMapping[] = filteredHeaders.map(header => {
        // Try to find an exact match first (case insensitive)
        const exactMatch = displayHeaders.find(field => 
          field.label.toLowerCase() === header.toLowerCase()
        );
        
        // If no exact match, try partial matching
        const partialMatch = exactMatch ? null : displayHeaders.find(field => 
          header.toLowerCase().includes(field.label.toLowerCase()) ||
          field.label.toLowerCase().includes(header.toLowerCase())
        );
        
        return {
          source: header,
          targetKey: exactMatch?.key || partialMatch?.key || '',
        };
      });
      
      setColumnMappings(initialMappings);
      setParsedData([]); // Clear parsed data until mappings are applied
      showSuccess('[ExcelUpload] Excel file parsed. Please map your columns.');
    } catch (error: any) {
      console.error('[ExcelUpload] Error during Excel parsing:', error);
      showError(`[ExcelUpload] Error parsing Excel file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (sourceHeader: string, targetValue: string) => {
    setColumnMappings(prevMappings => 
      prevMappings.map(mapping => 
        mapping.source === sourceHeader 
          ? { ...mapping, targetKey: targetValue === "__NONE__" ? "" : targetValue } 
          : mapping
      )
    );
  };

  const applyMappingsAndValidate = () => {
    if (!file || excelHeaders.length === 0) {
      showError('[ExcelUpload] Please parse an Excel file first.');
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

  const processAndValidateData = async () => {
    if (!file || excelHeaders.length === 0) {
      showError('[ExcelUpload] Please parse an Excel file first.');
      return;
    }
    setLoading(true);
    try {
      const { data: rawParsedData } = await parseExcelFile(file); // Re-parse to get raw data rows

      const processedRows: ParsedRow<z.infer<T>>[] = [];
      
      for (const rawRow of rawParsedData) {
        // Create transformed object based on column mappings
        const transformedRowObject: Partial<z.infer<T>> = {};
        
        // Apply mappings to transform raw data into schema-compatible object
        columnMappings.forEach(mapping => {
          if (mapping.targetKey) {
            const rawValue = rawRow[mapping.source];
            transformedRowObject[mapping.targetKey as keyof z.infer<T>] = rawValue;
          }
        });
        
        // Validate the transformed object against the schema
        const validationResult = validationSchema.safeParse(transformedRowObject);
        
        if (validationResult.success) {
          processedRows.push({
            originalRow: rawRow.originalRow,
            isValid: true,
            errors: [],
            data: validationResult.data,
            rawData: rawRow,
          });
        } else {
          const zodErrors = validationResult.error.errors.map(err => {
            const path = err.path.join('.');
            const displayLabel = schemaKeyToLabelMap.get(path) || path; // Get display label or fallback to path
            return `${displayLabel}: ${err.message}`;
          });
          
          console.error(`[ExcelUpload] Validation failed for row ${rawRow.originalRow}:`, {
            transformedData: transformedRowObject,
            errors: zodErrors,
            originalRawData: rawRow,
          });
          
          processedRows.push({
            originalRow: rawRow.originalRow,
            isValid: false,
            errors: zodErrors,
            data: transformedRowObject as z.infer<T>, // Cast to full schema type for consistency
            rawData: rawRow,
          });
        }
      }
      
      setParsedData(processedRows);
      
      if (processedRows.some(row => !row.isValid)) {
        showError('[ExcelUpload] Some rows contain invalid data. Please correct them before uploading.');
      } else if (processedRows.length > 0) {
        showSuccess(`[ExcelUpload] Processed ${processedRows.length} rows. Review the data below.`);
      } else {
        showError('[ExcelUpload] No valid data found in the Excel file after applying mappings.');
      }
    } catch (error: any) {
      console.error('[ExcelUpload] Error during data processing and validation:', error);
      showError(`[ExcelUpload] Error processing data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    const validParsedData = parsedData.filter(p => p.isValid);
    if (validParsedData.length === 0) {
      showError('[ExcelUpload] No valid data to upload.');
      return;
    }
    
    if (parsedData.some(row => !row.isValid)) {
      showError('[ExcelUpload] Cannot upload. Please correct all invalid rows first.');
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
      console.error('[ExcelUpload] Error uploading items:', error);
      showError(`[ExcelUpload] Failed to upload items: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    try {
      downloadExcelFile(sampleData, sampleFileName, 'Sample Data');
      showSuccess('[ExcelUpload] Sample Excel file downloaded successfully!');
    } catch (error: any) {
      console.error('[ExcelUpload] Error creating sample file:', error);
      showError(`[ExcelUpload] Failed to create sample file: ${error.message}`);
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
                          onValueChange={(value: string) => handleMappingChange(mapping.source, value)}
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
            <Button 
              onClick={applyMappingsAndValidate} 
              disabled={loading}
              className="w-full"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Apply Mappings & Validate'}
            </Button>
          </div>
        )}

        {parsedData.length > 0 && (
          <div className="space-y-4">
            <div className="rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
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
                  {parsedData.map((row, rowIndex) => (
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
                            {value !== undefined && value !== null && String(value).trim() !== '' 
                              ? String(value) 
                              : 'N/A'}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-yellow-600 dark:text-yellow-400 text-sm">
                        {row.isValid ? (
                          'None'
                        ) : (
                          row.errors.length > 0 
                            ? row.errors.join('; ') 
                            : 'Validation failed, but no specific errors reported.' // Fallback message
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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