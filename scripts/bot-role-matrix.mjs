// One deterministic matrix for fixture seeding and full browser verification.
// Keep the first three identities stable for SQL and authenticated lifecycle tests.
export const botMatrix = Object.freeze([
  { role: 'admin', locale: 'nl' },
  { role: 'responsible', locale: 'fr' },
  { role: 'staff', locale: 'en' },
  { role: 'staff', locale: 'de' },
  { role: 'admin', locale: 'fr' },
  { role: 'responsible', locale: 'en' },
  { role: 'staff', locale: 'nl' },
  { role: 'staff', locale: 'fr' },
  { role: 'admin', locale: 'en' },
  { role: 'responsible', locale: 'de' },
  { role: 'staff', locale: 'nl' },
  { role: 'staff', locale: 'de' },
  { role: 'admin', locale: 'de' },
  { role: 'responsible', locale: 'nl' },
  { role: 'staff', locale: 'fr' },
])
