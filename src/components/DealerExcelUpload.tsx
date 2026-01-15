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
import { useSession } from '@/contexts/SessionContext'; // Corrected import path
import ExcelUpload from '@/components/ExcelUpload'; // Import the generic ExcelUpload component

interface DealerExcelUploadProps {
  onUploadComplete: () => void;
}

// Zod schema for dealer validation
export const dealerSchema = z.object({
  name: z.string().min(1, { message: 'Dealer Name is required.' }).trim(), // Added .trim()
  contactperson: z.string().nullable().optional().transform(val => val ? val.trim() : null), // Added .trim()
  email: z.string().email({ message: 'Invalid email format.' }).or(z.literal('')).nullable().optional().transform(val => val ? val.trim() : null), // Added .trim()
  phone: z.coerce.string().nullable().optional().transform(val => val ? val.replace(/\D/g, '') : null), // Normalize phone number
  address: z.string().min(1, { message: 'Address is required.' }).trim(), // Added .trim()
  city: z.string().nullable().optional().transform(val => val ? val.trim() : null), // Added .trim()
  state: z.string().nullable().optional().transform(val => val ? val.trim() : null), // Added .trim()
  country: z.string().nullable().optional().transform(val => val ? val.trim() : null), // Added .trim()
  creditlimit: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        if (trimmedVal === '') return undefined;
        const num = parseFloat(trimmedVal);
        return isNaN(num) ? trimmedVal : num;
      }
      return val;
    },
    z.coerce.number().min(0, { message: 'Credit limit cannot be negative.' }).default(0)
  ),
  allottedcreditdays: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        if (trimmedVal === '') return undefined;
        const num = parseFloat(trimmedVal);
        return isNaN(num) ? trimmedVal : num;
      }
      return val;
    },
    z.coerce.number().int().min(0, { message: 'Allotted credit days cannot be negative.' }).default(0)
  ),
  openingbalance: z.preprocess(
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
  salesperson: z.string().nullable().optional().transform(val => val ? val.trim() : null), // Added .trim()
});

// Define display headers for the ExcelUpload component
const dealerDisplayHeaders = [
  { key: 'name', label: 'Dealer Name' },
  { key: 'contactperson', label: 'Contact Person' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'creditlimit', label: 'Credit Limit' },
  { key: 'allottedcreditdays', label: 'Allotted Credit Days' },
  { key: 'openingbalance', label: 'Opening Balance' },
  { key: 'salesperson', label: 'Sales Person' },
];

// Sample data for the ExcelUpload component
const dealerSampleData = [
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

const DealerExcelUpload: React.FC<DealerExcelUploadProps> = ({ onUploadComplete }) => {
  const { user } = useSession();
  const [loadingUpload, setLoadingUpload] = useState(false); // Internal loading state for this component's upload action

  const handleUpload = async (dealersToUpload: z.infer<typeof dealerSchema>[]) => {
    if (!user) {
      showError('You must be logged in to add dealers.');
      return;
    }
    
    setLoadingUpload(true);
    try {
      // Filter out duplicate dealers based on name and phone before upserting
      const uniqueDealersToUploadMap = new Map<string, z.infer<typeof dealerSchema>>();
      dealersToUpload.forEach(dealer => {
        const key = `${dealer.name.toLowerCase()}-${(dealer.phone || '').toLowerCase()}`;
        if (!uniqueDealersToUploadMap.has(key)) {
          uniqueDealersToUploadMap.set(key, dealer);
        }
      });
      const filteredDealersToUpload = Array.from(uniqueDealersToUploadMap.values());

      const dealersToUpsert = filteredDealersToUpload.map((row) => ({
        user_id: user.id,
        name: row.name,
        contact_person: row.contactperson || null, // Convert empty string to null
        email: row.email || null, // Convert empty string to null
        phone: row.phone || null, // Convert empty string to null
        address: row.address,
        city: row.city || null, // Convert empty string to null
        state: row.state || null, // Convert empty string to null
        country: row.country || null, // Convert empty string to null
        credit_limit: row.creditlimit,
        allotted_credit_days: row.allottedcreditdays,
      }));
      
      // Use upsert with onConflict on 'name, phone'
      const { data: upsertedDealers, error: upsertError } = await supabase
        .from('dealers')
        .upsert(dealersToUpsert, { onConflict: 'name, phone' }) // Use name and phone as conflict target
        .select();
      
      if (upsertError) {
        throw upsertError;
      }
      
      // For each upserted dealer, update or insert their balance and assignments
      const balancesToUpsert = upsertedDealers.map((dealer, index) => ({
        dealer_id: dealer.id,
        opening_balance: filteredDealersToUpload[index].openingbalance || 0,
        closing_balance: filteredDealersToUpload[index].openingbalance || 0,
      }));
      
      const { error: balanceUpsertError } = await supabase
        .from('dealer_balances')
        .upsert(balancesToUpsert, { onConflict: 'dealer_id' }); // Upsert on dealer_id for balances
      
      if (balanceUpsertError) {
        throw balanceUpsertError;
      }
      
      const assignmentsToInsert: { dealer_id: string; sales_person_id: string }[] = [];
      for (let i = 0; i < filteredDealersToUpload.length; i++) {
        const row = filteredDealersToUpload[i];
        const dealerId = upsertedDealers[i].id; // Use the ID from the upserted dealer
        
        if (row.salesperson) {
          const { data: salesPerson, error: salesPersonError } = await supabase
            .from('profiles')
            .select('id')
            .or(`first_name.ilike.%${row.salesperson}%,last_name.ilike.%${row.salesperson}%`)
            .eq('user_type', 'sales_person')
            .single();
          
          if (!salesPersonError && salesPerson) {
            assignmentsToInsert.push({
              dealer_id: dealerId,
              sales_person_id: salesPerson.id
            });
          } else {
            console.warn(`[DealerExcelUpload] Sales person '${row.salesperson}' not found for dealer '${row.name}'. Skipping assignment.`);
          }
        }
      }
      
      if (assignmentsToInsert.length > 0) {
        // For assignments, we need to handle existing assignments carefully.
        // A simple insert might cause duplicates if a dealer is already assigned to a sales person.
        // A more robust solution would be to fetch existing assignments and then determine what to insert/delete.
        const { error: assignmentError } = await supabase
          .from('dealer_sales_persons')
          .insert(assignmentsToInsert);
        
        if (assignmentError) {
          // If the error is a duplicate key violation, we can log a warning and continue.
          // Otherwise, re-throw the error.
          if (assignmentError.code === '23505') { // PostgreSQL unique_violation error code
            console.warn(`[DealerExcelUpload] Duplicate sales person assignment detected and skipped: ${assignmentError.message}`);
          } else {
            throw assignmentError;
          }
        }
      }
      
      showSuccess(`Successfully uploaded ${upsertedDealers.length} dealers!`);
      onUploadComplete();
    } catch (error: any) {
      console.error('Error uploading dealers:', error);
      showError(`Failed to upload dealers: ${error.message}`);
    } finally {
      setLoadingUpload(false);
    }
  };

  return (
    <ExcelUpload
      onUpload={handleUpload}
      sampleData={dealerSampleData}
      sampleFileName="sample_dealers.xlsx"
      uploadButtonText="Upload Dealers"
      displayHeaders={dealerDisplayHeaders}
      validationSchema={dealerSchema}
      // No excluded headers for dealers, as all are relevant
    />
  );
};

export default DealerExcelUpload;