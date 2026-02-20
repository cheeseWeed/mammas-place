export default function SkeletonProductDetail() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-64 mb-4" />
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-60 shrink-0">
          <div className="bg-white rounded-2xl border border-purple-100 p-4 space-y-3">
            <div className="h-4 bg-purple-100 rounded w-3/4" />
            {[1,2,3,4].map(i => (
              <div key={i} className="flex gap-3">
                <div className="w-14 h-14 bg-purple-100 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                  <div className="h-4 bg-purple-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-purple-100 overflow-hidden">
            <div className="h-64 bg-purple-100" />
            <div className="p-6 space-y-4">
              <div className="h-3 bg-gray-100 rounded w-24" />
              <div className="h-8 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-yellow-100 rounded w-40" />
              <div className="h-20 bg-purple-50 rounded-xl" />
              <div className="flex gap-3">
                <div className="h-14 bg-yellow-200 rounded-2xl flex-1" />
                <div className="h-14 bg-purple-200 rounded-2xl flex-1" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
