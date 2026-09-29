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
