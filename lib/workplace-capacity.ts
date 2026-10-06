export interface WorkplaceCapacity {
  workplaceId: string
  minimumStaff: number
  targetStaff: number
  maximumStaff?: number | null
}

export type StaffingState = 'understaffed' | 'target' | 'overstaffed'

export function workplaceStaffingState(capacity: WorkplaceCapacity, assignedStaff: number): StaffingState {
  if (assignedStaff < Math.max(0, capacity.minimumStaff)) return 'understaffed'
  if (capacity.maximumStaff != null && assignedStaff > Math.max(capacity.minimumStaff, capacity.maximumStaff)) return 'overstaffed'
  return 'target'
}

export function staffNeededForTarget(capacity: WorkplaceCapacity, assignedStaff: number): number {
  return Math.max(0, capacity.targetStaff - assignedStaff)
}

export function workplaceCapacityIsValid(capacity: WorkplaceCapacity): boolean {
  return capacity.minimumStaff >= 0 && capacity.targetStaff >= capacity.minimumStaff && (capacity.maximumStaff == null || capacity.maximumStaff >= capacity.targetStaff)
}
