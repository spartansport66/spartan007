"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { Gift, Boxes, Building, UserCog, FileText, Info, LogOut, Home, DollarSign } from 'lucide-react'; // Added DollarSign icon
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
  setIsOpeningBalanceReportOpen: (isOpen: boolean) => void; // New prop for Opening Balance Report
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
  setIsOpeningBalanceReportOpen, // Use new prop
}) => {
  const navigate = useNavigate();

  const NavButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    className?: string; // Removed variant prop
  }> = ({ icon, label, onClick, className }) => (
    <SheetClose asChild>
      <Button
        onClick={onClick}
        className={cn(
          "w-full justify-start gap-2",
          "bg-white text-black hover:bg-gray-100", // Enforce white background, black text, and subtle hover
          "dark:bg-white dark:text-black dark:hover:bg-gray-100", // Dark mode override for fixed colors
          className // Merge any additional custom classes
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
              "bg-white text-black hover:bg-gray-100", // Apply fixed styles to dropdown trigger
              "dark:bg-white dark:text-black dark:hover:bg-gray-100"
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
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesPersonPerformanceReportOpen(true)}>
              Sales Person Performance
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDealerReportOpen(true)}>
              Dealer Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsPaymentsReportOpen(true)}>
              Payments Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsSalesReportsDialogOpen(true)}>
              Sales Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsDealerLedgerReportOpen(true)}>
              Dealer Ledger Report
            </DropdownMenuItem>
          </SheetClose>
          <SheetClose asChild>
            <DropdownMenuItem onClick={() => setIsOpeningBalanceReportOpen(true)}> {/* New menu item */}
              Opening Balance Report
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