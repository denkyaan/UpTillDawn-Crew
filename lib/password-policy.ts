export const PASSWORD_MIN_LENGTH = 12

const LOWER = /[a-z]/
const UPPER = /[A-Z]/
const DIGIT = /[0-9]/
const SYMBOL = /[^A-Za-z0-9]/

export interface PasswordPolicyResult {
  valid: boolean
  issues: readonly string[]
}

export function validatePassword(password: string): PasswordPolicyResult {
  const issues: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`minstens ${PASSWORD_MIN_LENGTH} tekens`)
  if (!LOWER.test(password)) issues.push('een kleine letter')
  if (!UPPER.test(password)) issues.push('een hoofdletter')
  if (!DIGIT.test(password)) issues.push('een cijfer')
  if (!SYMBOL.test(password)) issues.push('een symbool')
  return { valid: issues.length === 0, issues }
}

export function passwordPolicyMessage(password: string): string | null {
  const result = validatePassword(password)
  return result.valid ? null : `Wachtwoord moet ${result.issues.join(', ')} bevatten.`
}
