// Generated from app/(app)/portals/administration/promotion-discipline/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
export async function unblock(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || (actor.account_blocked && !actor.isOwner))
        throw new Error("Admin required");
    const user = String(form.get("user") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(user) || reason.length < 10)
        throw new Error("Invalid unblock request");
    const db = await createClient();
    const { error } = await db.rpc("upt_admin_unblock_promotion" as never, { p_user: user, p_reason: reason } as never);
    if (error)
        throw new Error("Could not lift restriction");
    revalidatePath("/portals/administration/promotion-discipline");
    revalidatePath("/admin/management/promotion-discipline");
}
export async function registerReference(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || (actor.account_blocked && !actor.isOwner))
        throw new Error("Admin required");
    const task = String(form.get("task_id") ?? "");
    const file = form.get("reference");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(task) || !(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 10 * 1024 * 1024)
        throw new Error("Invalid reference");
    const db = await createClient();
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length !== file.size || bytes.length < 1 || bytes.length > 10 * 1024 * 1024)
        throw new Error("Invalid reference image size");
    const isJpeg = bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString("ascii", 12, 16) === "IHDR";
    const isWebp = bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!((file.type === "image/jpeg" && isJpeg) || (file.type === "image/png" && isPng) || (file.type === "image/webp" && isWebp)))
        throw new Error("Invalid reference image format");
    const sha = createHash("sha256").update(bytes).digest("hex");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${actor.id}/promotion-reference/${randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from("work-media").upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError)
        throw new Error("Reference upload failed");
    const { error } = await db.rpc("upt_admin_register_promotion_reference" as never, { p_task: task, p_path: path, p_sha256: sha } as never);
    if (error) {
        await db.storage.from("work-media").remove([path]);
        throw new Error("Reference registration failed");
    }
    revalidatePath("/portals/administration/promotion-discipline");
    revalidatePath("/admin/management/promotion-discipline");
}
export async function reviewEvidence(form: FormData) {
    "use server";
    const actor = await getCurrentUser();
    if (!actor || (!actor.realIsAdmin && !actor.isOwner) || (!actor.approved && !actor.isOwner) || (actor.account_blocked && !actor.isOwner))
        throw new Error("Admin required");
    const evidence = String(form.get("evidence_id") ?? "");
    const status = String(form.get("status") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(evidence) || !["verified", "rejected", "inconclusive"].includes(status) || reason.length < 10)
        throw new Error("Invalid evidence review");
    const db = await createClient();
    const { error } = await db.rpc("upt_admin_review_promotion_evidence" as never, { p_evidence: evidence, p_status: status, p_details: reason } as never);
    if (error)
        throw new Error("Could not save evidence review");
    revalidatePath("/portals/administration/promotion-discipline");
    revalidatePath("/admin/management/promotion-discipline");
}
