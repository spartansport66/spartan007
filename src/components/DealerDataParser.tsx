"use client";
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload as UploadIcon, Download } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';

interface ParsedDealer {
  name: string;
  city: string;
  address: string;
  phone: string;
}

const DealerDataParser: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedDealer[]>([]);
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
        
        // Read all data as array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 4) {
          showError('Excel file does not contain enough data rows.');
          setLoading(false);
          return;
        }

        const parsedDealers: ParsedDealer[] = [];
        let i = 0;
        
        // Process data in groups of 4 rows (dealer info + empty row)
        while (i < jsonData.length) {
          // Check if we have at least 3 rows for current dealer
          if (i + 2 >= jsonData.length) break;
          
          // Get the row with dealer name and city
          const nameRow = jsonData[i] as any[];
          // Get the row with address line 1
          const addressRow1 = jsonData[i + 1] as any[];
          // Get the row with address line 2
          const addressRow2 = jsonData[i + 2] as any[];
          
          // Skip if name row is empty
          if (!nameRow || nameRow.length === 0 || !nameRow[0]) {
            i += 4; // Move to next dealer group
            continue;
          }
          
          // Extract dealer name and city from first row
          const nameCell = String(nameRow[0] || '').trim();
          let dealerName = nameCell;
          let city = '';
          
          // Check if name contains city in parentheses
          const cityMatch = nameCell.match(/\(([^)]+)\)/);
          if (cityMatch) {
            dealerName = nameCell.replace(cityMatch[0], '').trim();
            city = cityMatch[1].trim();
          }
          
          // Extract address from rows 2 and 3
          const addressLine1 = String(addressRow1[0] || '').trim();
          const addressLine2 = String(addressRow2[0] || '').trim();
          const address = [addressLine1, addressLine2].filter(line => line).join(', ');
          
          // Extract phone number from column B of the first row
          const phone = String(nameRow[1] || '').trim();
          
          parsedDealers.push({
            name: dealerName,
            city: city,
            address: address,
            phone: phone
          });
          
          i += 4; // Move to next dealer group (4 rows per dealer)
        }
        
        setParsedData(parsedDealers);
        showSuccess(`Parsed ${parsedDealers.length} dealers successfully!`);
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

  const handleDownloadConverted = () => {
    if (parsedData.length === 0) {
      showError('No parsed data to download.');
      return;
    }
    
    try {
      // Convert to the required format
      const formattedData = parsedData.map(dealer => ({
        "Dealer Name": dealer.name,
        "Contact Person": "", // Will need to be filled manually
        "Email": "", // Will need to be filled manually
        "Phone Number": dealer.phone,
        "Address": dealer.address,
        "City": dealer.city,
        "State": "", // Will need to be filled manually
        "Country": "India", // Default to India
        "Credit Limit": 0, // Will need to be set manually
        "Allotted Credit Days": 0, // Will need to be set manually
        "Opening Balance": 0 // Will need to be set manually
      }));
      
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Parsed Dealers');
      XLSX.writeFile(wb, 'parsed_dealers.xlsx');
      showSuccess('Parsed dealers file downloaded successfully!');
    } catch (error: any) {
      console.error('Error creating parsed file:', error);
      showError(`Failed to create parsed file: ${error.message}`);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="h-5 w-5" />
          Dealer Data Parser
        </CardTitle>
        <CardDescription>
          Parse dealer data from the specific multi-row format
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="dealer-file">Excel File</Label>
            <Input 
              id="dealer-file" 
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
            {loading ? 'Parsing...' : 'Parse Dealer Data'}
          </Button>
          <Button 
            onClick={handleDownloadConverted} 
            disabled={parsedData.length === 0 || loading} 
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            Download Parsed Data
          </Button>
        </div>

        {parsedData.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Parsed Dealer Data</h3>
            <div className="rounded-md border max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Dealer Name</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((dealer, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{dealer.name}</TableCell>
                      <TableCell>{dealer.city}</TableCell>
                      <TableCell>{dealer.address}</TableCell>
                      <TableCell>{dealer.phone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DealerDataParser;