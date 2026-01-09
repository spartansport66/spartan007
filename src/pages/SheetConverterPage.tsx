"use client";
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { MadeWithDyad } from '@/components/made-with-dyad';
import SheetConverter from '@/components/SheetConverter';
import { useSession } from '@/contexts/SessionContext';

const SheetConverterPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useSession();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-6xl">
        <Button 
          variant="outline" 
          onClick={() => navigate(isAdmin ? '/admin-dashboard' : '/dashboard')} 
          className="mb-6 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="grid grid-cols-1 gap-6">
          <SheetConverter />
          
          <Card className="bg-card text-card-foreground shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-3">How to Use the Sheet Converter</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li>Upload your existing Excel file with dealer data</li>
                <li>Map your column names to the required format</li>
                <li>Click "Convert Data" to transform your data</li>
                <li>Download the converted file in the correct format</li>
                <li>Use the converted file for bulk uploading dealers</li>
              </ul>
              
              <h3 className="text-lg font-semibold mt-4 mb-3">Required Format</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm">
                <li><strong>Dealer Name</strong> - Name of the dealer</li>
                <li><strong>Contact Person</strong> - Primary contact person</li>
                <li><strong>Email</strong> - Valid email address</li>
                <li><strong>Phone Number</strong> - Contact phone number</li>
                <li><strong>Address</strong> - Full address</li>
                <li><strong>City</strong> - City name</li>
                <li><strong>State</strong> - State name</li>
                <li><strong>Country</strong> - Country name</li>
                <li><strong>Credit Limit</strong> - Credit limit amount</li>
                <li><strong>Allotted Credit Days</strong> - Number of credit days</li>
                <li><strong>Opening Balance</strong> - Opening balance amount</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SheetConverterPage;