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
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ColumnMapping {
  source: string; // Original Excel header
  targetKey: keyof z.infer<typeof itemSchema> | ''; // Mapped schema key, or empty string if not mapped
}

interface ParsedRow {
  originalRow: number;
  isValid: boolean;
  errors: string[];
  data: z.infer<typeof itemSchema>;
  rawData: { [key: string]: any }; // The raw object from the Excel row (original keys)
}

interface ItemExcelUploadProps {
  onUploadComplete: () => void;
}

// Zod schema for item validation - UPDATED with new fields
const itemSchema = z.object({
  code: z.string().min(1, { message: 'Product Code is required.' }),
  name: z.string().min(1, { message: 'Product Name is required.' }),
  description: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  hsn: z.string().nullable().optional(),
  // Use z.coerce.number for robust handling of string inputs that should be numbers
  // .default(0) ensures it's 0 if not provided or invalid, and .optional().nullable() allows it to be absent
  gst: z.coerce.number().min(0, { message: 'GST cannot be negative.' }).max(100, { message: 'GST cannot exceed 100.' }).default(0).optional().nullable(),
  dp: z.coerce.number().min(0.01, { message: 'Dealer Price must be a positive number.' }),
  mrp: z.coerce.number().min(0.01, { message: 'MRP must be a positive number.' }),
  stock: z.coerce.number().int().min(0, { message: 'Stock cannot be negative.' }),
});

// Define the required schema fields with their display labels - UPDATED
const requiredSchemaFields = [
  { key: 'code', label: 'Product Code' },
  { key: 'name', label: 'Product Name' },
  { key: 'description', label: 'Description' },
  { key: 'size', label: 'Size' },
  { key: 'hsn', label: 'HSN' },
  { key: 'gst', label: 'GST (%)' },
  { key: 'dp', label: 'Dealer Price (DP)' },
  { key: 'mrp', label: 'MRP' },
  { key: 'stock', label: 'Stock' },
];

const ItemExcelUpload: React.FC<ItemExcelUploadProps> = ({ onUploadComplete }) => {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
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
        
        const detectedHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
        setExcelHeaders(detectedHeaders);

        // Initialize column mappings with detected headers and empty target keys
        const initialMappings: ColumnMapping[] = detectedHeaders.map(header => ({
          source: header,
          targetKey: '',
        }));
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

  const handleMappingChange = (sourceHeader: string, targetKey: keyof z.infer<typeof itemSchema> | '') => {
    setColumnMappings(prevMappings =>
      prevMappings.map(mapping =>
        mapping.source === sourceHeader ? { ...mapping, targetKey: targetKey } : mapping
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
    return requiredSchemaFields.map(field => ({
      value: field.key,
      label: field.label,
    }));
  }, []);

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
        const processedRows: ParsedRow[] = [];

        for (let i = startRowIndex; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }

          const rawRowObject: { [key: string]: any } = {};
          excelHeaders.forEach((header, index) => {
            rawRowObject[header] = row[index];
          });

          const transformedRowObject: Partial<z.infer<typeof itemSchema>> = {};
          const errors: string[] = [];

          // Apply mappings to transform raw data into schema-compatible object
          columnMappings.forEach(mapping => {
            if (mapping.targetKey) {
              const rawValue = rawRowObject[mapping.source];
              // Use z.coerce.number for numeric fields, otherwise use rawValue or null
              if (mapping.targetKey === 'mrp' || mapping.targetKey === 'dp' || mapping.targetKey === 'gst' || mapping.targetKey === 'stock') {
                // z.coerce.number handles parsing, so just assign rawValue
                transformedRowObject[mapping.targetKey] = rawValue;
              } else {
                transformedRowObject[mapping.targetKey] = (rawValue !== undefined && rawValue !== null) ? String(rawValue).trim() : null;
              }
            }
          });

          const validationResult = itemSchema.safeParse(transformedRowObject);
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
              data: transformedRowObject as z.infer<typeof itemSchema>,
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
    if (!user) {
      showError('You must be logged in to add items.');
      return;
    }

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
      const itemsToInsert = validParsedData.map((row: ParsedRow) => ({
        user_id: user.id,
        code: row.data.code,
        name: row.data.name,
        description: row.data.description,
        size: row.data.size,
        hsn: row.data.hsn,
        gst: row.data.gst,
        dp: row.data.dp,
        mrp: row.data.mrp,
        stock: row.data.stock,
      }));

      const { data: insertedItems, error: insertError } = await supabase
        .from('products')
        .insert(itemsToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      showSuccess(`Successfully uploaded ${insertedItems.length} items!`);
      setParsedData([]);
      setFile(null);
      setExcelHeaders([]);
      setColumnMappings([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadComplete();
    } catch (error: any) {
      console.error('Error uploading items:', error);
      showError(`Failed to upload items: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    try {
      const sampleData = [
        {
          "Product Code": 'P001',
          "Product Name": 'Laptop Pro X',
          "Description": 'High-performance laptop for professionals.',
          "Size": '15 inch',
          "HSN": '8471',
          "GST (%)": 18,
          "Dealer Price (DP)": 1000.00,
          "MRP": 1200.00,
          "Stock": 50
        },
        {
          "Product Code": 'P002',
          "Product Name": 'Wireless Mouse',
          "Description": 'Ergonomic wireless mouse.',
          "Size": 'Small',
          "HSN": '8471',
          "GST (%)": 18,
          "Dealer Price (DP)": 15.00,
          "MRP": 20.00,
          "Stock": 200
        }
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sample Data'); // Corrected line
      XLSX.writeFile(wb, 'sample_items.xlsx');
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
          Bulk Upload Items
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
              Match your Excel file's columns to the required fields for product data.
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
                          value={mapping.targetKey}
                          onValueChange={(value: keyof z.infer<typeof itemSchema> | '') =>
                            handleMappingChange(mapping.source, value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select required field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Do not map</SelectItem>
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
                    {requiredSchemaFields.map((field, index) => (
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
                      {requiredSchemaFields.map((field, colIndex) => {
                        const value = row.data[field.key];
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
                      <TableCell colSpan={requiredSchemaFields.length + 3} className="text-center">
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
                {loading ? 'Uploading...' : 'Upload Items'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ItemExcelUpload;