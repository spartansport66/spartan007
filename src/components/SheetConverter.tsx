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
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/MultiSelect'; // Assuming MultiSelect is available

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

  // New states for split column functionality
  const [columnToSplitSourceHeader, setColumnToSplitSourceHeader] = useState<string>('');
  const [splitDelimiter, setSplitDelimiter] = useState<string>(',');
  const [splitTargetHeaders, setSplitTargetHeaders] = useState<string[]>([]); // Which required headers to populate from the split column
  const [splitPartMapping, setSplitPartMapping] = useState<{ [key: string]: string }>({}); // Maps requiredHeader to split part index (e.g., "Dealer Name": "0")

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
      setColumnToSplitSourceHeader('');
      setSplitDelimiter(',');
      setSplitTargetHeaders([]);
      setSplitPartMapping({});
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
        
        const excelHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
        setHeaders(excelHeaders);
        
        const initialMappings: ColumnMapping[] = excelHeaders.map(header => ({
          source: header,
          target: ''
        }));
        setColumnMappings(initialMappings);
        
        const dataRows = jsonData.slice(1);
        const formattedData: any[] = dataRows.map((row: any, index: number) => {
          const rowData: any = {};
          excelHeaders.forEach((header, i) => {
            rowData[header] = row[i] !== undefined ? row[i] : '';
          });
          return {
            originalRow: index + 2,
            ...rowData
          };
        });
        
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
  };

  const handleSplitPartMappingChange = (requiredHeader: string, partIndex: string) => {
    setSplitPartMapping(prev => ({
      ...prev,
      [requiredHeader]: partIndex
    }));
  };

  const handleConvert = () => {
    if (parsedData.length === 0) {
      showError('No data to convert.');
      return;
    }
    
    try {
      const sourceToTargetMap: { [key: string]: string } = {};
      columnMappings.forEach(mapping => {
        if (mapping.target) {
          sourceToTargetMap[mapping.source] = mapping.target;
        }
      });
      
      const converted = parsedData.map(row => {
        const newRow: any = {};
        requiredHeaders.forEach(header => {
          newRow[header] = ''; // Initialize all required headers
        });
        
        // Apply one-to-one mappings first
        Object.keys(row).forEach(sourceHeader => {
          const targetHeader = sourceToTargetMap[sourceHeader];
          if (targetHeader) {
            newRow[targetHeader] = row[sourceHeader];
          }
        });

        // Apply split column logic, potentially overwriting one-to-one mappings
        if (columnToSplitSourceHeader && splitTargetHeaders.length > 0 && splitDelimiter) {
          const combinedValue = row[columnToSplitSourceHeader];
          if (combinedValue) {
            const parts = String(combinedValue).split(splitDelimiter).map(p => p.trim());
            
            splitTargetHeaders.forEach(targetHeader => {
              const partIndexStr = splitPartMapping[targetHeader];
              if (partIndexStr !== undefined) {
                const partIndex = parseInt(partIndexStr, 10);
                if (!isNaN(partIndex) && parts[partIndex] !== undefined) {
                  newRow[targetHeader] = parts[partIndex];
                }
              }
            });
          }
        }
        
        return newRow;
      });
      
      setConvertedData(converted);
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

  // Memoized preview of split data for the first row
  const splitPreview = useMemo(() => {
    if (!columnToSplitSourceHeader || !splitDelimiter || parsedData.length === 0) {
      return null;
    }
    const firstRowValue = parsedData[0][columnToSplitSourceHeader];
    if (!firstRowValue) return null;

    const parts = String(firstRowValue).split(splitDelimiter).map(p => p.trim());
    return (
      <div className="mt-4 p-3 bg-muted rounded-md text-sm">
        <p className="font-semibold mb-2">Preview of first row split:</p>
        {parts.map((part, index) => (
          <p key={index}>
            Part {index + 1}: <span className="font-mono text-primary">{part}</span>
          </p>
        ))}
      </div>
    );
  }, [columnToSplitSourceHeader, splitDelimiter, parsedData]);

  const requiredHeaderOptions = requiredHeaders.map(header => ({
    label: header,
    value: header,
  }));

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
            <h3 className="text-lg font-semibold">Map Columns (One-to-One)</h3>
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
                        <Select value={mapping.target} onValueChange={(value) => handleMappingChange(index, value)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select required column" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Do not map</SelectItem>
                            {requiredHeaders.map((header) => (
                              <SelectItem key={header} value={header}>{header}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {headers.length > 0 && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <h3 className="text-lg font-semibold">Split Column Configuration (One-to-Many)</h3>
            <p className="text-sm text-muted-foreground">
              If one of your columns contains multiple pieces of information (e.g., "Name, Address, City"),
              configure how to split it here. This will override any one-to-one mapping for the target headers.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="columnToSplit">Select Column to Split</Label>
                <Select 
                  value={columnToSplitSourceHeader} 
                  onValueChange={setColumnToSplitSourceHeader}
                >
                  <SelectTrigger id="columnToSplit" className="w-full">
                    <SelectValue placeholder="Select your column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Do not split any column</SelectItem>
                    {headers.map((header) => (
                      <SelectItem key={header} value={header}>{header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="splitDelimiter">Delimiter</Label>
                <Input
                  id="splitDelimiter"
                  placeholder="e.g., ,"
                  value={splitDelimiter}
                  onChange={(e) => setSplitDelimiter(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {splitPreview}

            {columnToSplitSourceHeader && splitDelimiter && parsedData.length > 0 && (
              <div className="space-y-2 mt-4">
                <Label>Map Split Parts to Required Columns</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Assign each part of the split string to its corresponding required column.
                </p>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Required Column</TableHead>
                        <TableHead>Split Part Index (0-based)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requiredHeaders.map((header) => (
                        <TableRow key={`split-map-${header}`}>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell>
                            <Select 
                              value={splitPartMapping[header] || ''} 
                              onValueChange={(value) => handleSplitPartMappingChange(header, value)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select part index" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Do not map</SelectItem>
                                {Array.from({ length: 10 }, (_, i) => i.toString()).map(index => ( // Max 10 parts for now
                                  <SelectItem key={index} value={index}>{`Part ${parseInt(index) + 1} (Index ${index})`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {headers.length > 0 && (
          <Button onClick={handleConvert} className="w-full">
            Convert Data
          </Button>
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