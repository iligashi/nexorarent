import { cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  active: 'bg-success/10 text-success border-success/20',
  completed: 'bg-text-muted/10 text-text-secondary border-text-muted/20',
  cancelled: 'bg-error/10 text-error border-error/20',
  rejected: 'bg-error/10 text-error border-error/20',
  available: 'bg-success/10 text-success border-success/20',
  booked: 'bg-error/10 text-error border-error/20',
};

export default function Badge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
      statusColors[status] || 'bg-bg-tertiary text-text-secondary border-border',
      className
    )}>
      {status}
    </span>
  );
}
