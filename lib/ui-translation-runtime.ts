import { UI_TRANSLATIONS, translateUiText, type UiLocale } from '@/lib/ui-translations'
import { translateUiExtension, type ExtendedUiLocale } from '@/lib/ui-translation-extensions'
import { translateCompleteUi } from '@/lib/ui-translation-complete'
import { APP_TRANSLATIONS, translateAppUi } from '@/lib/ui-translation-catalog-app'
import { APP_EXTRA_TRANSLATIONS, translateAppExtraUi } from '@/lib/ui-translation-catalog-app-extra'
import { CREW_TRANSLATIONS, translateCrewUi } from '@/lib/ui-translation-catalog-crew'
import { CREW_EXTRA_TRANSLATIONS, translateCrewExtraUi } from '@/lib/ui-translation-catalog-crew-extra'
import { GOD_TRANSLATIONS, translateGodUi } from '@/lib/ui-translation-catalog-god'
import { translateActionUi } from '@/lib/ui-translation-catalog-actions'

const canonicalUiText = new Map<string,string>()
for(const [nl,row] of Object.entries(UI_TRANSLATIONS)){
  canonicalUiText.set(nl,nl)
  canonicalUiText.set(row.fr,nl)
  canonicalUiText.set(row.en,nl)
}

const fragmentCatalogs=[
  APP_TRANSLATIONS,
  APP_EXTRA_TRANSLATIONS,
  CREW_TRANSLATIONS,
  CREW_EXTRA_TRANSLATIONS,
  GOD_TRANSLATIONS,
] as const

const fragmentRows=fragmentCatalogs
  .flatMap(catalog=>Object.entries(catalog))
  .filter(([key])=>{
    if(key.length<4)return false
    // Fragment replacement is only for template-like copy. Avoid replacing
    // short generic words inside user-provided names or event content.
    return /[\s·:()–—]/.test(key)||key.length>=18
  })
  .sort((a,b)=>b[0].length-a[0].length)

function canonicalizeBase(value:string){
  const exact=canonicalUiText.get(value)
  if(exact)return exact
  const separators=/(\s+(?:·|→|—)\s+|:\s+)/
  const parts=value.split(separators)
  if(parts.length<=1)return value
  let changed=false
  const canonical=parts.map(part=>{
    if(separators.test(part))return part
    const trimmed=part.trim()
    const hit=canonicalUiText.get(trimmed)
    if(!hit)return part
    changed=true
    const leading=part.match(/^\s*/)?.[0]||''
    const trailing=part.match(/\s*$/)?.[0]||''
    return leading+hit+trailing
  }).join('')
  return changed?canonical:value
}

function translatePasswordPolicy(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Wachtwoord moet (.+) bevatten\.$/)
  if(!match)return null
  const parts=match[1].split(', ').map(part=>{
    const min=part.match(/^minstens (\d+) tekens$/)
    if(min){
      if(locale==='fr')return `au moins ${min[1]} caractères`
      if(locale==='en')return `at least ${min[1]} characters`
      if(locale==='de')return `mindestens ${min[1]} Zeichen`
    }
    return translateActionUi(part,locale)
  })
  const prefix=translateActionUi('Wachtwoord moet',locale)
  return locale==='nl'?value:`${prefix} ${parts.join(', ')}.`
}

function translateExact(value:string,locale:ExtendedUiLocale){
  const translators=[
    translateAppUi,
    translateAppExtraUi,
    translateCrewUi,
    translateCrewExtraUi,
    translateGodUi,
    translateActionUi,
    translateCompleteUi,
    translateUiExtension,
  ] as const
  for(const translator of translators){
    const translated=translator(value,locale)
    if(translated!==value)return translated
  }
  return value
}

function translateCatalogFragments(value:string,locale:ExtendedUiLocale){
  if(locale==='nl')return value
  let output=value
  let changed=false
  for(const [key,row] of fragmentRows){
    if(!output.includes(key))continue
    const translated=row[locale]
    if(!translated||translated===key)continue
    output=output.split(key).join(translated)
    changed=true
  }
  return changed?output:value
}

