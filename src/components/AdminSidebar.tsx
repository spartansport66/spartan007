"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { Gift, Boxes, Building, UserCog, FileText, Info, LogOut, Home, DollarSign, AlertTriangle, Scale, MapPin, Clock, ListChecks, ShoppingCart, Lock, Package, PlusCircle, Globe, Users, FileSearch, Monitor, Tag, Database, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  handleLogout: () => void;
  setIsOrdersAwaitingDispatchReportOpen: (isOpen: boolean) => void;
  setIsDispatchedOrdersReportOpen: (isOpen: boolean) => void;
  setIsDealerReportOpen: (isOpen: boolean) => void;
  setIsPaymentsReportOpen: (isOpen: boolean) => void;
  setIsSalesReportsDialogOpen: (isOpen: boolean) => void;
  setIsCompanyInfoDialogOpen: (isOpen: boolean) => void;
  setIsDealerLedgerReportOpen: (isOpen: boolean) => void;
  setIsOpeningBalanceReportOpen: (isOpen: boolean) => void;
  setIsDealerOverdueBalanceReportOpen: (isOpen: boolean) => void;
  setIsDealerClosingBalanceReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonVisitReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonTodayFollowupsReportOpen: (isOpen: boolean) => void;
  setIsLoginLogReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonAccountStatementReportOpen: (isOpen: boolean) => void;
  setIsOrderSummaryReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonLedgerReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonPerformanceReportOpen: (isOpen: boolean) => void;
  setIsDailyReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonDailySalesReportOpen: (isOpen: boolean) => void; // New Prop
  setIsSalesPersonOrderWiseReportOpen: (isOpen: boolean) => void;
  setIsItemWiseDealerSalesReportOpen: (isOpen: boolean) => void;

}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  handleLogout,
  setIsOrdersAwaitingDispatchReportOpen,
  setIsDispatchedOrdersReportOpen,
  setIsDealerReportOpen,
  setIsPaymentsReportOpen,
  setIsSalesReportsDialogOpen,
  setIsCompanyInfoDialogOpen,
  setIsDealerLedgerReportOpen,
  setIsOpeningBalanceReportOpen,
  setIsDealerOverdueBalanceReportOpen,
  setIsDealerClosingBalanceReportOpen,
  setIsSalesPersonVisitReportOpen,
  setIsSalesPersonTodayFollowupsReportOpen,
  setIsLoginLogReportOpen,
  setIsSalesPersonAccountStatementReportOpen,
  setIsOrderSummaryReportOpen,
  setIsSalesPersonLedgerReportOpen,
  setIsSalesPersonPerformanceReportOpen,
  setIsDailyReportOpen,
  setIsSalesPersonDailySalesReportOpen, // New Prop
  setIsSalesPersonOrderWiseReportOpen,
  setIsItemWiseDealerSalesReportOpen,

}) => {
  const navigate = useNavigate();

  const NavButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    className?: string;
  }> = ({ icon, label, onClick, className }) => (
    <SheetClose asChild>
      <Button
        onClick={onClick}
        className={cn(
          "w-full justify-start gap-2",
          "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
          className
        )}
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </Button>
    </SheetClose>
  );

  return (
    <div className="flex flex-col space-y-2 p-4">
      <NavButton
        icon={<Home className="h-4 w-4" />}
        label="Dashboard"
        onClick={() => navigate('/admin-dashboard')}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "w-full justify-start gap-2",
              "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <FileSearch className="h-4 w-4" />
            Extractors
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Open an extractor</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/flipkart-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Flipkart Extractor
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/amazon-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Amazon Extractor
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/meesho-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Meesho Extractor
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/spartan-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Spartan Website Extractor
            </DropdownMenuItem>
          </SheetClose>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "w-full justify-start gap-2",
              "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Monitor className="h-4 w-4" />
            Online Orders
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Online Order Tools</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/online-order-dashboard')}>
              <ListChecks className="h-4 w-4 mr-2" /> Extract & Stage Orders
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/online-order-dispatch-dashboard')}>
              <Truck className="h-4 w-4 mr-2" /> Map & Dispatch
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/online-order-dispatch-dashboard?tab=invoice-process')}>
              <FileText className="h-4 w-4 mr-2" /> Process from Invoice
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/flipkart-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Flipkart Extractor
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/meesho-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Meesho Extractor
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/amazon-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Amazon Extractor
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/spartan-extractor')}>
              <FileSearch className="h-4 w-4 mr-2" /> Spartan Extractor
            </DropdownMenuItem>
          </SheetClose>
        </DropdownMenuContent>
      </DropdownMenu>

      <NavButton
        icon={<DollarSign className="h-4 w-4" />}
        label="Receive Payment"
        onClick={() => navigate('/receive-payment')}
      />
      <NavButton
        icon={<PlusCircle className="h-4 w-4" />}
        label="Record Stock Receipt"
        onClick={() => navigate('/record-stock-receipt')}
      />
      <NavButton
        icon={<Package className="h-4 w-4" />}
        label="Material Returns"
        onClick={() => navigate('/material-returns')}
      />
      <NavButton
        icon={<Gift className="h-4 w-4" />}
        label="Manage Combo Offers"
        onClick={() => navigate('/combo-offers-dashboard')}
      />
      <NavButton
        icon={<Boxes className="h-4 w-4" />}
        label="Manage Products"
        onClick={() => navigate('/product-management-console')}
      />
      <NavButton
        icon={<Tag className="h-4 w-4" />}
        label="Manage Categories"
        onClick={() => navigate('/manage-categories')}
      />
      <NavButton
        icon={<Building className="h-4 w-4" />}
        label="Manage Dealers"
        onClick={() => navigate('/manage-dealers')}
      />
      <NavButton
        icon={<UserCog className="h-4 w-4" />}
        label="Manage Users"
        onClick={() => navigate('/manage-users')}
      />
      <NavButton
        icon={<Users className="h-4 w-4" />}
        label="Transfer Dealers"
        onClick={() => navigate('/transfer-dealers')}
      />
      <NavButton
        icon={<Globe className="h-4 w-4" />}
        label="Manage Platforms"
        onClick={() => navigate('/manage-platforms')}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "w-full justify-start gap-2",
              "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <FileText className="h-4 w-4" />
            Reports
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Select a Report</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDailyReportOpen(true)} className="font-semibold text-blue-600">
              Daily Report Summary
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsOrdersAwaitingDispatchReportOpen(true)}>
              Orders Awaiting Dispatch
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDispatchedOrdersReportOpen(true)}>
              Dispatched Orders
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsOrderSummaryReportOpen(true)}>
              Order Summary Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesReportsDialogOpen(true)}>
              Sales Detail Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsItemWiseDealerSalesReportOpen(true)}>
              Item-wise Dealer Sales Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsPaymentsReportOpen(true)}>
              Payments Report
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonPerformanceReportOpen(true)}>
              Sales Person Performance
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonDailySalesReportOpen(true)}>
              Sales Person Daily Sales
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonOrderWiseReportOpen(true)}>
              Sales Person Order-wise Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonAccountStatementReportOpen(true)}>
              Sales Person Account Statement
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonLedgerReportOpen(true)}>
              Sales Person Ledger Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => navigate('/sales-dispatched-order-report')}>
              Sales Person Dispatched Orders
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDealerReportOpen(true)}>
              Dealer Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDealerLedgerReportOpen(true)}>
              Dealer Ledger Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsOpeningBalanceReportOpen(true)}>
              Opening Balance Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDealerClosingBalanceReportOpen(true)}>
              Closing Balance Report
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonVisitReportOpen(true)}>
              <MapPin className="h-4 w-4 mr-2" /> Daily Visit Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonTodayFollowupsReportOpen(true)} className="text-orange-600 font-semibold">
              <Clock className="h-4 w-4 mr-2 text-orange-600" /> Today's Follow-ups
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDealerOverdueBalanceReportOpen(true)} className="text-red-600 font-semibold">
              <AlertTriangle className="h-4 w-4 mr-2 text-red-600" /> Overdue Balance Report
            </DropdownMenuItem>
          </SheetClose>
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsLoginLogReportOpen(true)}>
              <ListChecks className="h-4 w-4 mr-2" /> Login Log Report
            </DropdownMenuItem>
          </SheetClose>
        </DropdownMenuContent>
      </DropdownMenu>


      <NavButton
        icon={<Info className="h-4 w-4" />}
        label="Company Information"
        onClick={() => setIsCompanyInfoDialogOpen(true)}
      />
      <NavButton
        icon={<Lock className="h-4 w-4" />}
        label="Change Password"
        onClick={() => navigate('/change-password')}
      />
      <NavButton
        icon={<LogOut className="h-4 w-4" />}
        label="Logout"
        onClick={handleLogout}
      />
    </div>
  );
};

export default AdminSidebar;