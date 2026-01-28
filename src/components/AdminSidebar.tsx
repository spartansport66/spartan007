"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { Gift, Boxes, Building, UserCog, FileText, Info, LogOut, Home, DollarSign, AlertTriangle, Scale, MapPin, Clock, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  handleLogout: () => void;
  setIsOrdersAwaitingDispatchReportOpen: (isOpen: boolean) => void;
  setIsDispatchedOrdersReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonPerformanceReportOpen: (isOpen: boolean) => void;
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
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  handleLogout,
  setIsOrdersAwaitingDispatchReportOpen,
  setIsDispatchedOrdersReportOpen,
  setIsSalesPersonPerformanceReportOpen,
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
        {icon}
        {label}
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
        icon={<Building className="h-4 w-4" />}
        label="Manage Dealers"
        onClick={() => navigate('/manage-dealers')}
      />
      <NavButton
        icon={<UserCog className="h-4 w-4" />}
        label="Manage Users"
        onClick={() => navigate('/manage-users')}
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
          <DropdownMenuSeparator />
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonPerformanceReportOpen(true)}>
              Sales Person Performance
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonAccountStatementReportOpen(true)}>
              Sales Person Account Statement
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
        icon={<LogOut className="h-4 w-4" />}
        label="Logout"
        onClick={handleLogout}
      />
    </div>
  );
};

export default AdminSidebar;