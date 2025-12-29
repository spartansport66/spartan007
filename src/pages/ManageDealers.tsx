"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Edit, Trash2, Eye } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

interface Dealer {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
}

const dummyDealers: Dealer[] = [
  {
    id: 'dlr1',
    name: 'Global Distributors Inc.',
    contactPerson: 'Alice Smith',
    email: 'alice.s@globaldist.com',
    phone: '+1-555-123-4567',
    address: '101 Global Ave, Metropolis, USA',
  },
  {
    id: 'dlr2',
    name: 'Local Supply Co.',
    contactPerson: 'Bob Johnson',
    email: 'bob.j@localsupply.com',
    phone: '+1-555-987-6543',
    address: '202 Local St, Smallville, USA',
  },
  {
    id: 'dlr3',
    name: 'Mega Mart Wholesale',
    contactPerson: 'Charlie Brown',
    email: 'charlie.b@megamart.com',
    phone: '+1-555-111-2222',
    address: '303 Mega Blvd, Big City, USA',
  },
];

const ManageDealers = () => {
  const navigate = useNavigate();

  const handleView = (dealerId: string) => {
    showSuccess(`Viewing dealer ${dealerId}`);
    // In a real app, navigate to a dealer detail page
    console.log('View dealer:', dealerId);
  };

  const handleEdit = (dealerId: string) => {
    showSuccess(`Editing dealer ${dealerId}`);
    // In a real app, navigate to an edit dealer page or open a modal
    console.log('Edit dealer:', dealerId);
  };

  const handleDelete = (dealerId: string) => {
    if (window.confirm(`Are you sure you want to delete dealer ${dealerId}?`)) {
      showSuccess(`Dealer ${dealerId} deleted.`);
      // In a real app, send delete request to backend and update state
      console.log('Delete dealer:', dealerId);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Manage Dealers</CardTitle>
            <CardDescription className="text-muted-foreground">View, edit, or delete your registered dealers.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted/90">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Contact Person</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dummyDealers.map((dealer) => (
                    <TableRow key={dealer.id} className="hover:bg-accent/50">
                      <TableCell className="font-medium text-foreground">{dealer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.contactPerson}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.email}</TableCell>
                      <TableCell className="text-muted-foreground">{dealer.phone}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleView(dealer.id)} title="View Dealer">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(dealer.id)} title="Edit Dealer">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(dealer.id)} title="Delete Dealer">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-6 text-right">
              <Button onClick={() => navigate('/add-dealer')} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Add New Dealer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default ManageDealers;