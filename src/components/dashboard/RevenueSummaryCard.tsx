import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp } from 'lucide-react';

export interface RevenueSummaryCardProps {
  totalRevenue: number;
  targetRevenue: number;
  percentage: number;
  currency?: string;
}

export const RevenueSummaryCard: React.FC<RevenueSummaryCardProps> = ({
  totalRevenue,
  targetRevenue,
  percentage = 75,
  currency = '₹',
}) => {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toFixed(0);
  };

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <DollarSign className="h-5 w-5 text-green-600" />
          Revenue Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* KPI Values */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">KPI Value</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {currency}{formatCurrency(totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Target</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {currency}{formatCurrency(targetRevenue)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">{percentage.toFixed(2)}% of Target</span>
              <span className="text-xs text-gray-500">
                Gap: {currency}{formatCurrency(Math.max(0, targetRevenue - totalRevenue))}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-orange-400 to-orange-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>

          {/* Mini Project Indicators */}
          <div className="flex gap-2 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`h-8 flex-1 rounded ${i < 3 ? 'bg-orange-400' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
