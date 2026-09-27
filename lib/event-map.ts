export interface MapPoint {
  x: number
  y: number
}

export interface WorkplaceMapMarker extends MapPoint {
  workplaceId: string
  label: string
}

export interface IncidentMapMarker extends MapPoint {
  incidentId: string
  urgency: 'normal' | 'high' | 'urgent'
}

export function mapPointIsValid(point: MapPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
}

export function validWorkplaceMarkers(markers: readonly WorkplaceMapMarker[]): WorkplaceMapMarker[] {
  return markers.filter(mapPointIsValid)
}
