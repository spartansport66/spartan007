"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DollarSign, Package, Users, Activity } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading } = useSession();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error logging out:', error.message);
    } else {
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );
  }

  if (!user) {
    navigate('/login');
    return null;
  }

  // Dummy data for the CRM dashboard
  const salesOverview = [
    { title: "Total Sales", value: "$45,231.89", change: "+20.1% from last month", icon: <DollarSign className="h-4 w-4 text-muted-foreground" /> },
    { title: "New Orders", value: "2350", change: "+180.1% from last month", icon: <Package className="h-4 w-4 text-muted-foreground" /> },
    { title: "Active Wholesalers", value: "124", change: "+19% from last month", icon: <Users className="h-4 w-4 text-muted-foreground" /> },
    { title: "Pending Tasks", value: "57", change: "-5% from last month", icon: <Activity className="h-4 w-4 text-muted-foreground" /> },
  ];

  const recentActivities = [
    { id: "1", type: "Order", description: "New order from Wholesaler A", date: "2023-10-26", status: "Pending" },
    { id: "2", type: "Contact", description: "Follow-up with Wholesaler B", date: "2023-10-25", status: "Completed" },
    { id: "3", type: "Product", description: "Updated pricing for Product X", date: "2023-10-24", status: "Info" },
    { id: "4", type: "Order", description: "Order #1001 shipped to Wholesaler C", date: "2023-10-23", status: "Shipped" },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">CRM Dashboard</h1>
        <Button onClick={handleLogout} variant="destructive">
          Logout
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-xs text-muted-foreground">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>A list of recent interactions and updates.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.type}</TableCell>
                    <TableCell>{activity.description}</TableCell>
                    <TableCell>{activity.date}</TableCell>
                    <TableCell>{activity.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Perform common tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full py-3 text-lg">View Products</Button>
            <Button className="w-full py-3 text-lg">Manage Wholesalers</Button>
            <Button className="w-full py-3 text-lg">Sales Reports</Button>
            <Button className="w-full py-3 text-lg" variant="outline">Add New Order</Button>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Dashboard;