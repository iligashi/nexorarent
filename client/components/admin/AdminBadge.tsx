import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  published: 'bg-green-50 text-green-700 border-green-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function AdminBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
      statusColors[status] || 'bg-gray-100 text-gray-600 border-gray-200',
      className
    )}>
      {status}
    </span>
  );
}
