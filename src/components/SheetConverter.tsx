"use client";
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload as UploadIcon, Download, CheckCircle, AlertTriangle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface ColumnMapping {
  source: string;
  target: string;
}

const SheetConverter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [convertedData, setConvertedData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Required format headers
  const requiredHeaders = [
    "Dealer Name",
    "Contact Person",
    "Email",
    "Phone Number",
    "Address",
    "City",
    "State",
    "Country",
    "Credit Limit",
    "Allotted Credit Days",
    "Opening Balance"
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData([]);
      setHeaders([]);
      setColumnMappings([]);
      setConvertedData([]);
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
        
        // Parse data as array of arrays to get headers and data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 1) {
          showError('Excel file is empty.');
          setLoading(false);
          return;
        }
        
        // Get headers from first row
        const excelHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
        console.log("[SheetConverter] Parsed Excel Headers:", excelHeaders); // DEBUG LOG
        setHeaders(excelHeaders);
        
        // Initialize column mappings with empty targets
        const initialMappings: ColumnMapping[] = excelHeaders.map(header => ({
          source: header,
          target: ''
        }));
        console.log("[SheetConverter] Initial Column Mappings:", initialMappings); // DEBUG LOG
        setColumnMappings(initialMappings);
        
        // Get data rows (skip header row)
        const dataRows = jsonData.slice(1);
        const formattedData: any[] = dataRows.map((row: any, index: number) => {
          const rowData: any = {};
          excelHeaders.forEach((header, i) => {
            rowData[header] = row[i] !== undefined ? row[i] : '';
          });
          return {
            originalRow: index + 2, // +2 because of 0-based index and header row
            ...rowData
          };
        });
        
        console.log("[SheetConverter] Raw Parsed Data (first 2 rows):", formattedData.slice(0, 2)); // DEBUG LOG
        setParsedData(formattedData);
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

  const handleMappingChange = (sourceIndex: number, targetValue: string) => {
    const updatedMappings = [...columnMappings];
    updatedMappings[sourceIndex].target = targetValue;
    setColumnMappings(updatedMappings);
    console.log("[SheetConverter] Mapping changed. New columnMappings:", updatedMappings); // DEBUG LOG
  };

  const handleConvert = () => {
    if (parsedData.length === 0) {
      showError('No data to convert.');
      return;
    }
    
    try {
      // Create mapping from source to target columns
      const sourceMapping: { [key: string]: string } = {};
      columnMappings.forEach(mapping => {
        if (mapping.target) {
          sourceMapping[mapping.source] = mapping.target;
        }
      });
      console.log("[SheetConverter] Source Mapping for Conversion:", sourceMapping); // DEBUG LOG
      
      // Convert data based on mappings
      const converted = parsedData.map(row => {
        const newRow: any = {};
        // Map required headers to empty values first
        requiredHeaders.forEach(header => {
          newRow[header] = '';
        });
        
        // Apply mappings
        Object.keys(row).forEach(key => {
          if (sourceMapping[key]) {
            newRow[sourceMapping[key]] = row[key];
          }
        });
        
        return newRow;
      });
      
      setConvertedData(converted);
      console.log("[SheetConverter] Converted Data (first 2 rows):", converted.slice(0, 2)); // DEBUG LOG
      showSuccess(`Converted ${converted.length} rows successfully!`);
    } catch (error: any) {
      console.error('Error converting data:', error);
      showError(`Error converting data: ${error.message}`);
    }
  };

  const handleDownloadConverted = () => {
    if (convertedData.length === 0) {
      showError('No converted data to download.');
      return;
    }
    
    try {
      const ws = XLSX.utils.json_to_sheet(convertedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Converted Data');
      XLSX.writeFile(wb, 'converted_dealers.xlsx');
      showSuccess('Converted Excel file downloaded successfully!');
    } catch (error: any) {
      console.error('Error creating converted file:', error);
      showError(`Failed to create converted file: ${error.message}`);
    }
  };

  const handleDownloadSample = () => {
    try {
      const sampleData = [
        {
          "Dealer Name": 'Global Distributors',
          "Contact Person": 'John Doe',
          "Email": 'john@gd.com',
          "Phone Number": '+1234567890',
          "Address": '123 Business St',
          "City": 'New York',
          "State": 'NY',
          "Country": 'USA',
          "Credit Limit": 50000,
          "Allotted Credit Days": 30,
          "Opening Balance": 10000
        },
        {
          "Dealer Name": 'Regional Traders',
          "Contact Person": 'Jane Smith',
          "Email": 'jane@rt.com',
          "Phone Number": '+1987654321',
          "Address": '456 Trade Ave',
          "City": 'Los Angeles',
          "State": 'CA',
          "Country": 'USA',
          "Credit Limit": 30000,
          "Allotted Credit Days": 45,
          "Opening Balance": 5000
        }
      ];
      
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');
      XLSX.writeFile(wb, 'sample_dealers_format.xlsx');
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
          Sheet Converter
        </CardTitle>
        <CardDescription>
          Convert your Excel sheet to the required dealer format
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {headers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Map Columns</h3>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Your Column</TableHead>
                    <TableHead>Required Column</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMappings.map((mapping, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{mapping.source}</TableCell>
                      <TableCell>
                        <select
                          value={mapping.target}
                          onChange={(e) => handleMappingChange(index, e.target.value)}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">Select required column</option>
                          {requiredHeaders.map((header) => (
                            <option key={header} value={header}>{header}</option>
                          ))}
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleConvert} className="w-full">
              Convert Data
            </Button>
          </div>
        )}

        {parsedData.length > 0 && headers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Preview Original Data</h3>
            <div className="rounded-md border max-h-60 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Row</TableHead>
                    {headers.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      <TableCell className="font-medium">{row.originalRow}</TableCell>
                      {headers.map((header, colIndex) => (
                        <TableCell key={colIndex}>{String(row[header] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {parsedData.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={headers.length + 1} className="text-center">
                        ... and {parsedData.length - 5} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {convertedData.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Converted Data</h3>
              <Button 
                onClick={handleDownloadConverted} 
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Converted File
              </Button>
            </div>
            <div className="rounded-md border max-h-60 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    {requiredHeaders.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {convertedData.slice(0, 5).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {requiredHeaders.map((header, colIndex) => (
                        <TableCell key={colIndex}>{String(row[header] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {convertedData.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={requiredHeaders.length} className="text-center">
                        ... and {convertedData.length - 5} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SheetConverter;