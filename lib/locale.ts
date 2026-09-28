export const APP_LOCALES = ['nl','fr','en','de'] as const
export type AppLocale = typeof APP_LOCALES[number]
export type LocaleSource = 'device'|'manual'

export const LANGUAGE_STORAGE_KEY='uptilldawn-language'
export const LANGUAGE_SOURCE_STORAGE_KEY='uptilldawn-language-source'
export const LANGUAGE_CHANGE_EVENT='uptilldawn-language-change'
export const LANGUAGE_APPLIED_EVENT='uptilldawn-language-applied'

const supported=new Set<string>(APP_LOCALES)

export function parseAppLocale(value:string|null|undefined):AppLocale|null{
  const locale=value?.trim().toLowerCase().split(/[-_]/)[0]
  return locale&&supported.has(locale)?locale as AppLocale:null
}

export function parseAcceptLanguage(value:string|null|undefined):AppLocale|null{
  if(!value)return null
  for(const part of value.split(',')){
    const locale=parseAppLocale(part.split(';')[0])
    if(locale)return locale
  }
  return null
}

export function deviceAppLocale():AppLocale{
  if(typeof navigator==='undefined')return 'nl'
  const candidates=navigator.languages?.length?navigator.languages:[navigator.language]
  for(const candidate of candidates){
    const locale=parseAppLocale(candidate)
    if(locale)return locale
  }
  return 'nl'
}

export function storedAppLocale():AppLocale|null{
  if(typeof window==='undefined')return null
  return parseAppLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
}

export function storedLocaleSource():LocaleSource|null{
  if(typeof window==='undefined')return null
  const source=window.localStorage.getItem(LANGUAGE_SOURCE_STORAGE_KEY)
  return source==='manual'||source==='device'?source:null
}

export function initialAppLocale():AppLocale{
  if(typeof window==='undefined')return 'nl'
  const stored=storedAppLocale()
  return storedLocaleSource()==='manual'&&stored?stored:deviceAppLocale()
}

export function persistAppLocale(locale:AppLocale,source:LocaleSource){
  if(typeof window==='undefined')return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY,locale)
  window.localStorage.setItem(LANGUAGE_SOURCE_STORAGE_KEY,source)
  document.cookie=`${LANGUAGE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`
  document.cookie=`${LANGUAGE_SOURCE_STORAGE_KEY}=${source}; path=/; max-age=31536000; samesite=lax`
}

export function requestAppLocale(locale:AppLocale){
  persistAppLocale(locale,'manual')
  window.dispatchEvent(new CustomEvent<AppLocale>(LANGUAGE_CHANGE_EVENT,{detail:locale}))
}
