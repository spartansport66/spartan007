"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DailyReportCard from '@/components/DailyReportCard';

interface DailyReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DailyReportDialog: React.FC<DailyReportDialogProps> = ({ isOpen, onOpenChange }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border-none bg-transparent shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Daily Report</DialogTitle>
          <DialogDescription>Daily summary of orders and dispatches.</DialogDescription>
        </DialogHeader>
        <DailyReportCard />
      </DialogContent>
    </Dialog>
  );
};

export default DailyReportDialog;