function translateArtistArrival(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Artiest - (.+), is aangekomen\.$/)
  if(!match)return null
  const name=match[1]
  if(locale==='fr')return `Artiste - ${name}, est arrivé.`
  if(locale==='en')return `Artist - ${name}, has arrived.`
  if(locale==='de')return `Künstler - ${name}, ist angekommen.`
  return value
}

function translateSaleConfirmation(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(\d+) × (.+) verkocht · (cash|kaart) · (.+)$/i)
  if(!match)return null
  const [,quantity,name,payment,total]=match
  if(locale==='fr')return `${quantity} × ${name} vendu · ${payment==='cash'?'espèces':'carte'} · ${total}`
  if(locale==='en')return `${quantity} × ${name} sold · ${payment==='cash'?'cash':'card'} · ${total}`
  if(locale==='de')return `${quantity} × ${name} verkauft · ${payment==='cash'?'bar':'Karte'} · ${total}`
  return value
}

function translateGuestSpotStatus(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(\d+) van (\d+) spots binnen · (\d+) resterend$/i)
  if(!match)return null
  const [,checked,total,remaining]=match
  if(locale==='fr')return `${checked} sur ${total} places entrées · ${remaining} restantes`
  if(locale==='en')return `${checked} of ${total} spots inside · ${remaining} remaining`
  if(locale==='de')return `${checked} von ${total} Plätzen drin · ${remaining} verbleibend`
  return value
}

function translateImportSummary(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Import klaar · (\d+) nieuw · (\d+) bestaand · (\d+) aangevuld$/i)
  if(!match)return null
  const [,added,existing,supplemented]=match
  if(locale==='fr')return `Import terminé · ${added} nouveau(x) · ${existing} existant(s) · ${supplemented} complété(s)`
  if(locale==='en')return `Import complete · ${added} new · ${existing} existing · ${supplemented} supplemented`
  if(locale==='de')return `Import abgeschlossen · ${added} neu · ${existing} vorhanden · ${supplemented} ergänzt`
  return value
}

function translateClockRequestCounts(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(\d+)\s+inklokverzoek(?:en)?\s+·\s+(\d+)\s+uitklokverzoek(?:en)?$/i)
  if(!match)return null
  const [clockIn,clockOut]=[match[1],match[2]]
  if(locale==='fr')return `${clockIn} demande(s) d’entrée · ${clockOut} demande(s) de sortie`
  if(locale==='en')return `${clockIn} clock-in request(s) · ${clockOut} clock-out request(s)`
  if(locale==='de')return `${clockIn} Einstempel-Anfrage(n) · ${clockOut} Ausstempel-Anfrage(n)`
  return value
}


function translateRequestStatus(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Aanvraag:\s*(pending|approved|rejected|cancelled|canceled)$/i)
  if(!match||locale==='nl')return null
  const status=match[1].toLowerCase()
  const labels={
    fr:{pending:'en attente',approved:'approuvée',rejected:'refusée',cancelled:'annulée',canceled:'annulée'},
    en:{pending:'pending',approved:'approved',rejected:'rejected',cancelled:'cancelled',canceled:'cancelled'},
    de:{pending:'offen',approved:'genehmigt',rejected:'abgelehnt',cancelled:'storniert',canceled:'storniert'},
  } as const
  return `${locale==='fr'?'Demande':locale==='en'?'Request':'Anfrage'}: ${labels[locale][status as keyof typeof labels.fr]}`
}

function translateShiftReminder(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(.+?) · (.+?) start binnen (24 uur|2 uur|15 minuten)(\. Gebruik de QR-flow bij aankomst\.)?$/)
  if(!match||locale==='nl')return null
  const [,eventName,workplace,window,qr]=match
  const span=window==='24 uur'
    ? (locale==='fr'?'24 heures':locale==='en'?'24 hours':'24 Stunden')
    : window==='2 uur'
      ? (locale==='fr'?'2 heures':locale==='en'?'2 hours':'2 Stunden')
      : (locale==='fr'?'15 minutes':locale==='en'?'15 minutes':'15 Minuten')
  const start=locale==='fr'
    ? `${eventName} · ${workplace} commence dans ${span}.`
    : locale==='en'
      ? `${eventName} · ${workplace} starts within ${span}.`
      : `${eventName} · ${workplace} beginnt in ${span}.`
  if(!qr)return start
  return start+' '+(locale==='fr'?'Utilisez le flux QR à votre arrivée.':locale==='en'?'Use the QR flow when you arrive.':'Nutze bei deiner Ankunft den QR-Ablauf.')
}

