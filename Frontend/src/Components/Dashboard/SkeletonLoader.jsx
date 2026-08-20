export const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-xl ${className}`} />
);

export const MetricSkeleton = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex justify-between items-start">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-10 w-10 rounded-xl" />
    </div>
    <SkeletonBlock className="h-8 w-32" />
    <SkeletonBlock className="h-4 w-40" />
  </div>
);

export const ChartSkeleton = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm h-[24rem] flex flex-col justify-between">
    <SkeletonBlock className="h-5 w-40 mb-6" />
    <div className="flex items-end gap-2 h-full">
      {[...Array(8)].map((_, i) => (
        <SkeletonBlock key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.random() * 60 + 20}%` }} />
      ))}
    </div>
  </div>
);

export const TableSkeleton = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
    <SkeletonBlock className="h-6 w-40 mb-6" />
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <SkeletonBlock key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
);
