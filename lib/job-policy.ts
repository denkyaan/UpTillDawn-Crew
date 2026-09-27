export type JobPriority = 'low' | 'normal' | 'high' | 'critical'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'dead-letter'

export interface BackgroundJob {
  id: string
  type: string
  priority: JobPriority
  status: JobStatus
  attempts: number
  maxAttempts: number
  scheduledAt: number
}

export function backgroundJobCanRun(job: BackgroundJob, now = Date.now()): boolean {
  return job.status === 'queued' && job.scheduledAt <= now && job.attempts < job.maxAttempts
}

export function backgroundJobShouldDeadLetter(job: BackgroundJob): boolean {
  return job.status === 'failed' && job.attempts >= job.maxAttempts
}

export function retryDelayMs(attempt: number): number {
  return Math.min(3_600_000, 5_000 * 2 ** Math.max(0, Math.min(attempt, 8)))
}
