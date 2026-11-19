// Generated from app/(app)/portals/administration/modules/artists/[id]/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
const base = "/portals/administration/modules/artists";
async function access() {
    const user = await getCurrentUser();
    if (!user)
        redirect("/login");
    if ((!user.approved || user.account_blocked) && !user.isOwner)
        redirect("/portals");
    const db = await createClient();
    if (!user.isAdmin && !user.isOwner) {
        const { data, error } = await db.rpc("upt_my_portal_assignments");
        if (error || !canOpenPortal("administration", (data ?? []) as PortalAssignment[], { approved: user.approved, blocked: Boolean(user.account_blocked) }))
            redirect("/portals");
    }
    return db;
}
export async function recordCommunication(form: FormData) {
    "use server";
    const db = await access();
    const id = String(form.get("id") ?? "");
    const kind = String(form.get("kind") ?? "");
    const details = String(form.get("details") ?? "").trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !["email_sent", "reply_received", "follow_up"].includes(kind) || details.length < 3 || details.length > 1500)
        throw new Error("Invalid communication record");
    const { data: booking, error } = await db.from("admin_artist_bookings").select("id").eq("id", id).single();
    if (error || !booking)
        notFound();
    const { error: insertError } = await db.from("admin_artist_booking_communications").insert({ booking_id: id, kind, details });
    if (insertError)
        throw new Error("Communication record could not be saved");
    // Recording an actual follow-up closes its outstanding reminder. Other contact
    // types must not silently clear a scheduled follow-up.
    if (kind === "follow_up") {
        const { error: clearError } = await db.from("admin_artist_bookings").update({ follow_up_at: null, updated_at: new Date().toISOString() }).eq("id", id).in("status", ["enquiry", "negotiating"]);
        if (clearError)
            throw new Error("Follow-up was recorded, but its reminder could not be cleared");
    }
    revalidatePath(base);
    revalidatePath(`${base}/${id}`);
    redirect(`${base}/${id}`);
}
export async function updateBooking(form: FormData) {
    "use server";
    const db = await access();
    const operator = await getCurrentUser();
    const id = String(form.get("id") ?? "");
    const status = String(form.get("status") ?? "");
    const rider_notes = String(form.get("rider_notes") ?? "").trim();
    const internal_notes = String(form.get("internal_notes") ?? "").trim();
    const followUpInput = String(form.get("follow_up_at") ?? "").trim();
    const followUpDate = followUpInput ? new Date(`${followUpInput}Z`) : null;
    if (followUpDate && (!Number.isFinite(followUpDate.getTime()) || followUpDate.getTime() < Date.now() - 60000))
        throw new Error("Invalid follow-up date");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !["enquiry", "negotiating", "confirmed", "cancelled"].includes(status) || rider_notes.length > 5000 || internal_notes.length > 5000)
        throw new Error("Invalid booking update");
    const { data: booking, error: readError } = await db.from("admin_artist_bookings").select("id,status,internal_notes,agency_contact_id,performance_at,fee_amount").eq("id", id).single();
    if (readError || !booking)
        notFound();
    const transitions: Record<string, string[]> = { enquiry: ["enquiry", "negotiating", "cancelled"], negotiating: ["negotiating", "confirmed", "cancelled"], confirmed: ["confirmed", "cancelled"], cancelled: ["cancelled"] };
    if (status !== booking.status && (["confirmed", "cancelled"].includes(status) || ["confirmed", "cancelled"].includes(booking.status)) && !operator?.realIsAdmin && !operator?.isOwner)
        throw new Error("Admin required");
    if (!transitions[booking.status]?.includes(status))
        throw new Error("Invalid booking status transition");
    if (status === "confirmed" && booking.status !== "confirmed") {
        if (!booking.agency_contact_id || !booking.performance_at || booking.fee_amount === null)
            throw new Error("Complete the agency, performance date and agreed fee before confirming");
        const { data: agency, error: agencyError } = await db.from("admin_counterparties").select("id,email").eq("id", booking.agency_contact_id).maybeSingle();
        if (agencyError || !agency?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agency.email))
            throw new Error("A valid agency email is required before confirmation");
    }
    const history = (booking.internal_notes ?? "").split("\n").filter(line => /^\[\d{4}-\d{2}-\d{2}T.*\] \[(email_sent|reply_received|follow_up)\] \[[0-9a-f-]{36}\] /.test(line));
    const notes = [internal_notes, ...history].filter(Boolean).join("\n");
    const updateQuery = db.from("admin_artist_bookings").update({ status, rider_notes: rider_notes || null, internal_notes: notes || null, follow_up_at: ["confirmed", "cancelled"].includes(status) ? null : followUpDate?.toISOString() ?? null, updated_at: new Date().toISOString() }).eq("id", id).eq("status", booking.status);
    const { error } = await (booking.internal_notes === null ? updateQuery.is("internal_notes", null) : updateQuery.eq("internal_notes", booking.internal_notes)).select("id").single();
    if (error)
        throw new Error("Booking update failed");
    revalidatePath(base);
    redirect(base);
}
