import Link from 'next/link'
import {requestUiLocale} from '@/lib/server-locale'

export default async function AdministrationAccessNotice({status}:{status:number}){
 const locale=await requestUiLocale()
 const t={
  nl:{unavailable:'Portaal niet beschikbaar',denied:'Geen toegang tot dit portaal',retry:'De toegangscontrole kan momenteel niet worden uitgevoerd. Probeer later opnieuw.',login:'Inloggen',roles:'Mijn portaalrollen'},
  fr:{unavailable:'Portail indisponible',denied:'Accès à ce portail refusé',retry:'Le contrôle d’accès ne peut pas être effectué actuellement. Veuillez réessayer plus tard.',login:'Connexion',roles:'Mes rôles de portail'},
  en:{unavailable:'Portal unavailable',denied:'No access to this portal',retry:'Access verification is currently unavailable. Please try again later.',login:'Log in',roles:'My portal roles'},
  de:{unavailable:'Portal nicht verfügbar',denied:'Kein Zugang zu diesem Portal',retry:'Die Zugriffsprüfung ist derzeit nicht verfügbar. Bitte versuche es später erneut.',login:'Anmelden',roles:'Meine Portalrollen'},
 }[locale]
 return <main role="alert" className="mx-auto max-w-5xl space-y-4 p-5">
  <h1 className="text-2xl font-bold">{status===503?t.unavailable:t.denied}</h1>
  {status===503&&<p>{t.retry}</p>}
  <Link href={status===401?'/login/administration':'/portals/roles'} className="inline-flex rounded-lg border px-4 py-2 text-violet-400">{status===401?t.login:t.roles}</Link>
 </main>
}
