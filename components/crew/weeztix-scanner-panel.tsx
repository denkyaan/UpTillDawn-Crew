'use client'

import {useEffect,useState} from 'react'
import {ScanLine,ExternalLink} from 'lucide-react'
import {activeUiLocale,LANGUAGE_APPLIED_EVENT,type SupportedUiLocale} from '@/lib/locale-preferences'
import {WEEZTIX_SCANNER_LINKS} from '@/lib/weeztix-scanner'

const copy={
 nl:{title:'Tickets scannen aan de inkom',detail:'Gebruik de Weeztix Ticket Scanner voor toegangscontrole.',ios:'Scanner voor iPhone',android:'Scanner voor Android',setup:'Scannerlogin beheren',help:'Scannerhandleiding',steps:'Klaarzetten voor de inkom',login:'Vraag de verantwoordelijke om de scannerlogin of login-QR voor dit evenement. Gebruik die om aan te melden in de Weeztix-app.',sync:'Meld vooraf met internet aan en laat de tickets synchroniseren. Controleer of het juiste evenement is geladen voordat je scant.',return:'Open na het scannen UpTillDawn opnieuw voor je werkuren en taken.',manager:'Maak voor dit evenement een scannerlogin aan via Entreemanagement in het Weeztix-dashboard en geef die aan de inkomcrew.'},
 fr:{title:'Scanner les billets à l’entrée',detail:'Utilisez Weeztix Ticket Scanner pour le contrôle d’accès.',ios:'Scanner pour iPhone',android:'Scanner pour Android',setup:'Gérer la connexion du scanner',help:'Guide du scanner',steps:'Préparer l’entrée',login:'Demandez au responsable la connexion ou le QR de connexion du scanner pour cet événement. Utilisez-les dans l’application Weeztix.',sync:'Connectez-vous à Internet à l’avance et laissez les billets se synchroniser. Vérifiez que le bon événement est chargé avant de scanner.',return:'Rouvrez ensuite UpTillDawn pour vos heures de travail et vos tâches.',manager:'Créez une connexion de scanner pour cet événement dans la gestion des entrées du tableau de bord Weeztix et transmettez-la à l’équipe d’entrée.'},
 en:{title:'Scan tickets at the entrance',detail:'Use Weeztix Ticket Scanner for entrance control.',ios:'Scanner for iPhone',android:'Scanner for Android',setup:'Manage scanner login',help:'Scanner guide',steps:'Prepare for entrance control',login:'Ask your responsible lead for the scanner login or login QR for this event. Use it to sign in to the Weeztix app.',sync:'Sign in with an internet connection beforehand and let the tickets synchronize. Check that the correct event is loaded before scanning.',return:'Reopen UpTillDawn afterwards for your work hours and tasks.',manager:'Create a scanner login for this event in Entrance Management in the Weeztix dashboard and share it with the entrance crew.'},
 de:{title:'Tickets am Eingang scannen',detail:'Verwenden Sie Weeztix Ticket Scanner für die Einlasskontrolle.',ios:'Scanner für iPhone',android:'Scanner für Android',setup:'Scanner-Anmeldung verwalten',help:'Scanner-Anleitung',steps:'Einlasskontrolle vorbereiten',login:'Fragen Sie die verantwortliche Person nach der Scanner-Anmeldung oder dem Anmelde-QR für diese Veranstaltung. Melden Sie sich damit in der Weeztix-App an.',sync:'Melden Sie sich vorher mit einer Internetverbindung an und lassen Sie die Tickets synchronisieren. Prüfen Sie vor dem Scannen, ob die richtige Veranstaltung geladen ist.',return:'Öffnen Sie danach UpTillDawn erneut für Ihre Arbeitszeiten und Aufgaben.',manager:'Erstellen Sie für diese Veranstaltung unter Einlassverwaltung im Weeztix-Dashboard eine Scanner-Anmeldung und geben Sie diese an das Einlasspersonal weiter.'},
} as const

export function WeeztixScannerPanel({eventName,canManage=false,initialLocale='nl'}:{eventName:string;canManage?:boolean;initialLocale?:SupportedUiLocale}){
 const [locale,setLocale]=useState<SupportedUiLocale>(initialLocale)
 useEffect(()=>{const apply=()=>setLocale(activeUiLocale());apply();window.addEventListener(LANGUAGE_APPLIED_EVENT,apply);return()=>window.removeEventListener(LANGUAGE_APPLIED_EVENT,apply)},[])
 const t=copy[locale]
 const linkClass='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold'
 return <section data-weeztix-scanner className="mt-3 space-y-3 rounded-xl border p-4" aria-label={t.title}>
  <div className="flex items-start gap-2"><ScanLine className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true"/><div><h2 className="font-semibold">{t.title}</h2><p className="text-sm text-muted-foreground">{eventName}</p></div></div>
  <p className="text-sm">{t.detail}</p>
  <div className="flex flex-wrap gap-2">
   <a href={WEEZTIX_SCANNER_LINKS.ios} target="_blank" rel="noopener noreferrer" className={linkClass}>{t.ios}<ExternalLink className="h-4 w-4" aria-hidden="true"/></a>
   <a href={WEEZTIX_SCANNER_LINKS.android} target="_blank" rel="noopener noreferrer" className={linkClass}>{t.android}<ExternalLink className="h-4 w-4" aria-hidden="true"/></a>
   {canManage&&<a href={WEEZTIX_SCANNER_LINKS.dashboard} target="_blank" rel="noopener noreferrer" className={linkClass}>{t.setup}<ExternalLink className="h-4 w-4" aria-hidden="true"/></a>}
  </div>
  <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">{t.steps}</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{canManage&&<li>{t.manager}</li>}<li>{t.login}</li><li>{t.sync}</li><li>{t.return}</li></ol><a href={WEEZTIX_SCANNER_LINKS.help} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-2">{t.help}</a></details>
 </section>
}
