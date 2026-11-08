export interface WorkplaceCapacity {
  workplaceId: string
  minimumStaff: number
  targetStaff: number
  maximumStaff?: number | null
}

export type StaffingState = 'understaffed' | 'target' | 'overstaffed'

export function workplaceStaffingState(capacity: WorkplaceCapacity, assignedStaff: number): StaffingState {
  if (!workplaceCapacityIsValid(capacity) || !Number.isSafeInteger(assignedStaff) || assignedStaff < 0) return 'understaffed'
  if (assignedStaff < capacity.minimumStaff) return 'understaffed'
  if (capacity.maximumStaff != null && assignedStaff > Math.max(capacity.minimumStaff, capacity.maximumStaff)) return 'overstaffed'
  return 'target'
}

export function staffNeededForTarget(capacity: WorkplaceCapacity, assignedStaff: number): number {
  if (!workplaceCapacityIsValid(capacity) || !Number.isSafeInteger(assignedStaff) || assignedStaff < 0) return 0
  return Math.max(0, capacity.targetStaff - assignedStaff)
}

export function workplaceCapacityIsValid(capacity: WorkplaceCapacity): boolean {
  return Boolean(capacity.workplaceId?.trim()) &&
    Number.isSafeInteger(capacity.minimumStaff) && capacity.minimumStaff >= 0 &&
    Number.isSafeInteger(capacity.targetStaff) && capacity.targetStaff >= capacity.minimumStaff &&
    (capacity.maximumStaff == null || (Number.isSafeInteger(capacity.maximumStaff) && capacity.maximumStaff >= capacity.targetStaff))
}
