export const MAKER_ACCOUNT_EMAIL = 'steegmans.kyani@icloud.com'

export const MAKER_LOGIN_ALIAS = 'maker@uptilldawn'

export function normalizeLogin(value:string){
  return value.trim().toLowerCase()
}

export function isMakerLogin(value:string){
  const login=normalizeLogin(value)
  return login===MAKER_ACCOUNT_EMAIL
    || login===MAKER_LOGIN_ALIAS
}

export function resolveLoginEmail(value:string){
  const login=normalizeLogin(value)
  return isMakerLogin(login) ? MAKER_ACCOUNT_EMAIL : login
}
