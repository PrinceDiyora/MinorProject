export const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 rounded-lg ${className}`} />
);

export const NavbarSkeleton = () => (
  <div className="fixed top-0 inset-x-0 z-50 h-16 bg-[#0f172a] flex items-center px-8 gap-8">
    <SkeletonBlock className="h-7 w-32 bg-slate-700" />
    <div className="flex gap-6 ml-10">
      {[...Array(3)].map((_, i) => <SkeletonBlock key={i} className="h-4 w-16 bg-slate-700" />)}
    </div>
    <div className="ml-auto flex gap-3">
      <SkeletonBlock className="h-9 w-20 bg-slate-700" />
      <SkeletonBlock className="h-9 w-28 bg-slate-700" />
    </div>
  </div>
);

export const HeroSkeleton = () => (
  <section className="min-h-screen bg-gradient-to-br from-[#0f172a] to-[#1e293b] flex items-center px-6 lg:px-20 pt-24">
    <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
      <div className="space-y-6">
        <SkeletonBlock className="h-5 w-32 bg-slate-700" />
        <SkeletonBlock className="h-16 w-full bg-slate-700" />
        <SkeletonBlock className="h-16 w-4/5 bg-slate-700" />
        <SkeletonBlock className="h-6 w-3/4 bg-slate-700" />
        <SkeletonBlock className="h-6 w-2/3 bg-slate-700" />
        <div className="flex gap-4 pt-4">
          <SkeletonBlock className="h-12 w-36 bg-slate-700" />
          <SkeletonBlock className="h-12 w-36 bg-slate-700" />
        </div>
      </div>
      <SkeletonBlock className="h-96 w-full bg-slate-700 rounded-2xl" />
    </div>
  </section>
);

export const FeaturesSkeleton = () => (
  <section className="py-24 px-6 lg:px-20 bg-white">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-16 space-y-4">
        <SkeletonBlock className="h-8 w-64 mx-auto" />
        <SkeletonBlock className="h-5 w-96 mx-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="p-6 border border-slate-100 rounded-2xl space-y-4">
            <SkeletonBlock className="h-12 w-12 rounded-xl" />
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  </section>
);

export const TestimonialsSkeleton = () => (
  <section className="py-24 px-6 lg:px-20 bg-slate-50">
    <div className="max-w-7xl mx-auto">
      <SkeletonBlock className="h-8 w-56 mx-auto mb-16" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-6 bg-white rounded-2xl space-y-4 shadow-sm">
            <div className="flex gap-1">{[...Array(5)].map((_, j) => <SkeletonBlock key={j} className="h-4 w-4" />)}</div>
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-5/6" />
            <SkeletonBlock className="h-4 w-4/6" />
            <div className="flex items-center gap-3 pt-2">
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-28" />
                <SkeletonBlock className="h-3 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
