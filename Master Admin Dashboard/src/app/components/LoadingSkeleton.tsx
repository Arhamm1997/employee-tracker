import { Skeleton } from './ui/skeleton';

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32 mb-4" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <Skeleton className="h-4 w-32 mb-3" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <Skeleton className="h-6 w-48 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
