export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 max-w-screen-2xl mx-auto animate-pulse">
      {/* Hero banner skeleton */}
      <div className="h-44 rounded-3xl bg-muted/40" />
      {/* 3-col grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-muted/30" />
        <div className="h-72 rounded-2xl bg-muted/30" />
        <div className="h-72 rounded-2xl bg-muted/30" />
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="h-24 rounded-2xl bg-muted/30" />
        <div className="h-24 rounded-2xl bg-muted/30" />
      </div>
    </div>
  )
}
