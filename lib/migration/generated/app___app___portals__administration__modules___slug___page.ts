// Generated from app/(app)/portals/administration/modules/[slug]/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { markAllNotificationsRead } from "@/lib/actions/uptilldawn";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
/** A dedicated Administration draft action. Publication still requires Admin. */
export async function saveAdministrationEventDraft(formData: FormData) {
    'use server';
    const current = await getCurrentUser();
    if (!current)
        redirect('/login');
    if ((!current.approved || current.account_blocked) && !current.isOwner)
        redirect('/portals');
    const db = await createClient();
    if (!current.realIsAdmin && !current.isOwner) {
        const { data, error } = await db.rpc('upt_my_portal_assignments');
        if (error || !canOpenPortal('administration', (data ?? []) as PortalAssignment[], { approved: current.approved, blocked: Boolean(current.account_blocked) }))
            redirect('/portals');
    }
    const value = (key: string) => String(formData.get(key) ?? '').trim();
    const name = value('name'), venue = value('venue');
    const rawStart = value('start_at'), rawEnd = value('end_at'), id = value('event_id');
    const start = new Date(rawStart), end = new Date(rawEnd);
    if (name.length < 3 || name.length > 200 || venue.length > 200 || !rawStart || !rawEnd
        || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()
        || (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
        throw new Error('Controleer de evenementnaam, locatie, start- en eindtijd.');
    }
    const { error } = await (db as unknown as SupabaseClient).rpc('upt_administration_save_event_draft', {
        p_event_id: id || null, p_name: name, p_start_at: start.toISOString(), p_end_at: end.toISOString(), p_venue: venue || null
    });
    if (error)
        throw new Error('Evenementconcept kon niet worden opgeslagen. Controleer je rechten en probeer opnieuw.');
    revalidatePath('/portals/administration/modules/events');
    revalidatePath('/events');
    redirect('/portals/administration/modules/events');
}
export async function markAdministrationNotificationRead(formData: FormData) {
    'use server';
    const current = await getCurrentUser();
    if (!current)
        redirect('/login');
    if ((!current.approved || current.account_blocked) && !current.isOwner)
        redirect('/portals');
    const db = await createClient();
    if (!current.isOwner && !current.realIsAdmin) {
        const { data, error } = await db.rpc('upt_my_portal_assignments');
        if (error || !canOpenPortal('administration', (data ?? []) as PortalAssignment[], { approved: current.approved, blocked: current.account_blocked === true }))
            redirect('/portals');
    }
    const id = String(formData.get('notification_id') ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        return;
    const { error } = await db.rpc('upt_mark_notification_read', { p_notification: id });
    if (error)
        throw new Error('Unable to update notification');
    revalidatePath('/portals/administration/modules/notifications');
    revalidatePath('/notifications');
}
export async function markAllAdministrationNotificationsRead() {
    'use server';
    const current = await getCurrentUser();
    if (!current)
        redirect('/login');
    if ((!current.approved || current.account_blocked) && !current.isOwner)
        redirect('/portals');
    const db = await createClient();
    if (!current.isOwner && !current.realIsAdmin) {
        const { data, error } = await db.rpc('upt_my_portal_assignments');
        if (error || !canOpenPortal('administration', (data ?? []) as PortalAssignment[], { approved: current.approved, blocked: current.account_blocked === true }))
            redirect('/portals');
    }
    await markAllNotificationsRead();
    revalidatePath('/portals/administration/modules/notifications');
    revalidatePath('/notifications');
}
