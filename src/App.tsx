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
import StockReceipts from "./pages/StockReceipts"; // Import new page
import { SessionContextProvider } from "./contexts/SessionContext";
import { useActivityTracker } from "./hooks/useActivityTracker"; // Import new hook

const queryClient = new QueryClient();

const AppContent = () => {
  useActivityTracker(); // Run the activity tracker hook
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
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
      <Route path="/stock-receipts" element={<StockReceipts />} />
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