"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from 'react-router-dom';
import { Gift, Boxes, Building, UserCog, FileText, Info, LogOut, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminSidebarProps {
  handleLogout: () => void;
  setIsOrdersAwaitingDispatchReportOpen: (isOpen: boolean) => void;
  setIsDispatchedOrdersReportOpen: (isOpen: boolean) => void;
  setIsSalesPersonPerformanceReportOpen: (isOpen: boolean) => void;
  setIsDealerReportOpen: (isOpen: boolean) => void;
  setIsPaymentsReportOpen: (isOpen: boolean) => void;
  setIsCompanyInfoDialogOpen: (isOpen: boolean) => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  handleLogout,
  setIsOrdersAwaitingDispatchReportOpen,
  setIsDispatchedOrdersReportOpen,
  setIsSalesPersonPerformanceReportOpen,
  setIsDealerReportOpen,
  setIsPaymentsReportOpen,
  setIsCompanyInfoDialogOpen,
}) => {
  const navigate = useNavigate();

  const NavButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
    className?: string;
  }> = ({ icon, label, onClick, variant = "ghost", className }) => (
    <SheetClose asChild>
      <Button variant={variant} onClick={onClick} className={cn("w-full justify-start gap-2", className)}>
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
        variant="default"
        className="bg-purple-600 hover:bg-purple-700 text-white"
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
        variant="secondary"
      />
      <NavButton
        icon={<UserCog className="h-4 w-4" />}
        label="Manage Users"
        onClick={() => navigate('/manage-users')}
        variant="outline"
        className="text-purple-600 dark:text-purple-400"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 text-blue-600 dark:text-blue-400">
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
        </DropdownMenuContent>
      </DropdownMenu>

      <NavButton
        icon={<Info className="h-4 w-4" />}
        label="Company Information"
        onClick={() => setIsCompanyInfoDialogOpen(true)}
        variant="outline"
        className="text-green-600 dark:text-green-400"
      />
      <NavButton
        icon={<LogOut className="h-4 w-4" />}
        label="Logout"
        onClick={handleLogout}
        variant="destructive"
      />
    </div>
  );
};

export default AdminSidebar;