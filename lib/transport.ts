export interface EventVehicle {
  id: string
  label: string
  capacity: number
  driverUserId?: string | null
}

export interface TransportAssignment {
  vehicleId: string
  passengerUserIds: readonly string[]
}

export function remainingVehicleSeats(vehicle: EventVehicle, assignment?: TransportAssignment): number {
  const occupied = assignment?.vehicleId === vehicle.id ? assignment.passengerUserIds.length : 0
  return Math.max(0, vehicle.capacity - occupied)
}

export function vehicleIsOverCapacity(vehicle: EventVehicle, assignment?: TransportAssignment): boolean {
  return assignment?.vehicleId === vehicle.id && assignment.passengerUserIds.length > Math.max(0, vehicle.capacity)
}
