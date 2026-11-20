// Generated from app/(app)/admin/management/event-tasks/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export async function updateAssignment(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || actor.account_blocked)
        throw new Error("Admin authorization required");
    const task = String(form.get("task_id") ?? "");
    const user = String(form.get("user_id") ?? "");
    const assignment = String(form.get("assignment_id") ?? "");
    const remove = form.get("operation") === "remove";
    if (remove ? !uuid.test(assignment) : !uuid.test(task) || !uuid.test(user))
        throw new Error("Invalid assignment input");
    const db = await createClient();
    if (!remove) {
        const { data: target, error: targetError } = await db.from("tasks").select("event_id").eq("id", task).maybeSingle();
        if (targetError || !target?.event_id)
            throw new Error("Event task required");
    }
    const { error } = remove ? await db.rpc("upt_remove_task_assignment", { p_assignment: assignment }) : await db.rpc("upt_assign_task", { p_task: task, p_user: user });
    if (error)
        throw new Error("Task assignment update failed");
    revalidatePath("/admin/management/event-tasks");
    revalidatePath("/tasks");
}
export async function editEventTask(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || actor.account_blocked)
        throw new Error("Admin authorization required");
    const task = String(form.get("task_id") ?? "");
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "");
    if (!uuid.test(task) || !title || title.length > 200 || description.length > 4000)
        throw new Error("Invalid task details");
    const db = await createClient();
    const { error } = await db.rpc("upt_admin_update_event_task", { p_task: task, p_title: title, p_description: description });
    if (error)
        throw new Error("Task update failed");
    revalidatePath("/admin/management/event-tasks");
    revalidatePath("/tasks");
}
