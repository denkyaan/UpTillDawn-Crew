// Pure equivalent of the original app/(app)/incidents/page.tsx
// non-admin conditional redirect. Authorization evidence MUST come from
// signed Supabase/RLS queries, never from browser storage or query parameters.
export function incidentDestination(
 isAdmin:boolean,
 activeEventIds:readonly string[],
 shiftEventIds:readonly string[],
 hasCurrentWorkContext:boolean,
):'/events'|null{
 if(isAdmin)return null
 if(activeEventIds.length===0)return '/events'
 const active=new Set(activeEventIds)
 const hasActiveShift=shiftEventIds.some(eventId=>active.has(eventId))
 return !hasActiveShift&&!hasCurrentWorkContext?'/events':null
}
