import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AddDealer from "./pages/AddDealer";
import ManageDealers from "./pages/ManageDealers";
import AddProduct from "./pages/AddProduct";
import ManageProducts from "./pages/ManageProducts";
import ManageUsers from "./pages/ManageUsers";
import AdminDashboard from "./pages/AdminDashboard";
import ProductManagementConsole from "./pages/ProductManagementConsole";
import BulkAddProducts from "./pages/BulkAddProducts";
import ComboOffersDashboard from "./pages/ComboOffersDashboard";
import SheetConverterPage from "./pages/SheetConverterPage";
import ForcePasswordReset from "./pages/ForcePasswordReset";
import DailyVisitReport from "./pages/DailyVisitReport";
import MaterialReturns from "./pages/MaterialReturns";
import ChangePassword from "./pages/ChangePassword";
import GatePassDashboard from "./pages/GatePassDashboard";
import ProductDashboard from "./pages/ProductDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import RecordStockReceipt from "./pages/RecordStockReceipt"; // New Import
import ReceivePayment from "./pages/ReceivePayment";
import ManagePlatforms from "./pages/ManagePlatforms"; // New Import
import PurchaseDashboard from "./pages/PurchaseDashboard"; // New Import
import TransferDealers from "./pages/TransferDealers"; // New Import
import { SessionContextProvider } from "./contexts/SessionContext";
import { useActivityTracker } from "./hooks/useActivityTracker";

const queryClient = new QueryClient();

const AppContent = () => {
  useActivityTracker(); // Run the activity tracker hook
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/product-dashboard" element={<ProductDashboard />} />
      <Route path="/super-admin-dashboard" element={<SuperAdminDashboard />} />
      <Route path="/manager-dashboard" element={<ManagerDashboard />} />
      <Route path="/add-dealer" element={<AddDealer />} />
      <Route path="/manage-dealers" element={<ManageDealers />} />
      <Route path="/add-product" element={<AddProduct />} />
      <Route path="/manage-products" element={<ManageProducts />} />
      <Route path="/manage-users" element={<ManageUsers />} />
      <Route path="/product-management-console" element={<ProductManagementConsole />} />
      <Route path="/bulk-add-products" element={<BulkAddProducts />} />
      <Route path="/combo-offers-dashboard" element={<ComboOffersDashboard />} />
      <Route path="/sheet-converter" element={<SheetConverterPage />} />
      <Route path="/force-password-reset" element={<ForcePasswordReset />} />
      <Route path="/daily-visit-report" element={<DailyVisitReport />} />
      <Route path="/material-returns" element={<MaterialReturns />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/gate-pass-dashboard" element={<GatePassDashboard />} />
      <Route path="/record-stock-receipt" element={<RecordStockReceipt />} />
      <Route path="/receive-payment" element={<ReceivePayment />} />
      <Route path="/manage-platforms" element={<ManagePlatforms />} />
      <Route path="/purchase-dashboard" element={<PurchaseDashboard />} />
      <Route path="/transfer-dealers" element={<TransferDealers />} /> {/* New Route */}
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionContextProvider>
          <AppContent />
        </SessionContextProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;