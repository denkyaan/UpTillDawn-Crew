export const SUPPORTED_UI_LOCALES = ['nl','fr','en','de'] as const
export type SupportedUiLocale = typeof SUPPORTED_UI_LOCALES[number]
export type LocaleSource = 'device'|'manual'

const supported = new Set<string>(SUPPORTED_UI_LOCALES)
export const LANGUAGE_STORAGE_KEY='uptilldawn-language'
export const LANGUAGE_SOURCE_KEY='uptilldawn-language-source'
export const LANGUAGE_CHANGE_EVENT='uptilldawn-language-change'
export const LANGUAGE_APPLIED_EVENT='uptilldawn-language-applied'

export function parseUiLocale(value:string|null|undefined):SupportedUiLocale|null{
  const locale=value?.trim().toLowerCase().split(/[-_]/)[0]
  return locale&&supported.has(locale)?locale as SupportedUiLocale:null
}

export function parseAcceptLanguage(value:string|null|undefined):SupportedUiLocale|null{
  if(!value)return null
  for(const part of value.split(',')){
    const locale=parseUiLocale(part.split(';')[0])
    if(locale)return locale
  }
  return null
}

export function deviceUiLocale():SupportedUiLocale{
  if(typeof navigator==='undefined')return 'nl'
  const primary=parseUiLocale(navigator.language)
  if(primary)return primary
  for(const candidate of navigator.languages||[]){
    const locale=parseUiLocale(candidate)
    if(locale)return locale
  }
  return 'nl'
}

export function storedUiLocale():SupportedUiLocale|null{
  if(typeof window==='undefined')return null
  return parseUiLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
}

export function storedUiLocaleSource():LocaleSource|null{
  if(typeof window==='undefined')return null
  const source=window.localStorage.getItem(LANGUAGE_SOURCE_KEY)
  return source==='manual'||source==='device'?source:null
}

export function initialUiLocale():SupportedUiLocale{
  if(typeof window==='undefined')return 'nl'
  // A deliberate language choice must remain authoritative across navigation
  // and reloads. Without a manual choice, follow the current device language.
  const stored=storedUiLocale()
  return storedUiLocaleSource()==='manual'&&stored ? stored : deviceUiLocale()
}

export function initialUiLocaleSource():LocaleSource{
  if(typeof window==='undefined')return 'device'
  return storedUiLocaleSource()==='manual'&&storedUiLocale() ? 'manual' : 'device'
}

export function persistUiLocale(locale:SupportedUiLocale,source:LocaleSource){
  if(typeof window==='undefined')return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY,locale)
  window.localStorage.setItem(LANGUAGE_SOURCE_KEY,source)
  document.cookie=`${LANGUAGE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`
  document.cookie=`${LANGUAGE_SOURCE_KEY}=${source}; path=/; max-age=31536000; samesite=lax`
}

export function requestUiLocale(locale:SupportedUiLocale){
  persistUiLocale(locale,'manual')
  window.dispatchEvent(new CustomEvent<SupportedUiLocale>(LANGUAGE_CHANGE_EVENT,{detail:locale}))
}

export function activeUiLocale():SupportedUiLocale{
  if(typeof document!=='undefined'){
    const html=parseUiLocale(document.documentElement.lang)
    if(html)return html
  }
  const stored=storedUiLocale()
  if(stored)return stored
  return deviceUiLocale()
}
