export const MAKER_ACCOUNT_EMAIL = 'steegmans.kyani@icloud.com'

export const MAKER_LOGIN_ALIASES = [
  'maker@upilldawn',
  'maker@uptilldawn',
] as const

export function normalizeLogin(value:string){
  return value.trim().toLowerCase()
}

export function isMakerLogin(value:string){
  const login=normalizeLogin(value)
  return login===MAKER_ACCOUNT_EMAIL
    || MAKER_LOGIN_ALIASES.includes(login as (typeof MAKER_LOGIN_ALIASES)[number])
}

export function resolveLoginEmail(value:string){
  const login=normalizeLogin(value)
  return isMakerLogin(login) ? MAKER_ACCOUNT_EMAIL : login
}
