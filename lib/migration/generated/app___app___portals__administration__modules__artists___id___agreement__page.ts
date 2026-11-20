// Generated from app/(app)/portals/administration/modules/artists/[id]/agreement/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
import { refreshContractSigningStatus } from "@/lib/administration/contract-signing-refresh";
import { createApprovedArtistVersionVerifier, type ApprovedArtistVersionReader } from "@/lib/administration/contract-approval-verifier";
export async function saveTerms(form: FormData) {
    "use server";
    const id = String(form.get("id") ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        notFound();
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
    const fields = ["agreement_payment_terms", "agreement_cancellation_terms", "agreement_liability_terms", "agreement_governing_law"] as const;
    const values = Object.fromEntries(fields.map(field => [field, String(form.get(field) ?? "").trim() || null]));
    if (Object.values(values).some(value => value !== null && value.length > 3000))
        throw new Error("Agreement condition is too long");
    const { data, error } = await db.from("admin_artist_bookings").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).in("status", ["enquiry", "negotiating"]).select("id").maybeSingle();
    if (error || !data)
        throw new Error("Agreement terms cannot be changed for this booking");
    revalidatePath(base + "/" + id + "/agreement");
    redirect(base + "/" + id + "/agreement");
}
export async function snapshotAgreement(form: FormData) {
    "use server";
    const id = String(form.get("id") ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        notFound();
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
    const { data: booking, error } = await db.from("admin_artist_bookings").select("id,artist_name,status,event_id,agency_contact_id,performance_at,fee_amount,currency,rider_notes,agreement_payment_terms,agreement_cancellation_terms,agreement_liability_terms,agreement_governing_law").eq("id", id).single();
    if (error || !booking || booking.status === "cancelled")
        throw new Error("Agreement unavailable");
    if (!booking.artist_name?.trim() || !booking.agency_contact_id || !booking.performance_at || booking.fee_amount === null || !Number.isFinite(booking.fee_amount) || booking.fee_amount < 0 || !booking.currency || !booking.rider_notes?.trim() || !booking.agreement_payment_terms || !booking.agreement_cancellation_terms || !booking.agreement_liability_terms || !booking.agreement_governing_law)
        throw new Error("Complete agreement terms first");
    const { data: agency, error: agencyError } = await db.from("admin_counterparties").select("name,email").eq("id", booking.agency_contact_id).maybeSingle();
    const { data: event, error: eventError } = await db.from("events").select("name,start_at").eq("id", booking.event_id).maybeSingle();
    if (agencyError || eventError)
        throw new Error("Unable to read contract parties or event");
    if (!agency?.name?.trim() || !agency.email?.trim() || !event?.name?.trim() || !event.start_at)
        throw new Error("Agency and event required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agency.email.trim()) || !Number.isFinite(Date.parse(event.start_at)) || !Number.isFinite(Date.parse(booking.performance_at)))
        throw new Error("Invalid agreement contact or event date");
    const snapshot = { ...booking, agency_name: agency.name, agency_email: agency.email, event_name: event.name, event_start_at: event.start_at };
    const { data: latest, error: latestError } = await db.from("admin_artist_agreement_versions").select("version_number").eq("booking_id", id).order("version_number", { ascending: false }).limit(1).maybeSingle();
    if (latestError)
        throw new Error("Unable to determine latest agreement version");
    const nextVersion = (latest?.version_number ?? 0) + 1;
    if (!Number.isSafeInteger(nextVersion) || nextVersion < 1)
        throw new Error("Invalid next agreement version");
    const { error: insertError } = await db.from("admin_artist_agreement_versions").insert({ booking_id: id, version_number: nextVersion, snapshot });
    if (insertError)
        throw new Error("Agreement version could not be saved; retry if another user created a version");
    revalidatePath(base + "/" + id + "/agreement");
    redirect(base + "/" + id + "/agreement");
}
export async function approveAgreement(form: FormData) {
    "use server";
    const id = String(form.get("id") ?? "");
    const versionId = String(form.get("version_id") ?? "");
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(id) || !uuid.test(versionId))
        notFound();
    const user = await getCurrentUser();
    if (!user)
        redirect("/login");
    if (!user.realIsAdmin && !user.isOwner)
        redirect("/portals");
    if ((!user.approved || user.account_blocked) && !user.isOwner)
        redirect("/portals");
    const db = await createClient();
    if (!user.isAdmin && !user.isOwner) {
        const { data, error } = await db.rpc("upt_my_portal_assignments");
        if (error || !canOpenPortal("administration", (data ?? []) as PortalAssignment[], { approved: user.approved, blocked: Boolean(user.account_blocked) }))
            redirect("/portals");
    }
    const { data: version, error: readError } = await db.from("admin_artist_agreement_versions").select("id,created_by,approved_at").eq("id", versionId).eq("booking_id", id).maybeSingle();
    if (readError || !version || version.approved_at || version.created_by === user.id)
        throw new Error("Approval requires a different authorized user");
    const { data, error } = await db.from("admin_artist_agreement_versions").update({ approved_by: user.id, approved_at: new Date().toISOString() }).eq("id", versionId).eq("booking_id", id).is("approved_at", null).select("id").maybeSingle();
    if (error || !data)
        throw new Error("Agreement approval was not saved");
    revalidatePath(base + "/" + id + "/agreement");
    redirect(base + "/" + id + "/agreement");
}
export async function prepareSignature(form: FormData) {
    "use server";
    const id = String(form.get("id") ?? "");
    const versionId = String(form.get("version_id") ?? "");
    const email = String(form.get("recipient_email") ?? "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId))
        notFound();
    if (email.length > 320 || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
        throw new Error("Invalid recipient email");
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
    const { data: version, error: versionError } = await db.from("admin_artist_agreement_versions").select("id,version_number,approved_at").eq("id", versionId).eq("booking_id", id).maybeSingle();
    if (versionError || !version?.approved_at || !Number.isSafeInteger(version.version_number) || version.version_number < 1)
        throw new Error("Approved agreement version required");
    const approvalVerified = await createApprovedArtistVersionVerifier(db as unknown as ApprovedArtistVersionReader)({ documentType: "artist", documentId: versionId, version: version.version_number, approvedAt: version.approved_at });
    if (!approvalVerified)
        throw new Error("Approved agreement version verification failed");
    const { data: booking, error: bookingError } = await db.from("admin_artist_bookings").select("agency_contact_id,status").eq("id", id).maybeSingle();
    if (bookingError || !booking?.agency_contact_id || booking.status === "cancelled")
        throw new Error("Booking unavailable");
    const { data: agency, error: agencyError } = await db.from("admin_counterparties").select("email").eq("id", booking.agency_contact_id).maybeSingle();
    if (agencyError)
        throw new Error("Agency contact lookup failed");
    if (!agency?.email || agency.email.trim().toLowerCase() !== email)
        throw new Error("Agency email mismatch");
    const { error } = await db.from("admin_artist_agreement_signature_requests").insert({ agreement_version_id: versionId, recipient_email: email });
    if (error)
        throw new Error("Unable to prepare signature");
    revalidatePath(base + "/" + id + "/agreement");
    redirect(base + "/" + id + "/agreement");
}
export async function cancelSignaturePreparation(form: FormData) {
    "use server";
    const id = String(form.get("id") ?? "");
    const requestId = String(form.get("request_id") ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))
        notFound();
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
    const { data: request, error: requestError } = await db.from("admin_artist_agreement_signature_requests").select("id,agreement_version_id,status").eq("id", requestId).maybeSingle();
    if (requestError || !request || request.status !== "prepared")
        throw new Error("Preparation unavailable");
    const { data: version, error: versionError } = await db.from("admin_artist_agreement_versions").select("id").eq("id", request.agreement_version_id).eq("booking_id", id).maybeSingle();
    if (versionError || !version)
        notFound();
    const { data, error } = await db.rpc("upt_cancel_artist_signature_preparation", { p_request_id: requestId });
    if (error || !data)
        throw new Error("Preparation could not be cancelled");
    revalidatePath(base + "/" + id + "/agreement");
    redirect(base + "/" + id + "/agreement");
}
export async function refreshSigning(form: FormData) {
    "use server";
    const bookingId = String(form.get("booking_id") ?? "");
    const versionId = String(form.get("version_id") ?? "");
    const version = Number(form.get("version") ?? 0);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(bookingId) || !uuid.test(versionId) || !Number.isSafeInteger(version) || version < 1)
        notFound();
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
    const { data: approved } = await db.from("admin_artist_agreement_versions").select("id")
        .eq("id", versionId).eq("booking_id", bookingId).eq("version_number", version)
        .not("approved_at", "is", null).maybeSingle();
    if (!approved)
        throw new Error("Approved agreement version required");
    await refreshContractSigningStatus({ documentType: "artist", documentId: versionId, version });
    revalidatePath(base + "/" + bookingId + "/agreement");
    redirect(base + "/" + bookingId + "/agreement");
}
const base = "/portals/administration/modules/artists";
