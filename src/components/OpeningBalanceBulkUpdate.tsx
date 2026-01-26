"use client";
import React, { useState } from 'react';
import * as z from 'zod';
import { showError, showSuccess } from '@/utils/toast';
import ExcelUpload from '@/components/ExcelUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, FileUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const BULK_UPDATE_OPENING_BALANCE_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/bulk-update-opening-balance";

// Zod schema for dealer opening balance validation
const openingBalanceSchema = z.object({
  dealerName: z.string().min(1, { message: 'Dealer Name is required.' }).trim(),
  phoneNumber: z.coerce.string().nullable().optional().transform(val => val ? val.replace(/\D/g, '') : null), // Normalize phone
  openingBalance: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        if (trimmedVal === '') return undefined;
        const num = parseFloat(trimmedVal);
        return isNaN(num) ? trimmedVal : num;
      }
      return val;
    },
    z.coerce.number().min(0, { message: 'Opening balance cannot be negative.' }).default(0)
  ),
  lastBillingDate: z.coerce.string().nullable().optional().transform(val => {
    if (!val) return null;
    // Attempt to parse date string or number (Excel date serial)
    try {
      let date;
      if (typeof val === 'number') {
        // Excel date serial number (days since 1899-12-30)
        // Assuming 1900 system (1899-12-30 base)
        date = new Date(Date.UTC(0, 0, val - 1));
      } else {
        date = new Date(val);
      }
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD
    } catch {
      return null;
    }
  }),
});

// Define display headers for the ExcelUpload component
const openingBalanceDisplayHeaders = [
  { key: 'dealerName', label: 'Dealer Name' },
  { key: 'phoneNumber', label: 'Phone Number' },
  { key: 'openingBalance', label: 'Opening Balance' },
  { key: 'lastBillingDate', label: 'Last Billing Date' },
];

// Sample data for the ExcelUpload component
const openingBalanceSampleData = [
  {
    "Dealer Name": 'Global Distributors',
    "Phone Number": '1234567890',
    "Opening Balance": 15000.00,
    "Last Billing Date": '2023-12-31',
  },
  {
    "Dealer Name": 'Regional Traders',
    "Phone Number": '0987654321',
    "Opening Balance": 5000.00,
    "Last Billing Date": '2024-01-15',
  }
];

interface OpeningBalanceBulkUpdateProps {
  onUploadComplete: () => void;
}

const OpeningBalanceBulkUpdate: React.FC<OpeningBalanceBulkUpdateProps> = ({ onUploadComplete }) => {
  const handleUpload = async (updatesToUpload: z.infer<typeof openingBalanceSchema>[]) => {
    try {
      const payload = {
        updates: updatesToUpload.map(u => ({
          dealerName: u.dealerName,
          phoneNumber: u.phoneNumber,
          openingBalance: u.openingBalance,
          lastBillingDate: u.lastBillingDate,
        })),
      };

      const response = await fetch(BULK_UPDATE_OPENING_BALANCE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update opening balances');
      }

      const { successCount, notFound, errorCount } = data.results;

      if (notFound.length > 0) {
        const notFoundList = notFound.map((d: any) => 
          `Name: ${d.dealerName}, Phone: ${d.phoneNumber || 'N/A'}`
        ).join('; ');
        
        showError(`Update completed with warnings: ${successCount} successful, ${errorCount} errors. ${notFound.length} dealers not found.`);
      } else if (errorCount > 0) {
        showError(`Update completed with errors: ${successCount} successful, ${errorCount} errors.`);
      } else {
        showSuccess(`Successfully updated opening balances for ${successCount} dealers!`);
      }
      
      onUploadComplete();
      
      // Return the list of not found dealers for display
      return { results: data.results };

    } catch (error: any) {
      console.error('Error during bulk opening balance update:', error);
      showError(`Failed to update opening balances: ${error.message}`);
      return { results: { notFound: [] } };
    }
  };

  return (
    <ExcelUpload
      onUpload={handleUpload}
      sampleData={openingBalanceSampleData}
      sampleFileName="sample_opening_balances.xlsx"
      uploadButtonText="Update Opening Balances"
      displayHeaders={openingBalanceDisplayHeaders}
      validationSchema={openingBalanceSchema}
      // No excluded headers needed here
    >
      {({ uploadResults }) => {
        const notFoundDealers = uploadResults?.results?.notFound || [];
        if (notFoundDealers.length > 0) {
          return (
            <Card className="mt-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
              <CardHeader>
                <CardTitle className="text-lg text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" /> Dealers Not Found
                </CardTitle>
                <CardDescription className="text-yellow-700 dark:text-yellow-300">
                  The following {notFoundDealers.length} dealers could not be matched by Name and Phone Number in the database. Please ensure they are registered before attempting to update their balances.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dealer Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Opening Balance</TableHead>
                        <TableHead className="text-center">Last Billing Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {notFoundDealers.map((dealer: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{dealer.dealerName}</TableCell>
                          <TableCell>{dealer.phoneNumber || 'N/A'}</TableCell>
                          <TableCell className="text-right">₹{dealer.openingBalance.toFixed(2)}</TableCell>
                          <TableCell className="text-center">{dealer.lastBillingDate || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      }}
    </ExcelUpload>
  );
};

export default OpeningBalanceBulkUpdate;