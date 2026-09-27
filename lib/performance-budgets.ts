export interface PerformanceBudget {
  maxInitialJsKb: number
  maxRouteJsKb: number
  maxLcpMs: number
  maxInpMs: number
  maxCls: number
}

export const WEB_PERFORMANCE_BUDGET: PerformanceBudget = {
  maxInitialJsKb: 250,
  maxRouteJsKb: 150,
  maxLcpMs: 2500,
  maxInpMs: 200,
  maxCls: 0.1,
}

export const MOBILE_PERFORMANCE_BUDGET: PerformanceBudget = {
  maxInitialJsKb: 200,
  maxRouteJsKb: 120,
  maxLcpMs: 2500,
  maxInpMs: 200,
  maxCls: 0.1,
}

export function performanceBudgetFor(compactViewport: boolean): PerformanceBudget {
  return compactViewport ? MOBILE_PERFORMANCE_BUDGET : WEB_PERFORMANCE_BUDGET
}
