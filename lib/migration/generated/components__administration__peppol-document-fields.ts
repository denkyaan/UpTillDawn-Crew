// Generated from components/administration/peppol-document-fields.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { administrationPageAccess } from "@/lib/administration/page-access";
import { peppolVatCategories } from "@/lib/administration/peppol";
const path = '/portals/administration/finance';
export async function saveReferences(form: FormData) {
    'use server';
    const access = await administrationPageAccess(), id = String(form.get('document_id') ?? '');
    if (!access.ok || !/^[0-9a-f-]{36}$/i.test(id))
        redirect(path + '?error=1');
    const db = access.db as unknown as SupabaseClient;
    const { data: doc } = await db.from('admin_financial_documents').select('status').eq('id', id).maybeSingle();
    if (!doc || doc.status === 'void' || (doc.status !== 'draft' && !access.user.isAdmin && !access.user.isOwner))
        redirect(path + '?error=1');
    const buyer = String(form.get('buyer_reference') ?? '').trim(), order = String(form.get('order_reference') ?? '').trim(), date = String(form.get('delivery_date') ?? ''), country = String(form.get('delivery_country') ?? '').trim().toUpperCase();
    if (buyer.length > 200 || order.length > 200 || /[\u0000-\u001f]/.test(buyer + order) || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) || (country && !/^[A-Z]{2}$/.test(country)))
        redirect(path + '?error=1');
    const { data, error } = await db.from('admin_financial_documents').update({ buyer_reference: buyer || null, order_reference: order || null, delivery_date: date || null, delivery_country: country || null }).eq('id', id).eq('status', doc.status).select('id');
    if (error || data?.length !== 1)
        redirect(path + '?error=1');
    revalidatePath(path);
    revalidatePath(`/portals/administration/modules/invoices/${id}/peppol`);
}
export async function saveLine(form: FormData) {
    'use server';
    const access = await administrationPageAccess(), id = String(form.get('line_id') ?? ''), documentId = String(form.get('document_id') ?? '');
    if (!access.ok || ![id, documentId].every(value => /^[0-9a-f-]{36}$/i.test(value)))
        redirect(path + '?error=1');
    const db = access.db as unknown as SupabaseClient, unit = String(form.get('unit_code') ?? 'C62'), category = String(form.get('vat_category') ?? ''), reason = String(form.get('vat_exemption_reason') ?? '').trim();
    if (!/^[A-Z0-9]{1,3}$/.test(unit) || (category && !(peppolVatCategories as readonly string[]).includes(category)) || reason.length > 500 || /[\u0000-\u001f]/.test(reason))
        redirect(path + '?error=1');
    const { data: doc } = await db.from('admin_financial_documents').select('status').eq('id', documentId).maybeSingle();
    if (doc?.status !== 'draft')
        redirect(path + '?error=1');
    const { data, error } = await db.from('admin_financial_lines').update({ unit_code: unit, vat_category: category || null, vat_exemption_reason: reason || null }).eq('id', id).eq('document_id', documentId).select('id');
    if (error || data?.length !== 1)
        redirect(path + '?error=1');
    revalidatePath(path);
    revalidatePath(`/portals/administration/modules/invoices/${documentId}/peppol`);
}
