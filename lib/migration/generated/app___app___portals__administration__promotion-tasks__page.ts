// Generated from app/(app)/portals/administration/promotion-tasks/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { removeGeneralPromotionAssignment } from "@/lib/actions/promotion-tasks";
export async function assignPromotionTask(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || (actor.account_blocked && !actor.isOwner))
        throw new Error("Admin authorization required");
    const task = String(form.get("task_id") ?? "");
    const user = String(form.get("user_id") ?? "");
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (!uuid.test(task) || !uuid.test(user))
        throw new Error("Invalid task or user");
    const db = await createClient();
    const { data: target, error: taskError } = await db.from("tasks").select("id,event_id").eq("id", task).maybeSingle();
    if (taskError || !target?.event_id)
        throw new Error("Only event tasks can be assigned through this workflow");
    const { data: membership, error: membershipError } = await db.from("event_members").select("user_id").eq("event_id", target.event_id).eq("user_id", user).maybeSingle();
    if (membershipError || !membership)
        throw new Error("User is not a member of this event");
    const { data: profile, error: profileError } = await db.from("profiles").select("id").eq("id", user).eq("approved", true).maybeSingle();
    if (profileError || !profile)
        throw new Error("User is not an approved member");
    const { error } = await db.rpc("upt_assign_task", { p_task: task, p_user: user });
    if (error)
        throw new Error("Task assignment failed");
    revalidatePath("/portals/administration/promotion-tasks");
    revalidatePath("/admin/management/promotion-tasks");
}
export async function removePromotionAssignment(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || (actor.account_blocked && !actor.isOwner))
        throw new Error("Admin authorization required");
    const id = String(form.get("assignment_id") ?? "");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
        throw new Error("Invalid assignment");
    const db = await createClient();
    const { data: assignment, error: lookupError } = await db.from("task_assignments").select("task_id").eq("id", id).maybeSingle();
    if (lookupError || !assignment)
        throw new Error("Assignment not found");
    const { data: eventTask, error: taskLookupError } = await db.from("tasks").select("id,event_id").eq("id", assignment.task_id).maybeSingle();
    if (!taskLookupError && eventTask && eventTask.event_id === null) {
        await removeGeneralPromotionAssignment(form);
        return;
    }
    if (taskLookupError || !eventTask?.event_id)
        throw new Error("Only event task assignments can be removed through this workflow");
    const { error } = await db.rpc("upt_remove_task_assignment", { p_assignment: id });
    if (error)
        throw new Error("Could not remove task assignment");
    revalidatePath("/portals/administration/promotion-tasks");
    revalidatePath("/admin/management/promotion-tasks");
}
