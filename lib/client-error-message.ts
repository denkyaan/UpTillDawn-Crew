import { activeUiLocale, type SupportedUiLocale } from '@/lib/locale-preferences'
import { translateRuntimeUi } from '@/lib/ui-translation-runtime'

type ErrorLike={message?:unknown;code?:unknown;status?:unknown;statusText?:unknown}

const SAFE_MESSAGES=[
  'Deze actie is pas beschikbaar vanaf de start van het evenement.',
  'Deze actie is niet meer beschikbaar omdat het evenement is afgelopen.',
  'Je hebt geen toegang tot deze actie.',
  'Je sessie is verlopen. Meld je opnieuw aan.',
  'Je bent momenteel offline. Controleer je internetverbinding en probeer opnieuw.',
  'De server reageert momenteel niet. Probeer over enkele ogenblikken opnieuw.',
  'Er ging iets mis. Probeer opnieuw. Blijft dit gebeuren, meld de fout via de app.',
] as const

function rawMessage(error:unknown){
  if(error instanceof Error)return error.message
  if(error&&typeof error==='object'){
    const value=(error as ErrorLike).message
    if(typeof value==='string')return value
  }
  return typeof error==='string'?error:''
}

export function humanizeAppError(error:unknown,locale:SupportedUiLocale=activeUiLocale()):string{
  const raw=rawMessage(error).trim()
  let message:string=SAFE_MESSAGES[6]
  if(/pas beschikbaar vanaf de start van het evenement|event(?: is)? not (?:started|active)|before (?:the )?event start/i.test(raw))message=SAFE_MESSAGES[0]
  else if(/evenement (?:is )?afgelopen|event (?:has )?ended|event closed/i.test(raw))message=SAFE_MESSAGES[1]
  else if(/jwt|session|token.*expired|not authenticated|aanmelden vereist/i.test(raw))message=SAFE_MESSAGES[3]
  else if(/permission|forbidden|unauthorized|geen toegang|not allowed/i.test(raw))message=SAFE_MESSAGES[2]
  else if(/network|fetch failed|failed to fetch|offline|internet/i.test(raw))message=SAFE_MESSAGES[4]
  else if(/timeout|timed out|gateway|service unavailable|temporarily unavailable/i.test(raw))message=SAFE_MESSAGES[5]
  else if(raw&&!/(?:HTTP\s*\d{3}|PGRST\d+|P\d{4}|SQLSTATE|postgres|supabase|rest\/v1|rpc\/|\{["']?(?:code|message|details))/i.test(raw))message=raw
  return translateRuntimeUi(message,locale)
}

export function isTechnicalErrorText(value:string){
  return /(?:HTTP\s*\d{3}|PGRST\d+|SQLSTATE|rest\/v1|rpc\/|\{["']?(?:code|details|hint))/i.test(value)
}
