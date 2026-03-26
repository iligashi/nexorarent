'use client';

import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: number;
  color?: string;
}

export default function StatCard({ label, value, icon: Icon, trend, color = '#FF4D30' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 font-outfit">{value}</p>
          {trend !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
              {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{Math.abs(trend)}% vs last month</span>
            </div>
          )}
        </div>
        <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </div>
    </div>
  );
}
