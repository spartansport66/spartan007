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
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

interface ParsedRow {
  originalRow: number;
  isValid: boolean;
  errors: string[];
  data: any;
  rawData: any;
}

interface DealerExcelUploadProps {
  onUploadComplete: () => void;
}

const DealerExcelUpload: React.FC<DealerExcelUploadProps> = ({ onUploadComplete }) => {
  const { user } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zod schema for dealer validation
  const dealerSchema = z.object({
    name: z.string().min(1, { message: 'Dealer name is required.' }),
    contactperson: z.string().min(1, { message: 'Contact person is required.' }),
    email: z.string().email({ message: 'Valid email is required.' }),
    phone: z.string().min(10, { message: 'Phone must be at least 10 digits.' }).max(15, { message: 'Phone cannot exceed 15 digits.' }),
    address: z.string().min(5, { message: 'Address is required.' }),
    city: z.string().min(1, { message: 'City is required.' }),
    state: z.string().min(1, { message: 'State is required.' }),
    country: z.string().min(1, { message: 'Country is required.' }),
    creditlimit: z.preprocess(
      (val) => Number(val),
      z.number().min(0, { message: 'Credit limit cannot be negative.' })
    ),
    allottedcreditdays: z.preprocess(
      (val) => Number(val),
      z.number().int().min(0, { message: 'Allotted credit days cannot be negative.' })
    ),
    openingbalance: z.preprocess(
      (val) => Number(val),
      z.number().min(0, { message: 'Opening balance cannot be negative.' })
    ),
  });

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
        
        // Parse data as array of arrays to get headers and data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          // At least header + one data row
          showError('Excel file is empty or has no data rows.');
          setLoading(false);
          return;
        }
        
        // Get headers from first row
        const excelHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
        
        // Check if all required headers are present in the Excel file
        const requiredHeaders = [
          "Dealer Name", "Contact Person", "Email", "Phone Number", 
          "Address", "City", "State", "Country", "Credit Limit", 
          "Allotted Credit Days", "Opening Balance"
        ];
        
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
          
          // Transform row object to match schema keys
          const transformedRowObject: { [key: string]: any } = {};
          for (const header of excelHeaders) {
            const schemaKey = header.toLowerCase().replace(/ /g, '');
            const rawValue = rawRowObject[header];
            
            // Special handling for numbers to ensure they are parsed correctly before Zod
            if (schemaKey === 'creditlimit' || schemaKey === 'openingbalance') {
              transformedRowObject[schemaKey] = parseFloat(rawValue);
            } else if (schemaKey === 'allottedcreditdays') {
              transformedRowObject[schemaKey] = parseInt(rawValue);
            } else {
              transformedRowObject[schemaKey] = rawValue;
            }
          }
          
          const validationResult = dealerSchema.safeParse(transformedRowObject);
          
          if (validationResult.success) {
            parsedRows.push({
              originalRow: i + 1,
              isValid: true,
              errors: [],
              data: validationResult.data,
              rawData: rawRowObject,
            });
          } else {
            const errors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
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
    if (!user) {
      showError('You must be logged in to add dealers.');
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
      // Transform data to match dealer schema
      const dealersToInsert = validParsedData.map((row: ParsedRow) => ({
        user_id: user.id,
        name: row.data.name,
        contact_person: row.data.contactperson,
        email: row.data.email,
        phone: row.data.phone,
        address: row.data.address,
        city: row.data.city,
        state: row.data.state,
        country: row.data.country,
        credit_limit: row.data.creditlimit,
        allotted_credit_days: row.data.allottedcreditdays,
      }));
      
      const { data: insertedDealers, error: insertError } = await supabase
        .from('dealers')
        .insert(dealersToInsert)
        .select();
      
      if (insertError) {
        throw insertError;
      }
      
      // Handle opening balances
      const balancesToInsert = validParsedData.map((row: ParsedRow, index: number) => ({
        dealer_id: insertedDealers[index].id,
        opening_balance: row.data.openingbalance,
        closing_balance: row.data.openingbalance, // Initially same as opening
      }));
      
      const { error: balanceInsertError } = await supabase
        .from('dealer_balances')
        .insert(balancesToInsert);
      
      if (balanceInsertError) {
        throw balanceInsertError;
      }
      
      showSuccess(`Successfully uploaded ${insertedDealers.length} dealers!`);
      setParsedData([]);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadComplete();
    } catch (error: any) {
      console.error('Error uploading dealers:', error);
      showError(`Failed to upload dealers: ${error.message}`);
    } finally {
      setLoading(false);
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
      XLSX.writeFile(wb, 'sample_dealers.xlsx');
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
          Bulk Upload Dealers
        </CardTitle>
        <CardDescription>
          Upload an Excel sheet to add multiple dealers at once
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
                    <TableHead>Dealer Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Credit Limit</TableHead>
                    <TableHead>Allotted Credit Days</TableHead>
                    <TableHead>Opening Balance</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((row, rowIndex) => ( // Show first 10 rows
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
                      <TableCell>{row.rawData["Dealer Name"] !== undefined ? String(row.rawData["Dealer Name"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Contact Person"] !== undefined ? String(row.rawData["Contact Person"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Email"] !== undefined ? String(row.rawData["Email"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Phone Number"] !== undefined ? String(row.rawData["Phone Number"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Address"] !== undefined ? String(row.rawData["Address"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["City"] !== undefined ? String(row.rawData["City"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["State"] !== undefined ? String(row.rawData["State"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Country"] !== undefined ? String(row.rawData["Country"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Credit Limit"] !== undefined ? String(row.rawData["Credit Limit"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Allotted Credit Days"] !== undefined ? String(row.rawData["Allotted Credit Days"]) : 'N/A'}</TableCell>
                      <TableCell>{row.rawData["Opening Balance"] !== undefined ? String(row.rawData["Opening Balance"]) : 'N/A'}</TableCell>
                      <TableCell className="text-yellow-600 dark:text-yellow-400 text-sm">
                        {row.errors.length > 0 ? row.errors.join('; ') : 'None'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedData.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center">
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
                {loading ? 'Uploading...' : 'Upload Dealers'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DealerExcelUpload;