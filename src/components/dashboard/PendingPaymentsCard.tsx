import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export interface PendingPayment {
  id: string;
  dealerName: string;
  amount: number;
  invoiceNumber: string;
  daysOverdue: number;
}

export interface PendingPaymentsCardProps {
  payments: PendingPayment[];
  total: number;
}

export const PendingPaymentsCard: React.FC<PendingPaymentsCardProps> = ({
  payments,
  total = 0,
}) => {
  const getStatusColor = (days: number) => {
    if (days >= 30) return 'bg-red-100 text-red-800';
    if (days >= 15) return 'bg-orange-100 text-orange-800';
    if (days >= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getDaysLabel = (days: number) => {
    if (days >= 30) return `${days}+ Days`;
    if (days >= 1) return `${days} Day${days > 1 ? 's' : ''}`;
    return 'Due Today';
  };

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="h-5 w-5 text-red-600" />
          Pending Payments
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Total Amount */}
          <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-600">
            <p className="text-sm text-gray-600">Total Pending</p>
            <p className="text-2xl font-bold text-red-600 mt-1">₹{(total / 100000).toFixed(1)}L</p>
          </div>

          {/* Payment List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {payments.slice(0, 5).map((payment) => (
              <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div className="flex-1">
                  <p className="font-medium text-gray-800 text-sm">{payment.dealerName}</p>
                  <p className="text-xs text-gray-500">INV-{payment.invoiceNumber}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800 text-sm">₹{(payment.amount / 1000).toFixed(0)}K</p>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${getStatusColor(payment.daysOverdue)}`}>
                    {getDaysLabel(payment.daysOverdue)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {payments.length > 5 && (
            <p className="text-center text-xs text-gray-500 pt-2">
              +{payments.length - 5} more payments...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
