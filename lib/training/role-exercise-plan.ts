import type {TourRole} from "@/lib/tour-training"

/** Each item is an observable training action, not a tab visit. */
export const ROLE_EXERCISES:Record<TourRole,Readonly<Record<string,readonly string[]>>>={
 admin:{
  events:["create-event","set-capacity","set-registration-deadline","publish-event","review-applications","manage-waitlist","archive-event"],
  workplaces:["create-workplace","create-shift","assign-responsible","assign-crew","replace-crew","edit-shift","set-price-list"],
  briefings:["write-event-briefing","write-workplace-briefing","add-checklist","publish-briefing","review-acknowledgements"],
  tasks:["create-task","assign-multiple-crew","edit-task","review-task-status"],
  inventory:["add-material","attach-inventory-file","review-opening-check","resolve-missing-or-damaged-item"],
  operations:["review-live-crew","review-breaks","override-check-in","correct-hours","approve-timesheet","reject-timesheet-with-reason","lock-timesheet"],
  personnel:["review-registration","approve-or-reject-account","assign-role","block-user","review-profile-preferences"],
  guestlist:["import-guestlist","add-artist","add-guest","review-entrance-arrival","review-backstage-alert"],
  driver:["create-transport","assign-driver","review-journey","review-mileage","review-artist-arrival"],
  incidents:["review-incident","assign-follow-up","resolve-incident"],
  sales:["review-merch-sales","review-tokens-sales","reconcile-event-revenue"],
  chat:["send-group-message","start-private-chat","reply-to-message","attach-file","review-notifications"],
  exports:["review-locked-hours","export-timesheets","review-report"],
  platform:["review-platform-health","inspect-error-reports","use-admin-ai","review-automations"],
  settings:["edit-profile","change-language","review-notifications"],
 },
 responsible_lead:{
  events:["review-assigned-event","confirm-availability"],
  workplaces:["review-own-workplace","review-own-crew","review-shift","handover-shift"],
  briefings:["open-briefing","acknowledge-briefing","complete-opening-checklist","complete-closing-checklist"],
  tasks:["create-workplace-task","assign-own-crew","review-task","complete-task"],
  inventory:["check-materials","report-missing-material","report-damage","confirm-closing-inventory"],
  operations:["confirm-crew-arrival","start-work","start-break","end-break","stop-work","review-own-crew-hours","request-time-correction"],
  incidents:["request-help","report-incident","follow-up-incident"],
  chat:["send-workplace-message","start-private-chat","reply-to-message","review-notifications"],
  crew:["review-assigned-crew","review-crew-status"],
  settings:["edit-profile","change-language","review-notifications"],
 },
 employee:{
  events:["review-event","submit-availability","withdraw-availability","review-waitlist"],
  workplaces:["review-assigned-workplace","review-shift","review-responsible"],
  briefings:["open-briefing","read-checklist","acknowledge-briefing"],
  tasks:["open-assigned-task","complete-task"],
  inventory:["review-assigned-materials","report-missing-or-damaged-item"],
  operations:["request-check-in","start-work","start-break","end-break","stop-work","submit-timesheet","review-timesheet"],
  incidents:["request-help","report-incident"],
  chat:["send-event-message","start-private-chat","reply-to-message","review-notifications"],
  crew:["review-own-profile","review-workplace-preferences"],
  settings:["edit-profile","change-language","review-notifications"],
 },
}
export function exercisesForRole(role:TourRole){return ROLE_EXERCISES[role]}
