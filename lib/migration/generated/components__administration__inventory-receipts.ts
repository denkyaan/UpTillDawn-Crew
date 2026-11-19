// Generated from components/administration/inventory-receipts.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { administrationAccess } from "@/lib/administration/access";
export async function receive(form: FormData) {
    'use server';
    const access = await administrationAccess();
    if (!access.ok || !access.user.realIsAdmin)
        redirect('/portals');
    const line = String(form.get('line') ?? ''), item = String(form.get('item') ?? ''), request = String(form.get('request') ?? ''), quantity = Number(form.get('quantity'));
    if (![line, item, request].every(s => /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(s)) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
        throw Error('Invalid receipt');
    const { error } = await (access.db as unknown as SupabaseClient).rpc('upt_receive_invoice_inventory', { p_request: request, p_line: line, p_item: item, p_quantity: quantity });
    if (error)
        throw Error('Receipt rejected: verify invoice approval, event and purchased quantity');
    revalidatePath('/portals/administration/modules/inventory');
}
