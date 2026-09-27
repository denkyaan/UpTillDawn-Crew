export type SupportedLocale = 'nl' | 'en' | 'de' | 'fr'

export interface LocaleDictionary {
  locale: SupportedLocale
  messages: Readonly<Record<string, string>>
}

export interface LocalizationGap {
  locale: SupportedLocale
  missingKeys: readonly string[]
  emptyKeys: readonly string[]
}

export function localizationGaps(reference: LocaleDictionary, candidate: LocaleDictionary): LocalizationGap {
  const keys = Object.keys(reference.messages)
  return {
    locale: candidate.locale,
    missingKeys: keys.filter((key) => !(key in candidate.messages)),
    emptyKeys: keys.filter((key) => key in candidate.messages && !candidate.messages[key]?.trim()),
  }
}

export function localizationIsComplete(reference: LocaleDictionary, candidate: LocaleDictionary): boolean {
  const gaps = localizationGaps(reference, candidate)
  return gaps.missingKeys.length === 0 && gaps.emptyKeys.length === 0
}
