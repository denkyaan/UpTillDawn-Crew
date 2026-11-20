// Generated from app/(app)/portals/administration/counterparties/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { listPage } from "@/lib/list-query";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
async function authorizedClient() {
    const user = await getCurrentUser();
    if (!user)
        redirect('/login');
    if ((!user.approved || Boolean(user.account_blocked)) && !user.isOwner)
        redirect('/portals');
    const db = await createClient();
    if (!user.realIsAdmin && !user.isOwner) {
        const { data, error } = await db.rpc('upt_my_portal_assignments');
        if (error || !canOpenPortal('administration', (data ?? []) as PortalAssignment[], { approved: user.approved, blocked: user.account_blocked === true }))
            redirect('/portals');
    }
    return db;
}
function checkedBillingAddress(fd: FormData) {
    const street_address = String(fd.get('street_address') ?? '').trim();
    const postal_code = String(fd.get('postal_code') ?? '').trim();
    const city = String(fd.get('city') ?? '').trim();
    const country_code = String(fd.get('country_code') ?? '').trim().toUpperCase();
    if (street_address.length > 300 || postal_code.length > 32 || city.length > 120 || (country_code && !/^[A-Z]{2}$/.test(country_code)) || /[\u0000-\u001f]/.test(street_address + postal_code + city))
        return null;
    return { street_address: street_address || null, postal_code: postal_code || null, city: city || null, country_code: country_code || null };
}
export async function addCounterparty(formData: FormData) {
    'use server';
    const db = await authorizedClient();
    const name = String(formData.get('name') ?? '').trim();
    const kind = String(formData.get('kind') ?? '');
    const vat_number = String(formData.get('vat_number') ?? '').trim();
    const enterprise_number = String(formData.get('enterprise_number') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const billing = checkedBillingAddress(formData);
    if (!billing)
        redirect('/portals/administration/counterparties?error=1');
    if (!name || name.length > 200 || vat_number.length > 40 || enterprise_number.length > 40 || email.length > 254 || !['customer', 'supplier', 'both'].includes(kind) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
        redirect('/portals/administration/counterparties?error=1');
    const { error } = await db.from('admin_counterparties').insert({ name, kind, vat_number: vat_number || null, enterprise_number: enterprise_number || null, email: email || null, ...billing });
    if (error)
        redirect('/portals/administration/counterparties?error=1');
    revalidatePath('/portals/administration/counterparties');
    redirect('/portals/administration/counterparties');
}
function counterpartyReturnPath(formData: FormData) {
    const q = String(formData.get('return_q') ?? '').trim().slice(0, 100);
    const kind = String(formData.get('return_kind') ?? '');
    const rawPage = String(formData.get('return_page') ?? '');
    const page = listPage(rawPage, 100000);
    const params = new URLSearchParams({ ...(q ? { q } : {}), ...(['customer', 'supplier', 'both'].includes(kind) ? { kind } : {}), ...(page > 1 ? { page: String(page) } : {}) });
    return '/portals/administration/counterparties' + (params.size ? '?' + params.toString() : '');
}
export async function updateCounterparty(formData: FormData) {
    'use server';
    const db = await authorizedClient();
    const returnPath = counterpartyReturnPath(formData);
    const id = String(formData.get('id') ?? '');
    const name = String(formData.get('name') ?? '').trim();
    const kind = String(formData.get('kind') ?? '');
    const vat_number = String(formData.get('vat_number') ?? '').trim();
    const enterprise_number = String(formData.get('enterprise_number') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const billing = checkedBillingAddress(formData);
    if (!billing)
        redirect(returnPath + (returnPath.includes('?') ? '&' : '?') + 'error=1');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !name || name.length > 200 || !['customer', 'supplier', 'both'].includes(kind) || vat_number.length > 40 || enterprise_number.length > 40 || email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
        redirect(returnPath + (returnPath.includes('?') ? '&' : '?') + 'error=1');
    const { data, error } = await db.from('admin_counterparties').update({ name, kind, vat_number: vat_number || null, enterprise_number: enterprise_number || null, email: email || null, ...billing }).eq('id', id).select('id').maybeSingle();
    if (error || !data)
        redirect(returnPath + (returnPath.includes('?') ? '&' : '?') + 'error=1');
    revalidatePath('/portals/administration/counterparties');
    redirect(returnPath);
}
