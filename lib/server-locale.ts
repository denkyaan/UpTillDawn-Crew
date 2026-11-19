import { cookies, headers } from 'next/headers'
import {
  parseAcceptLanguage,
  parseUiLocale,
  type SupportedUiLocale,
} from '@/lib/locale-preferences'

export async function requestUiLocale():Promise<SupportedUiLocale>{
  const [cookieStore,headerStore]=await Promise.all([cookies(),headers()])
  const cookieLocale=parseUiLocale(cookieStore.get('uptilldawn-language')?.value)
  const headerLocale=parseAcceptLanguage(headerStore.get('accept-language'))
  // Device/browser language is authoritative on a fresh request. The cookie is
  // only a fallback for clients that do not send a usable Accept-Language.
  return headerLocale||cookieLocale||'nl'
}

export {PRODUCT_COPY} from './product-copy'
