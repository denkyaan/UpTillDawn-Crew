// Generated from components/administration/billing-profile.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { administrationPageAccess } from "@/lib/administration/page-access";
import { billingParty, billingFields } from "@/lib/administration/peppol-server";
import { peppolPartyIssues, normalizeEnterprise } from "@/lib/administration/peppol";
const path = '/portals/administration/modules/settings';
export async function save(form: FormData) {
    'use server';
    const access = await administrationPageAccess();
    if (!access.ok)
        redirect(path + '?billing=error');
    const db = access.db as unknown as SupabaseClient;
    const values = Object.fromEntries(billingFields.map(key => [key, String(form.get(key) ?? '').trim()]));
    if (Object.values(values).some(value => value.length > 300 || /[\u0000-\u001f]/.test(value)))
        redirect(path + '?billing=error');
    values.country_code = values.country_code.toUpperCase();
    values.enterprise_number = normalizeEnterprise(values.enterprise_number, values.country_code);
    values.vat_number = values.vat_number.replace(/[.\s-]/g, '').toUpperCase();
    values.iban = values.iban.replace(/\s/g, '').toUpperCase();
    const { data: existing, error } = await db.from('admin_billing_profile').select('updated_at').eq('singleton', true).maybeSingle();
    if (error || String(existing?.updated_at ?? '') !== String(form.get('version') ?? ''))
        redirect(path + '?billing=error');
    const result = existing ? await db.from('admin_billing_profile').update(values).eq('singleton', true).eq('updated_at', existing.updated_at).select('singleton') : await db.from('admin_billing_profile').insert({ ...values, singleton: true }).select('singleton');
    if (result.error || result.data?.length !== 1)
        redirect(path + '?billing=error');
    revalidatePath(path);
}
export async function approve(form: FormData) {
    'use server';
    const access = await administrationPageAccess();
    if (!access.ok || (!access.user.isAdmin && !access.user.isOwner))
        redirect(path + '?billing=error');
    const db = access.db as unknown as SupabaseClient;
    const { data: profile, error } = await db.from('admin_billing_profile').select('*').eq('singleton', true).maybeSingle();
    if (error || !profile || profile.updated_at !== form.get('version') || peppolPartyIssues(billingParty(profile), 'seller').length)
        redirect(path + '?billing=error');
    const { data, error: updateError } = await db.from('admin_billing_profile').update({ approved_by: access.user.id, approved_at: new Date().toISOString() }).eq('singleton', true).eq('updated_at', profile.updated_at).select('singleton');
    if (updateError || data?.length !== 1)
        redirect(path + '?billing=error');
    revalidatePath(path);
}
