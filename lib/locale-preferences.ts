export const SUPPORTED_UI_LOCALES = ['nl','fr','en','de'] as const
export type SupportedUiLocale = typeof SUPPORTED_UI_LOCALES[number]

const supported = new Set<string>(SUPPORTED_UI_LOCALES)
export const LANGUAGE_STORAGE_KEY='uptilldawn-language'
export const LANGUAGE_SOURCE_KEY='uptilldawn-language-source'
export const LANGUAGE_CHANGE_EVENT='uptilldawn-language-change'
export const LANGUAGE_APPLIED_EVENT='uptilldawn-language-applied'

export function parseUiLocale(value:string|null|undefined):SupportedUiLocale|null{
  const locale=value?.trim().toLowerCase().split(/[-_]/)[0]
  return locale&&supported.has(locale)?locale as SupportedUiLocale:null
}

export function deviceUiLocale():SupportedUiLocale{
  if(typeof navigator==='undefined')return 'nl'
  const candidates=navigator.languages?.length?navigator.languages:[navigator.language]
  for(const candidate of candidates){
    const locale=parseUiLocale(candidate)
    if(locale)return locale
  }
  return 'nl'
}

export function initialUiLocale():SupportedUiLocale{
  if(typeof window==='undefined')return 'nl'
  const stored=parseUiLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
  const source=window.localStorage.getItem(LANGUAGE_SOURCE_KEY)
  if(source==='manual'&&stored)return stored
  return deviceUiLocale()
}

export function persistUiLocale(locale:SupportedUiLocale,source:'manual'|'device'){
  if(typeof window==='undefined')return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY,locale)
  window.localStorage.setItem(LANGUAGE_SOURCE_KEY,source)
  document.cookie=`${LANGUAGE_STORAGE_KEY}=${locale}; path=/; max-age=31536000; samesite=lax`
  document.cookie=`${LANGUAGE_SOURCE_KEY}=${source}; path=/; max-age=31536000; samesite=lax`
}

export function activeUiLocale():SupportedUiLocale{
  if(typeof document!=='undefined'){
    const html=parseUiLocale(document.documentElement.lang)
    if(html)return html
  }
  if(typeof window!=='undefined'){
    const stored=parseUiLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
    if(stored)return stored
  }
  return deviceUiLocale()
}
