export type OperationalAlertSeverity = 'warning' | 'critical'

export interface OperationalHealthSnapshot {
  offlineFailed: number
  offlineStale: number
  unreadNotifications: number
  notifications24h: number
  pendingCheckins: number
  pendingCheckouts: number
  openIncidents: number
}

export interface OperationalAlert {
  code: string
  severity: OperationalAlertSeverity
  message: string
}

export interface OperationalAlertThresholds {
  staleOfflineWarning: number
  failedOfflineCritical: number
  pendingAttendanceWarning: number
  openIncidentCritical: number
  unreadNotificationRatioWarning: number
}

export const DEFAULT_OPERATIONAL_ALERT_THRESHOLDS: OperationalAlertThresholds = {
  staleOfflineWarning: 1,
  failedOfflineCritical: 1,
  pendingAttendanceWarning: 5,
  openIncidentCritical: 1,
  unreadNotificationRatioWarning: 0.5,
}

export function evaluateOperationalAlerts(
  snapshot: OperationalHealthSnapshot,
  thresholds: OperationalAlertThresholds = DEFAULT_OPERATIONAL_ALERT_THRESHOLDS,
): OperationalAlert[] {
  const alerts: OperationalAlert[] = []
  if (snapshot.offlineFailed >= thresholds.failedOfflineCritical) {
    alerts.push({ code: 'offline-failed', severity: 'critical', message: `${snapshot.offlineFailed} offline operatie(s) definitief mislukt.` })
  } else if (snapshot.offlineStale >= thresholds.staleOfflineWarning) {
    alerts.push({ code: 'offline-stale', severity: 'warning', message: `${snapshot.offlineStale} offline operatie(s) wachten langer dan vijf minuten.` })
  }

  const pendingAttendance = snapshot.pendingCheckins + snapshot.pendingCheckouts
  if (pendingAttendance >= thresholds.pendingAttendanceWarning) {
    alerts.push({ code: 'attendance-backlog', severity: 'warning', message: `${pendingAttendance} inklok/uitklok aanvraag(en) wachten op beslissing.` })
  }

  if (snapshot.openIncidents >= thresholds.openIncidentCritical) {
    alerts.push({ code: 'open-incidents', severity: 'critical', message: `${snapshot.openIncidents} open help/incident melding(en) vragen opvolging.` })
  }

  const unreadRatio = snapshot.notifications24h > 0 ? snapshot.unreadNotifications / snapshot.notifications24h : 0
  if (unreadRatio >= thresholds.unreadNotificationRatioWarning && snapshot.unreadNotifications > 0) {
    alerts.push({ code: 'notification-backlog', severity: 'warning', message: 'Een groot deel van de recente meldingen is nog ongelezen.' })
  }

  return alerts
}

export function highestAlertSeverity(alerts: readonly OperationalAlert[]): OperationalAlertSeverity | null {
  if (alerts.some((alert) => alert.severity === 'critical')) return 'critical'
  if (alerts.some((alert) => alert.severity === 'warning')) return 'warning'
  return null
}
