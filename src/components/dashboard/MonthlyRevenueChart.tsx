import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export interface MonthData {
  month: string;
  revenue: number;
  target: number;
}

export interface MonthlyRevenueChartProps {
  data: MonthData[];
  maxValue?: number;
}

export const MonthlyRevenueChart: React.FC<MonthlyRevenueChartProps> = ({ data, maxValue }) => {
  const max = maxValue || Math.max(...data.map((d) => Math.max(d.revenue, d.target))) * 1.1;

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          Monthly Revenue
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 pt-4">
          {/* Legend */}
          <div className="flex gap-6 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-700">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-400 rounded"></div>
              <span className="text-gray-700">Target</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-gray-700">Gap</span>
            </div>
          </div>

          {/* Chart */}
          <div className="flex items-end justify-around gap-4 h-48 pb-4">
            {data.map((item, idx) => {
              const revenueHeight = (item.revenue / max) * 100;
              const targetHeight = (item.target / max) * 100;
              const gap = Math.max(0, item.target - item.revenue);
              const gapHeight = (gap / max) * 100;

              return (
                <div key={idx} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full flex items-end justify-center gap-1 h-40">
                    {/* Revenue Bar */}
                    <div
                      className="flex-1 bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                      style={{ height: `${revenueHeight}%` }}
                      title={`₹${item.revenue}`}
                    />
                    {/* Target Bar */}
                    <div
                      className="flex-1 bg-orange-400 rounded-t transition-all duration-300 hover:bg-orange-500"
                      style={{ height: `${targetHeight}%` }}
                      title={`₹${item.target}`}
                    />
                    {/* Gap Bar */}
                    {gap > 0 && (
                      <div
                        className="flex-1 bg-red-300 rounded-t transition-all duration-300 hover:bg-red-400"
                        style={{ height: `${gapHeight}%` }}
                        title={`Gap: ₹${gap}`}
                      />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-600">{item.month}</p>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg text-center text-xs">
            <div>
              <p className="text-gray-600">Avg Revenue</p>
              <p className="font-bold text-blue-600">₹{(data.reduce((sum, d) => sum + d.revenue, 0) / data.length / 100000).toFixed(1)}L</p>
            </div>
            <div>
              <p className="text-gray-600">Avg Target</p>
              <p className="font-bold text-orange-600">₹{(data.reduce((sum, d) => sum + d.target, 0) / data.length / 100000).toFixed(1)}L</p>
            </div>
            <div>
              <p className="text-gray-600">Total Gap</p>
              <p className="font-bold text-red-600">₹{(data.reduce((sum, d) => sum + Math.max(0, d.target - d.revenue), 0) / 100000).toFixed(1)}L</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
