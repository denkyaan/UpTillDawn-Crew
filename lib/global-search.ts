export type SearchEntity = 'staff' | 'event' | 'workplace' | 'shift' | 'task' | 'incident' | 'document'

export interface SearchQuery {
  text: string
  filters: Readonly<Record<string, string>>
}

export function parseGlobalSearch(input: string): SearchQuery {
  const filters: Record<string, string> = {}
  const text: string[] = []
  for (const token of input.trim().split(/\s+/).filter(Boolean)) {
    const index = token.indexOf(':')
    if (index > 0 && index < token.length - 1) filters[token.slice(0, index).toLowerCase()] = token.slice(index + 1)
    else text.push(token)
  }
  return { text: text.join(' '), filters }
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
}
