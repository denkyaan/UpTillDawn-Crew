export type LoadingPresentation = 'none' | 'inline' | 'skeleton' | 'blocking'

export interface LoadingContext {
  hasCachedData: boolean
  mutationInProgress: boolean
  initialLoad: boolean
  critical: boolean
}

export function loadingPresentation(context: LoadingContext): LoadingPresentation {
  if (context.mutationInProgress) return context.critical ? 'blocking' : 'inline'
  if (context.initialLoad && !context.hasCachedData) return 'skeleton'
  return 'none'
}

export function contentRemainsVisibleWhileRefreshing(context: LoadingContext): boolean {
  return context.hasCachedData && !context.critical
}
