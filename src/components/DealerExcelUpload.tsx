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
  const [parsedExcelHeaders, setParsedExcelHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zod schema for dealer validation - reflecting database NOT NULL constraints
  // Fields that can be defaulted if missing from Excel are marked optional here.
  const dealerSchema = z.object({
    name: z.string().min(1, { message: 'Dealer name is required.' }),
    contactperson: z.string().nullable().optional(), // Now nullable and optional
    email: z.string().nullable().optional(), // Now nullable and optional, no .email() validation
    phone: z.string().nullable().optional(), // Now nullable and optional, no min/max length validation
    address: z.string().min(1, { message: 'Address is required.' }), // Relaxed from min(5) to min(1)
    city: z.string().nullable().optional(), // Now nullable and optional
    state: z.string().nullable().optional(), // Now nullable and optional
    country: z.string().nullable().optional(), // Now nullable and optional
    creditlimit: z.preprocess(
      (val) => Number(val),
      z.number().min(0, { message: 'Credit limit cannot be negative.' })
    ).nullable().optional(), // Now nullable and optional
    allottedcreditdays: z.preprocess(
      (val) => Number(val),
      z.number().int().min(0, { message: 'Allotted credit days cannot be negative.' })
    ).nullable().optional(), // Now nullable and optional
    openingbalance: z.preprocess(
      (val) => Number(val),
      z.number().min(0, { message: 'Opening balance cannot be negative.' })
    ).nullable().optional(), // Now nullable and optional
    salesperson: z.string().nullable().optional(), // Now nullable and optional
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData([]);
      setParsedExcelHeaders([]);
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
        if (jsonData.length < 2) { // At least header + one data row
          showError('Excel file is empty or has no data rows.');
          setLoading(false);
          return;
        }
        
        const excelHeaders = (jsonData[0] as string[]).map(h => String(h).trim());
        setParsedExcelHeaders(excelHeaders);
        
        // ONLY these headers are strictly required in the Excel file itself
        const strictlyRequiredExcelHeaders = ["Dealer Name", "Address"];
        const missingHeaders = strictlyRequiredExcelHeaders.filter(h => !excelHeaders.includes(h));
        if (missingHeaders.length > 0) {
          showError(`Missing strictly required columns in Excel: ${missingHeaders.join(', ')}`);
          setLoading(false);
          return;
        }

        const parsedRows: ParsedRow[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          if (!row || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }
          
          const rawRowObject: { [key: string]: any } = {};
          excelHeaders.forEach((header, index) => {
            rawRowObject[header] = row[index];
          });
          
          const transformedRowObject: { [key: string]: any } = {};
          
          // Map Excel headers to schema keys and apply initial transformations/defaults
          // For string fields, pass null if empty/whitespace. For numeric, default to 0 if empty/non-numeric.
          transformedRowObject.name = String(rawRowObject["Dealer Name"] || '').trim();
          transformedRowObject.contactperson = String(rawRowObject["Contact Person"] || '').trim() || null;
          transformedRowObject.email = String(rawRowObject["Email"] || '').trim() || null;
          transformedRowObject.phone = String(rawRowObject["Phone Number"] || '').trim() || null;
          transformedRowObject.address = String(rawRowObject["Address"] || '').trim();
          transformedRowObject.city = String(rawRowObject["City"] || '').trim() || null;
          transformedRowObject.state = String(rawRowObject["State"] || '').trim() || null;
          transformedRowObject.country = String(rawRowObject["Country"] || '').trim() || null;
          
          // Numeric fields with defaults
          transformedRowObject.creditlimit = parseFloat(rawRowObject["Credit Limit"]) || 0;
          transformedRowObject.allottedcreditdays = parseInt(rawRowObject["Allotted Credit Days"]) || 0;
          transformedRowObject.openingbalance = parseFloat(rawRowObject["Opening Balance"]) || 0;
          
          // Optional sales person field
          transformedRowObject.salesperson = String(rawRowObject["Sales Person"] || '').trim() || null;

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
            const zodErrors = validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            console.error(`Validation failed for row ${i + 1}:`, transformedRowObject, zodErrors); // ADDED LOG
            parsedRows.push({
              originalRow: i + 1,
              isValid: false,
              errors: zodErrors,
              data: transformedRowObject,
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
    
    let currentParsedData = [...parsedData];
    let hasErrors = false;

    // 1. Check for duplicates within the current upload batch
    const emailsInBatch = new Set<string>();
    const namesInBatch = new Set<string>();
    const duplicateEmailRows = new Set<number>();
    const duplicateNameRows = new Set<number>();

    currentParsedData.forEach((row, index) => {
      if (row.isValid) {
        const email = row.data.email;
        const name = row.data.name;

        // Only check for duplicates if a meaningful email is provided (not null or 'N/A')
        if (email && email !== 'N/A' && emailsInBatch.has(email)) {
          duplicateEmailRows.add(index);
        } else if (email && email !== 'N/A') {
          emailsInBatch.add(email);
        }

        // Only check for duplicates if a meaningful name is provided (not null or empty)
        if (name && namesInBatch.has(name)) {
          duplicateNameRows.add(index);
        } else if (name) {
          namesInBatch.add(name);
        }
      }
    });

    duplicateEmailRows.forEach(index => {
      currentParsedData[index].isValid = false;
      currentParsedData[index].errors.push('Duplicate email within this upload batch.');
      hasErrors = true;
    });
    duplicateNameRows.forEach(index => {
      currentParsedData[index].isValid = false;
      currentParsedData[index].errors.push('Duplicate dealer name within this upload batch.');
      hasErrors = true;
    });

    // 2. Check against existing dealers in the database
    if (!hasErrors) {
      setLoading(true);
      try {
        const { data: existingDealers, error: fetchExistingError } = await supabase
          .from('dealers')
          .select('name, email');

        if (fetchExistingError) {
          throw fetchExistingError;
        }

        const existingEmails = new Set(existingDealers.map(d => d.email).filter(e => e && e !== 'N/A'));
        const existingNames = new Set(existingDealers.map(d => d.name).filter(Boolean));

        currentParsedData.forEach((row, index) => {
          if (row.isValid) {
            const email = row.data.email;
            const name = row.data.name;

            if (email && email !== 'N/A' && existingEmails.has(email)) {
              currentParsedData[index].isValid = false;
              currentParsedData[index].errors.push('Email already exists in the database.');
              hasErrors = true;
            }
            if (name && existingNames.has(name)) {
              currentParsedData[index].isValid = false;
              currentParsedData[index].errors.push('Dealer name already exists in the database.');
              hasErrors = true;
            }
          }
        });
      } catch (error: any) {
        console.error('Error checking existing dealers:', error);
        showError(`Failed to check existing dealers: ${error.message}`);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }

    if (hasErrors) {
      setParsedData(currentParsedData);
      showError('Cannot upload. Please correct all invalid rows first.');
      return;
    }
    
    const validParsedData = currentParsedData.filter(p => p.isValid);
    if (validParsedData.length === 0) {
      showError('No valid data to upload after all checks.');
      return;
    }
    
    setLoading(true);
    try {
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
      
      const balancesToInsert = validParsedData.map((row: ParsedRow, index: number) => ({
        dealer_id: insertedDealers[index].id,
        opening_balance: row.data.openingbalance,
        closing_balance: row.data.openingbalance,
      }));
      
      const { error: balanceInsertError } = await supabase
        .from('dealer_balances')
        .insert(balancesToInsert);
      
      if (balanceInsertError) {
        throw balanceInsertError;
      }
      
      const assignmentsToInsert: { dealer_id: string; sales_person_id: string }[] = [];
      for (let i = 0; i < validParsedData.length; i++) {
        const row = validParsedData[i];
        const dealerId = insertedDealers[i].id;
        
        if (row.data.salesperson && row.data.salesperson !== 'N/A') { // Only try to assign if a salesperson name is provided
          const { data: salesPerson, error: salesPersonError } = await supabase
            .from('profiles')
            .select('id')
            .or(`first_name.ilike.%${row.data.salesperson}%,last_name.ilike.%${row.data.salesperson}%`)
            .eq('user_type', 'sales_person')
            .single();
          
          if (!salesPersonError && salesPerson) {
            assignmentsToInsert.push({
              dealer_id: dealerId,
              sales_person_id: salesPerson.id
            });
          } else {
            console.warn(`Sales person '${row.data.salesperson}' not found for dealer '${row.data.name}'. Skipping assignment.`);
          }
        }
      }
      
      if (assignmentsToInsert.length > 0) {
        const { error: assignmentError } = await supabase
          .from('dealer_sales_persons')
          .insert(assignmentsToInsert);
        
        if (assignmentError) {
          throw assignmentError;
        }
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
          "Opening Balance": 10000,
          "Sales Person": 'Sales Person Name'
        },
        {
          "Dealer Name": 'Regional Traders',
          "Contact Person": '', // Empty contact person
          "Email": '', // Empty email
          "Phone Number": '', // Empty phone number
          "Address": '456 Trade Ave',
          "City": '', // Empty city
          "State": '', // Empty state
          "Country": '', // Empty country
          "Credit Limit": 30000,
          "Allotted Credit Days": 45,
          "Opening Balance": 5000,
          "Sales Person": '' // Empty sales person
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
                    {parsedExcelHeaders.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
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
                      {parsedExcelHeaders.map((header, colIndex) => (
                        <TableCell key={colIndex}>
                          {row.rawData[header] !== undefined && row.rawData[header] !== null ? String(row.rawData[header]) : 'N/A'}
                        </TableCell>
                      ))}
                      <TableCell className="text-yellow-600 dark:text-yellow-400 text-sm">
                        {row.errors.length > 0 ? row.errors.join('; ') : 'None'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedData.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={parsedExcelHeaders.length + 3} className="text-center">
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