function translateUnderstaffing(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Actieve bezetting op (.+): (\d+)\/(\d+)\.$/)
  if(!match||locale==='nl')return null
  const [,workplace,active,minimum]=match
  if(locale==='fr')return `Effectif actif à ${workplace} : ${active}/${minimum}.`
  if(locale==='en')return `Active staffing at ${workplace}: ${active}/${minimum}.`
  return `Aktive Besetzung bei ${workplace}: ${active}/${minimum}.`
}

function translateAccountApproval(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Nieuw account wacht op goedkeuring: (.+)\.$/)
  if(!match||locale==='nl')return null
  if(locale==='fr')return `Un nouveau compte attend une approbation : ${match[1]}.`
  if(locale==='en')return `A new account is awaiting approval: ${match[1]}.`
  return `Ein neues Konto wartet auf Genehmigung: ${match[1]}.`
}

function translateEventReportReady(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(.+) is afgerond\. Het automatische eventrapport staat klaar\.$/)
  if(!match||locale==='nl')return null
  if(locale==='fr')return `${match[1]} est terminé. Le rapport automatique de l’événement est prêt.`
  if(locale==='en')return `${match[1]} is complete. The automatic event report is ready.`
  return `${match[1]} ist abgeschlossen. Der automatische Eventbericht ist fertig.`
}

function translateInventoryQuantity(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(.+) · (\d+) stuk\(s\)( · .+)?$/)
  if(!match||locale==='nl')return null
  const [,name,quantity,note='']=match
  const unit=locale==='fr'?'pièce(s)':locale==='en'?'item(s)':'Stück'
  return `${name} · ${quantity} ${unit}${note}`
}

function translateDriverDeparture(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(.+) · (Ophalen|Afzetten): (.+?) · (.+?) · (.+?) · rit ±(\d+) min · 15 min vertrekmarge\.$/)
  if(!match||locale==='nl')return null
  const [,eventName,direction,person,phone,address,minutes]=match
  const action=direction==='Ophalen'
    ? (locale==='fr'?'Prise en charge':locale==='en'?'Pickup':'Abholung')
    : (locale==='fr'?'Dépose':locale==='en'?'Drop-off':'Absetzen')
  const suffix=locale==='fr'
    ? `trajet ±${minutes} min · marge de départ 15 min.`
    : locale==='en'
      ? `drive ±${minutes} min · 15 min departure margin.`
      : `Fahrt ±${minutes} Min. · 15 Min. Abfahrtsreserve.`
  return `${eventName} · ${action}: ${person} · ${phone} · ${address} · ${suffix}`
}

function translateDriverArrival(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^Driver is aangekomen op het evenement met artiest - (.+?)\.(?: (Stel een backstage werkplek in\.|Er is geen backstage manager toegewezen\.))?$/)
  if(!match||locale==='nl')return null
  const [,artist,followup]=match
  const base=locale==='fr'
    ? `Le chauffeur est arrivé à l’événement avec l’artiste - ${artist}.`
    : locale==='en'
      ? `The driver arrived at the event with artist - ${artist}.`
      : `Der Fahrer ist mit dem Künstler - ${artist} - am Event angekommen.`
  if(!followup)return base
  const extra=followup.startsWith('Stel')
    ? (locale==='fr'?'Configurez un poste backstage.':locale==='en'?'Configure a backstage workplace.':'Richte einen Backstage-Arbeitsplatz ein.')
    : (locale==='fr'?'Aucun responsable backstage n’est assigné.':locale==='en'?'No backstage manager is assigned.':'Es ist kein Backstage-Manager zugewiesen.')
  return `${base} ${extra}`
}

