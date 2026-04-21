import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart } from 'lucide-react';

export interface InvoiceStatus {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

export interface InvoiceStatusChartProps {
  statuses: InvoiceStatus[];
  total: number;
}

export const InvoiceStatusChart: React.FC<InvoiceStatusChartProps> = ({
  statuses,
  total = 0,
}) => {
  // Simplified pie chart using CSS
  const getRotation = () => {
    let rotation = 0;
    return statuses.map((status) => {
      const sliceRotation = rotation;
      rotation += (status.percentage / 100) * 360;
      return {
        ...status,
        rotation: sliceRotation,
        slice: (status.percentage / 100) * 360,
      };
    });
  };

  const slices = getRotation();

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PieChart className="h-5 w-5 text-purple-600" />
          Invoice Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          {/* Pie Chart */}
          <div className="flex-shrink-0">
            <svg width="140" height="140" viewBox="0 0 140 140" className="mx-auto">
              <circle cx="70" cy="70" r="50" fill="none" stroke="#E5E7EB" strokeWidth="4" />
              {slices.map((slice, idx) => {
                const radius = 50;
                const angle = (slice.rotation + slice.slice / 2) * (Math.PI / 180);
                const x = 70 + Math.cos(angle) * (radius + 3);
                const y = 70 + Math.sin(angle) * (radius + 3);

                return (
                  <path
                    key={idx}
                    d={`M 70 70 L ${70 + radius * Math.cos((slice.rotation) * Math.PI / 180)} ${70 + radius * Math.sin((slice.rotation) * Math.PI / 180)} A ${radius} ${radius} 0 ${slice.slice > 180 ? 1 : 0} 1 ${70 + radius * Math.cos((slice.rotation + slice.slice) * Math.PI / 180)} ${70 + radius * Math.sin((slice.rotation + slice.slice) * Math.PI / 180)} Z`}
                    fill={slice.color}
                    opacity="0.8"
                  />
                );
              })}
              <circle cx="70" cy="70" r="30" fill="white" />
              <text
                x="70"
                y="75"
                textAnchor="middle"
                fontSize="20"
                fontWeight="bold"
                fill="#1F2937"
              >
                {total}
              </text>
            </svg>
          </div>

          {/* Legend and Stats */}
          <div className="flex-1 space-y-3">
            {statuses.map((status, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-sm font-medium text-gray-700">{status.status}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-800">{status.count}</span>
                </div>
                <div className="bg-gray-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      backgroundColor: status.color,
                      width: `${status.percentage}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">{status.percentage.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
