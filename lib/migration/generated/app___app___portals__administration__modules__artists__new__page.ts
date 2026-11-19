// Generated from app/(app)/portals/administration/modules/artists/new/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
const path = "/portals/administration/modules/artists";
async function authorizedDb() {
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
export async function createBooking(form: FormData) {
    "use server";
    const db = await authorizedDb();
    const artist_name = String(form.get("artist_name") ?? "").trim();
    const event_id = String(form.get("event_id") ?? "");
    const agency_contact_id = String(form.get("agency_contact_id") ?? "");
    const rider_notes = String(form.get("rider_notes") ?? "").trim();
    const internal_notes = String(form.get("internal_notes") ?? "").trim();
    const rawFee = String(form.get("fee_amount") ?? "").trim();
    const fee_amount = rawFee === "" ? null : Number(rawFee);
    const performance = String(form.get("performance_at") ?? "");
    const performanceDate = performance ? new Date(performance) : null;
    if (!artist_name || artist_name.length > 180 || !/^[0-9a-f-]{36}$/i.test(event_id) || rider_notes.length > 5000 || internal_notes.length > 5000 || agency_contact_id && !/^[0-9a-f-]{36}$/i.test(agency_contact_id) || fee_amount !== null && (!Number.isFinite(fee_amount) || fee_amount < 0 || fee_amount > 999999999) || performanceDate && Number.isNaN(performanceDate.getTime()))
        throw new Error("Invalid booking details");
    const { data: event } = await db.from("events").select("id").eq("id", event_id).maybeSingle();
    if (!event)
        throw new Error("Event unavailable");
    if (agency_contact_id) {
        const { data: agency } = await db.from("admin_counterparties").select("id").eq("id", agency_contact_id).maybeSingle();
        if (!agency)
            throw new Error("Agency unavailable");
    }
    const { data: booking, error } = await db.from("admin_artist_bookings").insert({
        artist_name, event_id, agency_contact_id: agency_contact_id || null,
        fee_amount, performance_at: performanceDate?.toISOString() ?? null,
        rider_notes: rider_notes || null, internal_notes: internal_notes || null,
        status: "enquiry", currency: "EUR"
    }).select("id").single();
    if (error || !booking)
        throw new Error("Booking could not be saved");
    revalidatePath(path);
    revalidatePath("/portals/administration/modules/contracts");
    if (form.get("contract_context") === "1")
        redirect(path + "/" + booking.id + "/agreement");
    redirect(path);
}
