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

export function translateRuntimeUi(value:string,locale:ExtendedUiLocale):string{
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
