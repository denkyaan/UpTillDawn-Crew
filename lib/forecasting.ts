export interface HistoricalStaffingSample {
  plannedCrew: number
  actualPeakCrew: number
  understaffedMinutes: number
}

export interface StaffingForecast {
  suggestedCrew: number
  sampleCount: number
  confidence: 'insufficient-data' | 'low' | 'medium'
  advisoryOnly: true
}

export function staffingForecast(samples: readonly HistoricalStaffingSample[]): StaffingForecast {
  if (!samples.length) return { suggestedCrew: 0, sampleCount: 0, confidence: 'insufficient-data', advisoryOnly: true }
  const weighted = samples.reduce((sum, sample) => sum + Math.max(0, sample.actualPeakCrew) + (sample.understaffedMinutes > 0 ? 1 : 0), 0)
  const suggestedCrew = Math.max(0, Math.ceil(weighted / samples.length))
  return {
    suggestedCrew,
    sampleCount: samples.length,
    confidence: samples.length >= 5 ? 'medium' : 'low',
    advisoryOnly: true,
  }
}