function translateAdminLockout(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^3 mislukte admin-loginpogingen\. Account: (.+?)\. IP: (.+?)\. Locatie \(benadering\): (.+?)\. Apparaat\/browser: (.+?)\. Login gedurende 15 minuten geblokkeerd\.$/)
  if(!match||locale==='nl')return null
  const [,account,ip,location,device]=match
  if(locale==='fr')return `3 tentatives de connexion administrateur ont échoué. Compte : ${account}. IP : ${ip}. Localisation (approximative) : ${location}. Appareil/navigateur : ${device}. Connexion bloquée pendant 15 minutes.`
  if(locale==='en')return `3 admin login attempts failed. Account: ${account}. IP: ${ip}. Location (approximate): ${location}. Device/browser: ${device}. Login blocked for 15 minutes.`
  return `3 Admin-Anmeldeversuche sind fehlgeschlagen. Konto: ${account}. IP: ${ip}. Standort (ungefähr): ${location}. Gerät/Browser: ${device}. Anmeldung für 15 Minuten gesperrt.`
}

function translateActionCenterTitle(value:string,locale:ExtendedUiLocale){
  const match=value.match(/^(ACCOUNT GOEDKEUREN|INKLOKKEN|UITKLOKKEN|INKLOKKEN ONTBREEKT|HELP) · (.+)$/)
  if(!match)return null
  const [,prefix,name]=match
  const rows:Record<string,{fr:string;en:string;de:string}>={
    'ACCOUNT GOEDKEUREN':{fr:'APPROUVER LE COMPTE',en:'APPROVE ACCOUNT',de:'KONTO GENEHMIGEN'},
    'INKLOKKEN':{fr:'POINTAGE D’ENTRÉE',en:'CLOCK IN',de:'EINSTEMPELN'},
    'UITKLOKKEN':{fr:'POINTAGE DE SORTIE',en:'CLOCK OUT',de:'AUSSTEMPELN'},
    'INKLOKKEN ONTBREEKT':{fr:'POINTAGE D’ENTRÉE MANQUANT',en:'CLOCK-IN MISSING',de:'EINSTEMPELN FEHLT'},
    'HELP':{fr:'AIDE',en:'HELP',de:'HILFE'},
  }
  if(locale==='nl')return value
  return `${rows[prefix][locale]} · ${name}`
}

export function translateRuntimeUi(value:string,locale:ExtendedUiLocale):string{
  const dynamicTranslators=[translateRequestStatus,translateShiftReminder,translateUnderstaffing,translateAccountApproval,translateEventReportReady,translateInventoryQuantity,translateDriverDeparture,translateDriverArrival,translateAdminLockout] as const
  for(const translator of dynamicTranslators){
    const translated=translator(value,locale)
    if(translated)return translated
  }
  const actionCenterTitle=translateActionCenterTitle(value,locale)
  if(actionCenterTitle)return actionCenterTitle
  const artistArrival=translateArtistArrival(value,locale)
  if(artistArrival)return artistArrival
  const saleConfirmation=translateSaleConfirmation(value,locale)
  if(saleConfirmation)return saleConfirmation
  const guestSpots=translateGuestSpotStatus(value,locale)
  if(guestSpots)return guestSpots
  const importSummary=translateImportSummary(value,locale)
  if(importSummary)return importSummary
  const clockRequests=translateClockRequestCounts(value,locale)
  if(clockRequests)return clockRequests
  const passwordPolicy=translatePasswordPolicy(value,locale)
  if(passwordPolicy)return passwordPolicy

  const exact=translateExact(value,locale)
  if(exact!==value)return exact

  const counted=value.match(/^(\d+)\s+(.+)$/)
  if(counted){
    const translatedTail=translateRuntimeUi(counted[2],locale)
    if(translatedTail!==counted[2])return `${counted[1]} ${translatedTail}`
  }

  const fragmented=translateCatalogFragments(value,locale)
  if(fragmented!==value)return fragmented

  const canonical=canonicalizeBase(value)
  const canonicalExact=translateExact(canonical,locale)
  if(canonicalExact!==canonical)return canonicalExact

  if(locale==='de')return canonical
  return translateUiText(canonical,locale as UiLocale)
}
