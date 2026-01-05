"use client";

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload as UploadIcon, Download } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

interface ExcelUploadProps {
  onUpload: (data: any[]) => Promise<void>;
  sampleData: any[];
  sampleFileName: string;
  uploadButtonText: string;
  tableHeaders: string[];
  requiredHeaders: string[];
}

const ExcelUpload: React.FC<ExcelUploadProps> = ({
  onUpload,
  sampleData,
  sampleFileName,
  uploadButtonText,
  tableHeaders,
  requiredHeaders
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
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
        
        // Assume first sheet is the one we want
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          showError('Excel file is empty or has no data rows.');
          setLoading(false);
          return;
        }

        // Check if all required headers are present
        const missingHeaders = requiredHeaders.filter(h => 
          !Object.keys(jsonData[0]).some(key => key.toLowerCase().includes(h.toLowerCase()))
        );
        
        if (missingHeaders.length > 0) {
          showError(`Missing required columns: ${missingHeaders.join(', ')}`);
          setLoading(false);
          return;
        }

        setParsedData(jsonData);
        showSuccess(`Parsed ${jsonData.length} rows from Excel file.`);
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
    if (parsedData.length === 0) {
      showError('No data to upload.');
      return;
    }

    setLoading(true);
    try {
      await onUpload(parsedData);
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
      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sample Data');
      
      // Export to file
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
                    {tableHeaders.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 5).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {tableHeaders.map((header, colIndex) => {
                        const key = Object.keys(row).find(k => 
                          k.toLowerCase().includes(header.toLowerCase())
                        ) || '';
                        return (
                          <TableCell key={colIndex}>
                            {row[key] !== undefined ? String(row[key]) : 'N/A'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {parsedData.length > 5 && (
                    <TableRow>
                      <TableCell colSpan={tableHeaders.length} className="text-center">
                        ... and {parsedData.length - 5} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Parsed {parsedData.length} rows
              </p>
              <Button 
                onClick={handleUpload} 
                disabled={loading}
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