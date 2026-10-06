export default function Loading() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse max-w-2xl">
      <div className="h-7 w-28 rounded-xl bg-muted/60" />
      <div className="rounded-2xl bg-muted/30 p-6 space-y-5">
        <div className="h-5 w-40 rounded-lg bg-muted/50" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40" />)}
        </div>
      </div>
      <div className="rounded-2xl bg-muted/30 p-6 space-y-4">
        <div className="h-5 w-36 rounded-lg bg-muted/50" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40" />)}
      </div>
    </div>
  )
}
