export default function SkeletonCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-purple-100 animate-pulse">
      <div className={`${compact ? 'h-32' : 'h-52'} bg-purple-100`} />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-purple-100 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        {!compact && <div className="h-3 bg-gray-100 rounded w-full" />}
        {!compact && <div className="h-3 bg-gray-100 rounded w-2/3" />}
        <div className="h-5 bg-purple-100 rounded w-1/4 mt-2" />
        {!compact && <div className="h-9 bg-purple-200 rounded-xl mt-2" />}
      </div>
    </div>
  );
}
