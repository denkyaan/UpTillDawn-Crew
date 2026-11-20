// Generated from app/(app)/portals/administration/rosters/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
import { parseBrusselsRosterTime } from "@/lib/administration/roster-local-time";
const route = "/portals/administration/rosters";
async function context() {
    const user = await getCurrentUser();
    if (!user)
        redirect("/login");
    if ((!user.approved || user.account_blocked) && !user.isOwner)
        redirect("/portals");
    const db = await createClient();
    if (!user.realIsAdmin && !user.isOwner) {
        const { data, error } = await db.rpc("upt_my_portal_assignments");
        if (error || !canOpenPortal("administration", (data ?? []) as PortalAssignment[], { approved: user.approved, blocked: Boolean(user.account_blocked) }))
            redirect("/portals");
    }
    return { db, user };
}
export async function createProposal(form: FormData) {
    "use server";
    const { db } = await context();
    const event = String(form.get("event") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const start = String(form.get("start") ?? "");
    const end = String(form.get("end") ?? "");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(event) || !title || title.length > 180 || !start || !end)
        throw new Error("Invalid roster proposal");
    const details = String(form.get("details") ?? "");
    if (details.length > 2000)
        throw new Error("Roster details too long");
    const startAt = parseBrusselsRosterTime(start), endAt = parseBrusselsRosterTime(end);
    if (endAt <= startAt)
        throw new Error("Invalid roster time range");
    const { error } = await (db as unknown as SupabaseClient).rpc("upt_admin_roster_create", { p_event: event, p_title: title, p_details: details, p_start: startAt.toISOString(), p_end: endAt.toISOString() });
    if (error)
        throw new Error("Roster proposal could not be created");
    revalidatePath(route);
}
export async function shiftAction(form: FormData) {
    "use server";
    const { db, user } = await context();
    const id = String(form.get("id") ?? "");
    const shift = String(form.get("shift") ?? "");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
        throw new Error("Invalid roster identifier");
    const action = String(form.get("action") ?? "");
    if (!["target", "apply"].includes(action))
        throw new Error("Unknown roster action");
    const rpc = action === "target" ? "upt_admin_roster_target" : "upt_admin_roster_apply";
    if (rpc === "upt_admin_roster_apply" && !user.realIsAdmin && !user.isOwner)
        throw new Error("Admin required");
    if (rpc === "upt_admin_roster_target" && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(shift))
        throw new Error("Invalid shift identifier");
    const args = rpc === "upt_admin_roster_target" ? { p_id: id, p_shift: shift } : { p_id: id };
    const { error } = await (db as unknown as SupabaseClient).rpc(rpc, args);
    if (error)
        throw new Error("Roster shift action failed");
    revalidatePath(route);
}
export async function planNewShift(form: FormData) {
    "use server";
    const { db } = await context();
    const id = String(form.get("id") ?? "");
    const workplace = String(form.get("workplace") ?? "");
    const staff = String(form.get("staff") ?? "");
    const role = String(form.get("role") ?? "").trim();
    const kind = String(form.get("kind") ?? "event");
    const overlap = form.get("overlap") === "on";
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (![id, workplace, staff].every(value => uuid.test(value)) ||
        !role || role.length > 200 || !["event", "setup", "breakdown"].includes(kind))
        throw Error("Invalid roster assignment");
    const { error } = await (db as unknown as SupabaseClient).rpc("upt_admin_roster_plan_new", {
        p_id: id, p_workplace: workplace, p_user: staff, p_role_name: role,
        p_shift_kind: kind, p_overlap_allowed: overlap
    });
    if (error)
        throw Error("New shift proposal could not be prepared");
    revalidatePath(route);
}
export async function changeStatus(form: FormData) {
    "use server";
    const { db, user } = await context();
    const id = String(form.get("id") ?? "");
    const action = String(form.get("action") ?? "");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
        throw new Error("Invalid roster identifier");
    if (!["submit", "approve", "reject"].includes(action))
        throw new Error("Unknown roster status action");
    const note = String(form.get("note") ?? "").trim();
    if (note.length > 2000 || (action === "reject" && !note))
        throw new Error("Rejection requires a reason");
    if (action !== "submit" && !user.realIsAdmin && !user.isOwner)
        throw new Error("Admin required for roster review");
    if (action !== "submit") {
        const { data: proposal, error: lookupError } = await (db as unknown as SupabaseClient).from("admin_roster_proposals").select("created_by,status").eq("id", id).maybeSingle();
        if (lookupError || !proposal || proposal.status !== "submitted")
            throw new Error("Roster is not awaiting review");
        if (proposal.created_by === user.id)
            throw new Error("Roster creator cannot review their own proposal");
    }
    const result = action === "submit" ? await (db as unknown as SupabaseClient).rpc("upt_admin_roster_submit", { p_id: id }) : await (db as unknown as SupabaseClient).rpc("upt_admin_roster_review", { p_id: id, p_approve: action === "approve", p_note: note });
    if (result.error)
        throw new Error("Roster transition failed");
    revalidatePath(route);
}
