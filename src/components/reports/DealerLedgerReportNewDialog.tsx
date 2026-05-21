import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DealerLedgerReportNew from '@/components/DealerLedgerReportNew';

interface DealerLedgerReportDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const DealerLedgerReportNewDialog: React.FC<DealerLedgerReportDialogProps> = ({ isOpen, onOpenChange }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Dealer Ledger Report</DialogTitle>
          <DialogDescription>
            View detailed ledger entries for dealers with opening balance, invoices, and payments.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <DealerLedgerReportNew />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DealerLedgerReportNewDialog;
