"use client";
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, ShoppingCart, Package, Users, Factory, FileText, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SupplierManager from '../components/purchasing/SupplierManager';
import RawMaterialManager from '../components/purchasing/RawMaterialManager';
import PurchaseOrderManager from '../components/purchasing/PurchaseOrderManager';
import BillOfMaterialsManager from '../components/purchasing/BillOfMaterialsManager';
import PurchaseVoucherManager from '../components/purchasing/PurchaseVoucherManager';
import SupplierLedgerReport from '../components/purchasing/SupplierLedgerReport'; // New Import

const PurchaseDashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-3">
          <ShoppingCart className="h-8 w-8" />
          Purchasing & Manufacturing
        </h1>
        <div className="w-fit"></div> {/* Spacer */}
      </div>

      <Tabs defaultValue="suppliers" className="flex-grow flex flex-col">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="suppliers"><Users className="h-4 w-4 mr-2" />Suppliers</TabsTrigger>
          <TabsTrigger value="raw_materials"><Package className="h-4 w-4 mr-2" />Raw Materials</TabsTrigger>
          <TabsTrigger value="purchase_orders"><ShoppingCart className="h-4 w-4 mr-2" />Purchase Orders</TabsTrigger>
          <TabsTrigger value="purchase_vouchers"><FileText className="h-4 w-4 mr-2" />Purchase Vouchers</TabsTrigger>
          <TabsTrigger value="supplier_ledger"><BookOpen className="h-4 w-4 mr-2" />Supplier Ledger</TabsTrigger>
          <TabsTrigger value="production"><Factory className="h-4 w-4 mr-2" />Production</TabsTrigger>
        </TabsList>
        <TabsContent value="suppliers" className="flex-grow mt-4">
          <SupplierManager />
        </TabsContent>
        <TabsContent value="raw_materials" className="flex-grow mt-4">
          <RawMaterialManager />
        </TabsContent>
        <TabsContent value="purchase_orders" className="flex-grow mt-4">
          <PurchaseOrderManager />
        </TabsContent>
        <TabsContent value="purchase_vouchers" className="flex-grow mt-4">
          <PurchaseVoucherManager />
        </TabsContent>
        <TabsContent value="supplier_ledger" className="flex-grow mt-4">
          <SupplierLedgerReport />
        </TabsContent>
        <TabsContent value="production" className="flex-grow mt-4">
          <BillOfMaterialsManager />
        </TabsContent>
      </Tabs>

      <MadeWithDyad />
    </div>
  );
};

export default PurchaseDashboard;