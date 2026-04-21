import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export interface AgeingData {
  period: string;
  amount: number;
  percentage: number;
  invoices: number;
  color: string;
}

export interface PaymentAgeingCardProps {
  data: AgeingData[];
  totalAmount: number;
}

export const PaymentAgeingCard: React.FC<PaymentAgeingCardProps> = ({
  data,
  totalAmount = 0,
}) => {
  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-orange-600" />
          Payment Ageing Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Horizontal Stacked Bar */}
          <div className="space-y-1">
            <div className="flex h-8 rounded-lg overflow-hidden gap-1 bg-gray-100 p-1">
              {data.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center transition-all hover:opacity-80"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: item.color,
                  }}
                  title={`${item.period}: ${item.percentage.toFixed(1)}%`}
                >
                  {item.percentage > 8 && (
                    <span className="text-xs font-bold text-white">
                      {item.percentage.toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legend and Details */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
            {data.map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-xs font-semibold text-gray-700">{item.period}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">₹{(item.amount / 100000).toFixed(1)}L</p>
                  <p className="text-xs text-gray-500">{item.invoices} invoices</p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Total Outstanding</p>
            <p className="text-3xl font-bold text-gray-800">₹{(totalAmount / 100000).toFixed(1)}L</p>
            <p className="text-xs text-gray-500 mt-2">
              {data.reduce((sum, d) => sum + d.invoices, 0)} invoices pending
            </p>
          </div>

          {/* Alert if old invoices */}
          {data[data.length - 1] && data[data.length - 1].percentage > 20 && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
              ⚠️ {data[data.length - 1].percentage.toFixed(0)}% of payments are over due!
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
