'use client'

// The offline sync renders no UI and starts its own staggered background work.
// Defer its parsing and IndexedDB imports until after the initial app shell;
// this does not remove any of the 16 RLS-scoped offline datasets or workflows.
import dynamic from 'next/dynamic'

const OfflineSync = dynamic(
  () => import('./global-offline-content-sync').then(m => m.GlobalOfflineContentSync),
  {ssr:false},
)

export function LazyOfflineContentSync({userId}:{userId:string}){
  return <OfflineSync userId={userId}/>
}
