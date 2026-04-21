import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export interface BillingProgressCardProps {
  percentage: number;
  label: string;
  color?: string;
}

export const BillingProgressCard: React.FC<BillingProgressCardProps> = ({
  percentage = 76,
  label = 'Invoice Generation',
  color = '#F59E0B',
}) => {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <Card className="bg-white border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-indigo-600" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8">
          <svg width="140" height="140" className="mb-4">
            <circle
              cx="70"
              cy="70"
              r="45"
              stroke="#E5E7EB"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="70"
              cy="70"
              r="45"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 70 70)"
              className="transition-all duration-500"
            />
            <text
              x="70"
              y="75"
              textAnchor="middle"
              fontSize="28"
              fontWeight="bold"
              fill="#1F2937"
            >
              {percentage}%
            </text>
          </svg>
          <p className="text-sm text-gray-600 text-center">of invoices generated this month</p>
        </div>
      </CardContent>
    </Card>
  );
};
