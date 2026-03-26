import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-bg-tertiary rounded', className)} />
  );
}

export function CarCardSkeleton() {
  return (
    <div className="bg-bg-secondary rounded-2xl border border-border overflow-hidden">
      <div className="aspect-[4/3] bg-bg-tertiary animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-5 w-2/3 bg-bg-tertiary rounded animate-pulse" />
        <div className="h-4 w-1/3 bg-bg-tertiary rounded animate-pulse" />
        <div className="flex gap-3 mt-3">
          <div className="h-4 w-12 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-4 w-12 bg-bg-tertiary rounded animate-pulse" />
          <div className="h-4 w-12 bg-bg-tertiary rounded animate-pulse" />
        </div>
        <div className="h-10 bg-bg-tertiary rounded animate-pulse mt-4" />
      </div>
    </div>
  );
}
