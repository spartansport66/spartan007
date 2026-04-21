import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export interface CustomerMetric {
  id: string;
  name: string;
  revenue: number;
  percentage: number;
  orders: number;
}

export interface CustomerMetricsCardProps {
  customers: CustomerMetric[];
  totalCustomers: number;
}

export const CustomerMetricsCard: React.FC<CustomerMetricsCardProps> = ({
  customers,
  totalCustomers = 0,
}) => {
  const colors = ['bg-blue-600', 'bg-orange-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-indigo-600" />
          Top Dealers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Count */}
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-gray-800">{totalCustomers}</p>
            <p className="text-sm text-gray-600">Active Dealers</p>
          </div>

          {/* Dealer List */}
          <div className="space-y-3">
            {customers.slice(0, 5).map((customer, idx) => (
              <div key={customer.id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-gray-800 text-sm">{customer.name}</p>
                  <span className="text-xs font-semibold text-gray-600">
                    {customer.orders} orders
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${colors[idx % colors.length]} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${customer.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">₹{(customer.revenue / 1000).toFixed(0)}K</p>
              </div>
            ))}
          </div>

          {/* Color Legend */}
          <div className="flex justify-center gap-2 pt-3 flex-wrap">
            {customers.slice(0, 5).map((_, idx) => (
              <div
                key={idx}
                className={`w-6 h-6 rounded ${colors[idx % colors.length]}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
