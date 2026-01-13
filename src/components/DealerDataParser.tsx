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
  salesPerson?: string;
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
        if (jsonData.length < 1) {
          showError('Excel file is empty.');
          setLoading(false);
          return;
        }
        
        const parsedDealers: ParsedDealer[] = [];
        
        // Process each row to extract dealer information
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          // Skip empty rows
          if (!row || row.length === 0 || !row[0]) {
            continue;
          }
          
          // Check if this looks like a dealer name row (has content in first column)
          const firstCell = String(row[0] || '').trim();
          
          // Skip rows that look like address lines (no city in parentheses)
          if (!firstCell.includes('(') && !firstCell.includes(')')) {
            continue;
          }
          
          // Extract dealer name and city from first column
          let dealerName = firstCell;
          let city = '';
          
          // Extract city from parentheses
          const cityMatch = firstCell.match(/\(([^)]+)\)/);
          if (cityMatch) {
            dealerName = firstCell.replace(cityMatch[0], '').trim(); // This line removes the (City) part
            city = cityMatch[1].trim();
          }
          
          // Get address from next row if it exists
          let address = '';
          if (i + 1 < jsonData.length) {
            const nextRow = jsonData[i + 1] as any[];
            if (nextRow && nextRow[0]) {
              address = String(nextRow[0] || '').trim();
              
              // Add second address line if it exists
              if (i + 2 < jsonData.length) {
                const thirdRow = jsonData[i + 2] as any[];
                if (thirdRow && thirdRow[0]) {
                  const secondAddressLine = String(thirdRow[0] || '').trim();
                  if (secondAddressLine) {
                    address += ', ' + secondAddressLine;
                  }
                }
              }
            }
          }
          
          // Extract phone number from column B if it exists
          const phone = row[1] ? String(row[1]).trim() : '';
          
          // Extract sales person from column C if it exists
          const salesPerson = row[2] ? String(row[2]).trim() : '';
          
          parsedDealers.push({
            name: dealerName,
            city: city,
            address: address,
            phone: phone,
            salesPerson: salesPerson
          });
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
      // Convert to the required format with defaults
      const formattedData = parsedData.map(dealer => ({
        "Dealer Name": dealer.name,
        "Contact Person": "N/A", // Default value
        "Email": "N/A", // Default value
        "Phone Number": dealer.phone || "N/A",
        "Address": dealer.address,
        "City": dealer.city || "N/A",
        "State": "N/A", // Default value
        "Country": "India", // Default value
        "Credit Limit": 0, // Default value
        "Allotted Credit Days": 0, // Default value
        "Opening Balance": 0, // Default value
        "Sales Person": dealer.salesPerson || "" // Include sales person if available
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
          Automatically parse dealer data from your specific format
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
                    <TableHead>Sales Person</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((dealer, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{dealer.name}</TableCell>
                      <TableCell>{dealer.city || 'N/A'}</TableCell>
                      <TableCell>{dealer.address}</TableCell>
                      <TableCell>{dealer.phone || 'N/A'}</TableCell>
                      <TableCell>{dealer.salesPerson || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Next Steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <li>Download the parsed data using the "Download Parsed Data" button</li>
                <li>Open the downloaded Excel file</li>
                <li>Fill in missing information (Contact Person, Email, State, Credit Limit, etc.)</li>
                <li>Save the file and use it for bulk dealer upload</li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DealerDataParser;