'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import type {Portal} from '@/lib/portal-access'
import type {SupportedUiLocale} from '@/lib/locale-preferences'

const labels={
 nl:{aria:'Wissel van portaal',chooser:'Alle portalen',events:'Evenementen',promotion:'Promotie',administration:'Administratie'},
 fr:{aria:'Changer de portail',chooser:'Tous les portails',events:'Événements',promotion:'Promotion',administration:'Administration'},
 en:{aria:'Switch portal',chooser:'All portals',events:'Events',promotion:'Promotion',administration:'Administration'},
 de:{aria:'Portal wechseln',chooser:'Alle Portale',events:'Veranstaltungen',promotion:'Promotion',administration:'Verwaltung'},
} as const

function activePortal(pathname:string):Portal|null{
 if(pathname==='/portals'||pathname.startsWith('/portals/roles')||
   pathname.startsWith('/portals/switch/'))return null
 if(pathname.startsWith('/portals/promotion'))return 'promotion'
 if(pathname.startsWith('/portals/administration'))return 'administration'
 // Shared operational paths belong to the event/crew portal.
 return 'events'
}

export function PortalSwitcherLinks({portals,locale}:{
 portals:readonly Portal[];locale:SupportedUiLocale
}){
 const pathname=usePathname()??''
 const current=activePortal(pathname)
 const t=labels[locale]
 return <nav className="flex flex-wrap items-center gap-2 border-b px-4 py-2 print:hidden"
   aria-label={t.aria}>
  {portals.map(portal=><Link key={portal} href={'/portals/switch/'+portal}
    aria-current={current===portal?'page':undefined}
    className={'rounded-lg border px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 '+
     (current===portal?'border-violet-500 bg-violet-600 text-white':'border-violet-500/50 text-violet-400 hover:border-violet-500')}>
    {t[portal]}
   </Link>)}
  <Link href="/portals" aria-current={pathname==='/portals'?'page':undefined}
    className="rounded-lg border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-violet-500">
    {t.chooser}
  </Link>
 </nav>
}
