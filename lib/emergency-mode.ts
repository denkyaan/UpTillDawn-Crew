export interface EmergencyInformation {
  eventName: string
  eventAddress: string
  emergencyNumber: string
  firstAidContact?: string | null
  securityContact?: string | null
  responsibleContact?: string | null
  assemblyPoint?: string | null
  procedure?: string | null
  updatedAt: number
}

export function emergencyInformationIsUsable(info: EmergencyInformation): boolean {
  return Boolean(info.eventName.trim() && info.eventAddress.trim() && info.emergencyNumber.trim())
}

export function emergencyCacheKey(eventId: string): string {
  return `uptilldawn:emergency:${eventId}`
}
