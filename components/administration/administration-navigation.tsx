import Link from 'next/link'
import type { SupportedUiLocale } from '@/lib/locale-preferences'

const labels={
 nl:{home:'Start',finance:'Financiën',documents:'Documenten',hours:'Werkuren',planning:'Planning',tasks:'Taken',inventory:'Inventaris',events:'Evenementen',messages:'Berichten',reports:'Rapporten',settings:'Instellingen',pending:'In voorbereiding'},
 fr:{home:'Accueil',finance:'Finances',documents:'Documents',hours:'Heures',planning:'Planning',tasks:'Tâches',inventory:'Inventaire',events:'Événements',messages:'Messages',reports:'Rapports',settings:'Paramètres',pending:'En préparation'},
 en:{home:'Home',finance:'Finance',documents:'Documents',hours:'Hours',planning:'Scheduling',tasks:'Tasks',inventory:'Inventory',events:'Events',messages:'Messages',reports:'Reports',settings:'Settings',pending:'In preparation'},
 de:{home:'Start',finance:'Finanzen',documents:'Dokumente',hours:'Arbeitszeit',planning:'Planung',tasks:'Aufgaben',inventory:'Inventar',events:'Events',messages:'Nachrichten',reports:'Berichte',settings:'Einstellungen',pending:'In Vorbereitung'},
} as const

export function AdministrationNavigation({locale}:{locale:SupportedUiLocale}){
 const t=labels[locale]
 const links=[
  {key:'home',href:'/portals/administration'},
  {key:'finance',href:'/portals/administration/finance'},
  {key:'documents',href:'/portals/administration/finance'},
  {key:'hours',href:'/timesheets'},
  {key:'planning',href:'/shifts'},
  {key:'tasks',href:'/tasks'},
  {key:'inventory',href:'/inventory'},
  {key:'events',href:'/events'},
  {key:'messages',href:'/chat'},
  {key:'reports',href:'/exports'},
  {key:'settings',href:'/settings'},
 ] as const
 return <nav aria-label={t.home} className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
  {links.map(item=><Link key={item.key} href={item.href} className="rounded-xl border border-violet-500/20 bg-card p-3 text-sm font-semibold text-violet-400 hover:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500">{t[item.key]} →</Link>)}
 </nav>
}
