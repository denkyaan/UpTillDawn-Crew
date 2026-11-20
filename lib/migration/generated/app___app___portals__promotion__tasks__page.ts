// Generated from app/(app)/portals/promotion/tasks/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/crew-server";
import { getCurrentUser } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
async function requirePromotionAccess() {
    const user = await getCurrentUser();
    if (!user)
        redirect("/login");
    if ((!user.approved || user.account_blocked) && !user.isOwner)
        throw new Error("Promotion access denied");
    const db = await createClient();
    if (!user.isOwner && !user.realIsAdmin) {
        const { data, error } = await db.rpc("upt_my_portal_assignments");
        if (error || !canOpenPortal("promotion", (data ?? []) as PortalAssignment[], { approved: user.approved, blocked: user.account_blocked === true }))
            throw new Error("Promotion access denied");
    }
    return { user, db };
}
const validAssignmentId = (id: string) => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
export async function changePromotionTaskStatus(formData: FormData) {
    "use server";
    const { user, db } = await requirePromotionAccess();
    const id = String(formData.get("assignment_id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!validAssignmentId(id) || status !== "IN PROGRESS")
        throw new Error("Invalid promotion task transition");
    const { data: blocked, error: blockError } = await db.rpc("upt_promotion_is_blocked" as never);
    if (blockError || blocked)
        throw new Error("Promotion access blocked");
    const { data: assigned, error: assignmentError } = await db.from("task_assignments").select("id,status,confirmed_at").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (assignmentError || !assigned || (assigned.status !== "NOT STARTED" && (assigned.status !== "IN PROGRESS" || assigned.confirmed_at !== null)))
        throw new Error("Only your open assignment can be started or confirmed");
    const { error } = await db.rpc("upt_start_promotion_task", { p_assignment: id });
    if (error)
        throw new Error("Task status update failed");
    revalidatePath("/portals/promotion/tasks");
}
export async function submitPromotionEvidence(formData: FormData) {
    "use server";
    const { user, db } = await requirePromotionAccess();
    const assignment = String(formData.get("assignment_id") ?? "");
    const file = formData.get("evidence");
    if (!validAssignmentId(assignment) || !(file instanceof File))
        throw new Error("Invalid promotion evidence submission");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024)
        throw new Error("Invalid image");
    const { data: blocked, error: blockError } = await db.rpc("upt_promotion_is_blocked" as never);
    if (blockError || blocked)
        throw new Error("Promotion access blocked");
    const { data: assigned, error: assignmentError } = await db.from("task_assignments").select("id,status").eq("id", assignment).eq("user_id", user.id).maybeSingle();
    if (assignmentError || !assigned || assigned.status !== "IN PROGRESS")
        throw new Error("Assignment must be in progress to submit evidence");
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length !== file.size || bytes.length > 10 * 1024 * 1024)
        throw new Error("Invalid image size");
    // Validate actual file signatures, not only browser-supplied MIME types.
    const isJpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR";
    const isWebp = bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!((file.type === "image/jpeg" && isJpeg) || (file.type === "image/png" && isPng) || (file.type === "image/webp" && isWebp)))
        throw new Error("Image format does not match file contents");
    const sha = createHash("sha256").update(bytes).digest("hex");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/promotion/${randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from("work-media").upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError)
        throw new Error("Evidence upload failed");
    const { error: saveError } = await db.rpc("upt_submit_promotion_evidence" as never, { p_assignment: assignment, p_storage_path: path, p_sha256: sha } as never);
    if (saveError) {
        const { error: cleanupError } = await db.storage.from("work-media").remove([path]);
        if (cleanupError)
            throw new Error("Evidence registration failed; uploaded file cleanup also failed");
        throw new Error("Evidence registration failed");
    }
    revalidatePath("/portals/promotion/tasks");
}
